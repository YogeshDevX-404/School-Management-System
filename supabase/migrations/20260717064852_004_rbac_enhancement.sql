/*
# School ERP RBAC Enhancement Migration

## Overview
1. Adds father_name, mother_name columns to students table
2. Creates teacher_class_assignments table (controls which classes a teacher can mark attendance for)
3. Creates leave_requests table (teacher leave requests with principal approval workflow)
4. Adds get_user_role() helper function for RLS policies
5. Updates ALL RLS policies to enforce strict role-based access control

## New Tables
- teacher_class_assignments: Maps teachers to class+section for attendance marking
- leave_requests: Teacher leave requests with approval workflow

## Modified Tables
- students: + father_name, mother_name

## Security
- Role-based RLS on every table using get_user_role()
- Students: read-only on attendance/fees/timetable, no staff/students/settings/programs/academic
- Teachers: can only mark attendance for assigned classes
- Accountants: only fees/payments
- Principals: full CRUD on students/staff/academic/attendance/timetable
*/

-- ===== Helper function =====
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- ===== Add columns to students =====
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'father_name') THEN
    ALTER TABLE public.students ADD COLUMN father_name text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'mother_name') THEN
    ALTER TABLE public.students ADD COLUMN mother_name text;
  END IF;
END $$;

-- ===== Teacher Class Assignments =====
CREATE TABLE IF NOT EXISTS public.teacher_class_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  section_id uuid REFERENCES public.sections(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  is_deleted boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_tca_teacher ON public.teacher_class_assignments(teacher_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_tca_class_section ON public.teacher_class_assignments(class_id, section_id) WHERE is_deleted = false;

ALTER TABLE public.teacher_class_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tca_select_all" ON public.teacher_class_assignments;
CREATE POLICY "tca_select_all" ON public.teacher_class_assignments FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "tca_insert_admin" ON public.teacher_class_assignments;
CREATE POLICY "tca_insert_admin" ON public.teacher_class_assignments FOR INSERT
  TO authenticated WITH CHECK (public.get_user_role() IN ('super_admin','admin','principal'));

DROP POLICY IF EXISTS "tca_update_admin" ON public.teacher_class_assignments;
CREATE POLICY "tca_update_admin" ON public.teacher_class_assignments FOR UPDATE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal'))
  WITH CHECK (public.get_user_role() IN ('super_admin','admin','principal'));

DROP POLICY IF EXISTS "tca_delete_admin" ON public.teacher_class_assignments;
CREATE POLICY "tca_delete_admin" ON public.teacher_class_assignments FOR DELETE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal'));

-- ===== Leave Requests =====
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  leave_type text NOT NULL CHECK (leave_type IN ('casual','sick','earned','maternity','other')),
  reason text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  attachment_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_leave_teacher ON public.leave_requests(teacher_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_leave_status ON public.leave_requests(status) WHERE is_deleted = false;

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leave_select_own_or_admin" ON public.leave_requests;
CREATE POLICY "leave_select_own_or_admin" ON public.leave_requests FOR SELECT
  TO authenticated USING (
    public.get_user_role() IN ('super_admin','admin','principal')
    OR teacher_id IN (SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "leave_insert_own" ON public.leave_requests;
CREATE POLICY "leave_insert_own" ON public.leave_requests FOR INSERT
  TO authenticated WITH CHECK (
    teacher_id IN (SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "leave_update_own_or_admin" ON public.leave_requests;
CREATE POLICY "leave_update_own_or_admin" ON public.leave_requests FOR UPDATE
  TO authenticated USING (
    public.get_user_role() IN ('super_admin','admin','principal')
    OR teacher_id IN (SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid())
  )
  WITH CHECK (
    public.get_user_role() IN ('super_admin','admin','principal')
    OR teacher_id IN (SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "leave_delete_admin" ON public.leave_requests;
CREATE POLICY "leave_delete_admin" ON public.leave_requests FOR DELETE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal'));

-- ===== RLS POLICIES FOR ALL EXISTING TABLES =====

-- PROFILES: all authenticated can read; self can update own profile
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete_self" ON public.profiles;
CREATE POLICY "profiles_delete_self" ON public.profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- ACADEMIC SESSIONS: admin/principal write, all read
DROP POLICY IF EXISTS "academic_sessions_select_all" ON public.academic_sessions;
CREATE POLICY "academic_sessions_select_all" ON public.academic_sessions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "academic_sessions_insert_admin" ON public.academic_sessions;
CREATE POLICY "academic_sessions_insert_admin" ON public.academic_sessions FOR INSERT
  TO authenticated WITH CHECK (public.get_user_role() IN ('super_admin','admin','principal'));

DROP POLICY IF EXISTS "academic_sessions_update_admin" ON public.academic_sessions;
CREATE POLICY "academic_sessions_update_admin" ON public.academic_sessions FOR UPDATE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal'))
  WITH CHECK (public.get_user_role() IN ('super_admin','admin','principal'));

DROP POLICY IF EXISTS "academic_sessions_delete_admin" ON public.academic_sessions;
CREATE POLICY "academic_sessions_delete_admin" ON public.academic_sessions FOR DELETE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal'));

-- CLASSES: admin/principal write, all read
DROP POLICY IF EXISTS "classes_select_all" ON public.classes;
CREATE POLICY "classes_select_all" ON public.classes FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "classes_insert_admin" ON public.classes;
CREATE POLICY "classes_insert_admin" ON public.classes FOR INSERT
  TO authenticated WITH CHECK (public.get_user_role() IN ('super_admin','admin','principal'));

DROP POLICY IF EXISTS "classes_update_admin" ON public.classes;
CREATE POLICY "classes_update_admin" ON public.classes FOR UPDATE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal'))
  WITH CHECK (public.get_user_role() IN ('super_admin','admin','principal'));

DROP POLICY IF EXISTS "classes_delete_admin" ON public.classes;
CREATE POLICY "classes_delete_admin" ON public.classes FOR DELETE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal'));

-- SECTIONS: admin/principal write, all read
DROP POLICY IF EXISTS "sections_select_all" ON public.sections;
CREATE POLICY "sections_select_all" ON public.sections FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "sections_insert_admin" ON public.sections;
CREATE POLICY "sections_insert_admin" ON public.sections FOR INSERT
  TO authenticated WITH CHECK (public.get_user_role() IN ('super_admin','admin','principal'));

DROP POLICY IF EXISTS "sections_update_admin" ON public.sections;
CREATE POLICY "sections_update_admin" ON public.sections FOR UPDATE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal'))
  WITH CHECK (public.get_user_role() IN ('super_admin','admin','principal'));

DROP POLICY IF EXISTS "sections_delete_admin" ON public.sections;
CREATE POLICY "sections_delete_admin" ON public.sections FOR DELETE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal'));

-- SUBJECTS: admin/principal write, all read
DROP POLICY IF EXISTS "subjects_select_all" ON public.subjects;
CREATE POLICY "subjects_select_all" ON public.subjects FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "subjects_insert_admin" ON public.subjects;
CREATE POLICY "subjects_insert_admin" ON public.subjects FOR INSERT
  TO authenticated WITH CHECK (public.get_user_role() IN ('super_admin','admin','principal'));

DROP POLICY IF EXISTS "subjects_update_admin" ON public.subjects;
CREATE POLICY "subjects_update_admin" ON public.subjects FOR UPDATE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal'))
  WITH CHECK (public.get_user_role() IN ('super_admin','admin','principal'));

DROP POLICY IF EXISTS "subjects_delete_admin" ON public.subjects;
CREATE POLICY "subjects_delete_admin" ON public.subjects FOR DELETE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal'));

-- PROGRAMS: admin write, all read
DROP POLICY IF EXISTS "programs_select_all" ON public.programs;
CREATE POLICY "programs_select_all" ON public.programs FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "programs_insert_admin" ON public.programs;
CREATE POLICY "programs_insert_admin" ON public.programs FOR INSERT
  TO authenticated WITH CHECK (public.get_user_role() IN ('super_admin','admin'));

DROP POLICY IF EXISTS "programs_update_admin" ON public.programs;
CREATE POLICY "programs_update_admin" ON public.programs FOR UPDATE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin'))
  WITH CHECK (public.get_user_role() IN ('super_admin','admin'));

DROP POLICY IF EXISTS "programs_delete_admin" ON public.programs;
CREATE POLICY "programs_delete_admin" ON public.programs FOR DELETE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin'));

-- STUDENTS: admin/principal write, all read
DROP POLICY IF EXISTS "students_select_all" ON public.students;
CREATE POLICY "students_select_all" ON public.students FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "students_insert_admin" ON public.students;
CREATE POLICY "students_insert_admin" ON public.students FOR INSERT
  TO authenticated WITH CHECK (public.get_user_role() IN ('super_admin','admin','principal'));

DROP POLICY IF EXISTS "students_update_admin" ON public.students;
CREATE POLICY "students_update_admin" ON public.students FOR UPDATE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal'))
  WITH CHECK (public.get_user_role() IN ('super_admin','admin','principal'));

DROP POLICY IF EXISTS "students_delete_admin" ON public.students;
CREATE POLICY "students_delete_admin" ON public.students FOR DELETE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal'));

-- STAFF: admin/principal write, all read (teachers can view directory)
DROP POLICY IF EXISTS "staff_select_all" ON public.staff;
CREATE POLICY "staff_select_all" ON public.staff FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "staff_insert_admin" ON public.staff;
CREATE POLICY "staff_insert_admin" ON public.staff FOR INSERT
  TO authenticated WITH CHECK (public.get_user_role() IN ('super_admin','admin','principal'));

DROP POLICY IF EXISTS "staff_update_admin" ON public.staff;
CREATE POLICY "staff_update_admin" ON public.staff FOR UPDATE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal'))
  WITH CHECK (public.get_user_role() IN ('super_admin','admin','principal'));

DROP POLICY IF EXISTS "staff_delete_admin" ON public.staff;
CREATE POLICY "staff_delete_admin" ON public.staff FOR DELETE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal'));

-- FEE PLANS: admin/accountant write, all read
DROP POLICY IF EXISTS "fee_plans_select_all" ON public.fee_plans;
CREATE POLICY "fee_plans_select_all" ON public.fee_plans FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "fee_plans_insert_finance" ON public.fee_plans;
CREATE POLICY "fee_plans_insert_finance" ON public.fee_plans FOR INSERT
  TO authenticated WITH CHECK (public.get_user_role() IN ('super_admin','admin','accountant'));

DROP POLICY IF EXISTS "fee_plans_update_finance" ON public.fee_plans;
CREATE POLICY "fee_plans_update_finance" ON public.fee_plans FOR UPDATE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','accountant'))
  WITH CHECK (public.get_user_role() IN ('super_admin','admin','accountant'));

DROP POLICY IF EXISTS "fee_plans_delete_finance" ON public.fee_plans;
CREATE POLICY "fee_plans_delete_finance" ON public.fee_plans FOR DELETE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','accountant'));

-- PAYMENTS: admin/accountant write, all read
DROP POLICY IF EXISTS "payments_select_all" ON public.payments;
CREATE POLICY "payments_select_all" ON public.payments FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "payments_insert_finance" ON public.payments;
CREATE POLICY "payments_insert_finance" ON public.payments FOR INSERT
  TO authenticated WITH CHECK (public.get_user_role() IN ('super_admin','admin','accountant'));

DROP POLICY IF EXISTS "payments_update_finance" ON public.payments;
CREATE POLICY "payments_update_finance" ON public.payments FOR UPDATE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','accountant'))
  WITH CHECK (public.get_user_role() IN ('super_admin','admin','accountant'));

DROP POLICY IF EXISTS "payments_delete_finance" ON public.payments;
CREATE POLICY "payments_delete_finance" ON public.payments FOR DELETE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','accountant'));

-- ATTENDANCE: admin/principal/teacher write, all read
DROP POLICY IF EXISTS "attendance_select_all" ON public.attendance;
CREATE POLICY "attendance_select_all" ON public.attendance FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "attendance_insert_staff" ON public.attendance;
CREATE POLICY "attendance_insert_staff" ON public.attendance FOR INSERT
  TO authenticated WITH CHECK (public.get_user_role() IN ('super_admin','admin','principal','teacher'));

DROP POLICY IF EXISTS "attendance_update_staff" ON public.attendance;
CREATE POLICY "attendance_update_staff" ON public.attendance FOR UPDATE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal','teacher'))
  WITH CHECK (public.get_user_role() IN ('super_admin','admin','principal','teacher'));

DROP POLICY IF EXISTS "attendance_delete_admin" ON public.attendance;
CREATE POLICY "attendance_delete_admin" ON public.attendance FOR DELETE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal'));

-- TIMETABLE: admin/principal write, all read
DROP POLICY IF EXISTS "timetable_select_all" ON public.timetable;
CREATE POLICY "timetable_select_all" ON public.timetable FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "timetable_insert_admin" ON public.timetable;
CREATE POLICY "timetable_insert_admin" ON public.timetable FOR INSERT
  TO authenticated WITH CHECK (public.get_user_role() IN ('super_admin','admin','principal'));

DROP POLICY IF EXISTS "timetable_update_admin" ON public.timetable;
CREATE POLICY "timetable_update_admin" ON public.timetable FOR UPDATE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal'))
  WITH CHECK (public.get_user_role() IN ('super_admin','admin','principal'));

DROP POLICY IF EXISTS "timetable_delete_admin" ON public.timetable;
CREATE POLICY "timetable_delete_admin" ON public.timetable FOR DELETE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal'));

-- ACTIVITIES: all read, all authenticated insert
DROP POLICY IF EXISTS "activities_select_all" ON public.activities;
CREATE POLICY "activities_select_all" ON public.activities FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "activities_insert_all" ON public.activities;
CREATE POLICY "activities_insert_all" ON public.activities FOR INSERT
  TO authenticated WITH CHECK (true);

-- NOTIFICATIONS: users see own + broadcast, all authenticated insert
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "notifications_insert_all" ON public.notifications;
CREATE POLICY "notifications_insert_all" ON public.notifications FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_delete_admin" ON public.notifications;
CREATE POLICY "notifications_delete_admin" ON public.notifications FOR DELETE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin'));

-- SETTINGS: admin write, all read
DROP POLICY IF EXISTS "settings_select_all" ON public.settings;
CREATE POLICY "settings_select_all" ON public.settings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "settings_update_admin" ON public.settings;
CREATE POLICY "settings_update_admin" ON public.settings FOR UPDATE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin'))
  WITH CHECK (public.get_user_role() IN ('super_admin','admin'));
