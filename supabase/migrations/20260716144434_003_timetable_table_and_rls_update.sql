/*
# Timetable Table + RBAC RLS Update

## Overview
1. Creates a new `timetable` table for storing weekly class schedules with real CRUD.
2. Removes `receptionist` from the profiles role CHECK constraint.
3. Adds a `get_user_role()` helper function for RLS policies.
4. Updates RLS policies on key tables to enforce role-based access.

## New Tables
- `timetable` — weekly schedule entries

## Security
- RLS enabled on timetable.
- Role-based policies using get_user_role() helper.
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

-- ===== Remove receptionist from profiles CHECK =====
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'profiles' AND constraint_name = 'profiles_role_check'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin','admin','principal','accountant','teacher','student'));

-- ===== Timetable table =====
CREATE TABLE IF NOT EXISTS public.timetable (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  section_id uuid REFERENCES public.sections(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  teacher_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  day_of_week text NOT NULL CHECK (day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
  period_number integer NOT NULL CHECK (period_number >= 1 AND period_number <= 8),
  start_time text,
  end_time text,
  room text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  is_deleted boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS idx_timetable_class_section ON public.timetable(class_id, section_id) WHERE is_deleted = false;

ALTER TABLE public.timetable ENABLE ROW LEVEL SECURITY;

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

-- ===== Update students RLS =====
DROP POLICY IF EXISTS "students_insert_own" ON public.students;
CREATE POLICY "students_insert_admin" ON public.students FOR INSERT
  TO authenticated WITH CHECK (public.get_user_role() IN ('super_admin','admin','principal'));

DROP POLICY IF EXISTS "students_update_own" ON public.students;
CREATE POLICY "students_update_admin" ON public.students FOR UPDATE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal'))
  WITH CHECK (public.get_user_role() IN ('super_admin','admin','principal'));

DROP POLICY IF EXISTS "students_delete_own" ON public.students;
CREATE POLICY "students_delete_admin" ON public.students FOR DELETE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal'));

-- ===== Update staff RLS =====
DROP POLICY IF EXISTS "staff_insert_own" ON public.staff;
CREATE POLICY "staff_insert_admin" ON public.staff FOR INSERT
  TO authenticated WITH CHECK (public.get_user_role() IN ('super_admin','admin','principal'));

DROP POLICY IF EXISTS "staff_update_own" ON public.staff;
CREATE POLICY "staff_update_admin" ON public.staff FOR UPDATE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal'))
  WITH CHECK (public.get_user_role() IN ('super_admin','admin','principal'));

DROP POLICY IF EXISTS "staff_delete_own" ON public.staff;
CREATE POLICY "staff_delete_admin" ON public.staff FOR DELETE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal'));

-- ===== Update fee_plans RLS =====
DROP POLICY IF EXISTS "fee_plans_insert_own" ON public.fee_plans;
CREATE POLICY "fee_plans_insert_finance" ON public.fee_plans FOR INSERT
  TO authenticated WITH CHECK (public.get_user_role() IN ('super_admin','admin','accountant'));

DROP POLICY IF EXISTS "fee_plans_update_own" ON public.fee_plans;
CREATE POLICY "fee_plans_update_finance" ON public.fee_plans FOR UPDATE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','accountant'))
  WITH CHECK (public.get_user_role() IN ('super_admin','admin','accountant'));

DROP POLICY IF EXISTS "fee_plans_delete_own" ON public.fee_plans;
CREATE POLICY "fee_plans_delete_finance" ON public.fee_plans FOR DELETE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','accountant'));

-- ===== Update payments RLS =====
DROP POLICY IF EXISTS "payments_insert_own" ON public.payments;
CREATE POLICY "payments_insert_finance" ON public.payments FOR INSERT
  TO authenticated WITH CHECK (public.get_user_role() IN ('super_admin','admin','accountant'));

DROP POLICY IF EXISTS "payments_update_own" ON public.payments;
CREATE POLICY "payments_update_finance" ON public.payments FOR UPDATE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','accountant'))
  WITH CHECK (public.get_user_role() IN ('super_admin','admin','accountant'));

DROP POLICY IF EXISTS "payments_delete_own" ON public.payments;
CREATE POLICY "payments_delete_finance" ON public.payments FOR DELETE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','accountant'));

-- ===== Update academic_sessions RLS =====
DROP POLICY IF EXISTS "academic_sessions_insert_own" ON public.academic_sessions;
CREATE POLICY "academic_sessions_insert_admin" ON public.academic_sessions FOR INSERT
  TO authenticated WITH CHECK (public.get_user_role() IN ('super_admin','admin','principal'));

DROP POLICY IF EXISTS "academic_sessions_update_own" ON public.academic_sessions;
CREATE POLICY "academic_sessions_update_admin" ON public.academic_sessions FOR UPDATE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal'))
  WITH CHECK (public.get_user_role() IN ('super_admin','admin','principal'));

DROP POLICY IF EXISTS "academic_sessions_delete_own" ON public.academic_sessions;
CREATE POLICY "academic_sessions_delete_admin" ON public.academic_sessions FOR DELETE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal'));

-- ===== Update classes RLS =====
DROP POLICY IF EXISTS "classes_insert_own" ON public.classes;
CREATE POLICY "classes_insert_admin" ON public.classes FOR INSERT
  TO authenticated WITH CHECK (public.get_user_role() IN ('super_admin','admin','principal'));

DROP POLICY IF EXISTS "classes_update_own" ON public.classes;
CREATE POLICY "classes_update_admin" ON public.classes FOR UPDATE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal'))
  WITH CHECK (public.get_user_role() IN ('super_admin','admin','principal'));

DROP POLICY IF EXISTS "classes_delete_own" ON public.classes;
CREATE POLICY "classes_delete_admin" ON public.classes FOR DELETE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal'));

-- ===== Update sections RLS =====
DROP POLICY IF EXISTS "sections_insert_own" ON public.sections;
CREATE POLICY "sections_insert_admin" ON public.sections FOR INSERT
  TO authenticated WITH CHECK (public.get_user_role() IN ('super_admin','admin','principal'));

DROP POLICY IF EXISTS "sections_update_own" ON public.sections;
CREATE POLICY "sections_update_admin" ON public.sections FOR UPDATE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal'))
  WITH CHECK (public.get_user_role() IN ('super_admin','admin','principal'));

DROP POLICY IF EXISTS "sections_delete_own" ON public.sections;
CREATE POLICY "sections_delete_admin" ON public.sections FOR DELETE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal'));

-- ===== Update subjects RLS =====
DROP POLICY IF EXISTS "subjects_insert_own" ON public.subjects;
CREATE POLICY "subjects_insert_admin" ON public.subjects FOR INSERT
  TO authenticated WITH CHECK (public.get_user_role() IN ('super_admin','admin','principal'));

DROP POLICY IF EXISTS "subjects_update_own" ON public.subjects;
CREATE POLICY "subjects_update_admin" ON public.subjects FOR UPDATE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal'))
  WITH CHECK (public.get_user_role() IN ('super_admin','admin','principal'));

DROP POLICY IF EXISTS "subjects_delete_own" ON public.subjects;
CREATE POLICY "subjects_delete_admin" ON public.subjects FOR DELETE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal'));

-- ===== Update programs RLS =====
DROP POLICY IF EXISTS "programs_insert_own" ON public.programs;
CREATE POLICY "programs_insert_admin" ON public.programs FOR INSERT
  TO authenticated WITH CHECK (public.get_user_role() IN ('super_admin','admin'));

DROP POLICY IF EXISTS "programs_update_own" ON public.programs;
CREATE POLICY "programs_update_admin" ON public.programs FOR UPDATE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin'))
  WITH CHECK (public.get_user_role() IN ('super_admin','admin'));

DROP POLICY IF EXISTS "programs_delete_own" ON public.programs;
CREATE POLICY "programs_delete_admin" ON public.programs FOR DELETE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin'));

-- ===== Update settings RLS =====
DROP POLICY IF EXISTS "settings_update_own" ON public.settings;
CREATE POLICY "settings_update_admin" ON public.settings FOR UPDATE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin'))
  WITH CHECK (public.get_user_role() IN ('super_admin','admin'));

-- ===== Update attendance RLS =====
DROP POLICY IF EXISTS "attendance_insert_own" ON public.attendance;
CREATE POLICY "attendance_insert_staff" ON public.attendance FOR INSERT
  TO authenticated WITH CHECK (public.get_user_role() IN ('super_admin','admin','principal','teacher'));

DROP POLICY IF EXISTS "attendance_update_own" ON public.attendance;
CREATE POLICY "attendance_update_staff" ON public.attendance FOR UPDATE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal','teacher'))
  WITH CHECK (public.get_user_role() IN ('super_admin','admin','principal','teacher'));

DROP POLICY IF EXISTS "attendance_delete_own" ON public.attendance;
CREATE POLICY "attendance_delete_staff" ON public.attendance FOR DELETE
  TO authenticated USING (public.get_user_role() IN ('super_admin','admin','principal','teacher'));

-- ===== Update activities RLS =====
DROP POLICY IF EXISTS "activities_insert_own" ON public.activities;
CREATE POLICY "activities_insert_all" ON public.activities FOR INSERT
  TO authenticated WITH CHECK (true);
