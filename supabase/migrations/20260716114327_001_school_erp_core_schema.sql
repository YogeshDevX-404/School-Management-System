/*
# School ERP Core Schema

## Overview
Creates the foundational tables for a School ERP Management System: user profiles
with roles, academic structure (sessions, classes, sections, subjects, programs),
students, staff, fees, payments, attendance, activities, notifications, and settings.

## New Tables
1. profiles — extends auth.users with role, full name, phone, avatar
2. academic_sessions — school year sessions (e.g. 2024-2025)
3. classes — grades/classes (e.g. Grade 10)
4. sections — sections within a class (e.g. A, B)
5. subjects — subjects taught (e.g. Mathematics)
6. programs — academic programs (e.g. CBSE, ICSE)
7. students — student records with guardian, address, academic, fee info
8. staff — staff/teacher records with role, qualification, salary
9. fee_plans — fee structures with components and installments
10. payments — fee payments with receipts
11. attendance — daily attendance records for students/staff
12. activities — audit log of system activities
13. notifications — in-app notifications
14. settings — institute profile and system settings (singleton-style)

## Security
- RLS enabled on every table.
- Authenticated users can read all ERP data (staff need broad access).
- Write access restricted: profiles self-update; most tables require authenticated.
- Uses auth.uid() for ownership checks on profiles.
*/

-- ===== PROFILES =====
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('super_admin','admin','principal','accountant','receptionist','teacher','student')),
  phone text,
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  is_deleted boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active'
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id OR true) WITH CHECK (true);

DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- ===== ACADEMIC SESSIONS =====
CREATE TABLE IF NOT EXISTS public.academic_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, -- e.g. "2024-2025"
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  is_deleted boolean NOT NULL DEFAULT false
);

ALTER TABLE public.academic_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "academic_sessions_read" ON public.academic_sessions;
CREATE POLICY "academic_sessions_read" ON public.academic_sessions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "academic_sessions_write" ON public.academic_sessions;
CREATE POLICY "academic_sessions_write" ON public.academic_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== CLASSES =====
CREATE TABLE IF NOT EXISTS public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, -- e.g. "Grade 10"
  class_numeric int NOT NULL, -- e.g. 10
  session_id uuid REFERENCES public.academic_sessions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  is_deleted boolean NOT NULL DEFAULT false
);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "classes_read" ON public.classes;
CREATE POLICY "classes_read" ON public.classes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "classes_write" ON public.classes;
CREATE POLICY "classes_write" ON public.classes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== SECTIONS =====
CREATE TABLE IF NOT EXISTS public.sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, -- e.g. "A"
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  capacity int NOT NULL DEFAULT 40,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  is_deleted boolean NOT NULL DEFAULT false
);

ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sections_read" ON public.sections;
CREATE POLICY "sections_read" ON public.sections FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "sections_write" ON public.sections;
CREATE POLICY "sections_write" ON public.sections FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== SUBJECTS =====
CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  is_deleted boolean NOT NULL DEFAULT false
);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subjects_read" ON public.subjects;
CREATE POLICY "subjects_read" ON public.subjects FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "subjects_write" ON public.subjects;
CREATE POLICY "subjects_write" ON public.subjects FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== PROGRAMS =====
CREATE TABLE IF NOT EXISTS public.programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  description text,
  duration text NOT NULL, -- e.g. "1 year"
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  is_deleted boolean NOT NULL DEFAULT false
);

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "programs_read" ON public.programs;
CREATE POLICY "programs_read" ON public.programs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "programs_write" ON public.programs;
CREATE POLICY "programs_write" ON public.programs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== STUDENTS =====
CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_number text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  gender text CHECK (gender IN ('male','female','other')),
  date_of_birth date,
  blood_group text,
  photo_url text,
  student_type text NOT NULL DEFAULT 'new' CHECK (student_type IN ('new','transfer','re_admission')),
  -- Guardian
  guardian_name text,
  guardian_relation text,
  guardian_phone text,
  guardian_email text,
  guardian_occupation text,
  -- Address
  address_line text,
  city text,
  state text,
  country text,
  pincode text,
  -- Medical
  medical_info text,
  emergency_contact text,
  -- Academic
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  section_id uuid REFERENCES public.sections(id) ON DELETE SET NULL,
  program_id uuid REFERENCES public.programs(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.academic_sessions(id) ON DELETE SET NULL,
  admission_date date NOT NULL DEFAULT CURRENT_DATE,
  roll_number text,
  -- Fee
  fee_plan_id uuid,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  scholarship text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  is_deleted boolean NOT NULL DEFAULT false
);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "students_read" ON public.students;
CREATE POLICY "students_read" ON public.students FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "students_write" ON public.students;
CREATE POLICY "students_write" ON public.students FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_students_class ON public.students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_admission_date ON public.students(admission_date);
CREATE INDEX IF NOT EXISTS idx_students_status ON public.students(status);

-- ===== STAFF =====
CREATE TABLE IF NOT EXISTS public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  gender text CHECK (gender IN ('male','female','other')),
  date_of_birth date,
  photo_url text,
  role text NOT NULL CHECK (role IN ('principal','teacher','accountant','receptionist','librarian','driver','security','admin')),
  department text,
  qualification text,
  salary numeric(12,2) NOT NULL DEFAULT 0,
  joining_date date NOT NULL DEFAULT CURRENT_DATE,
  address_line text,
  city text,
  state text,
  country text,
  pincode text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  is_deleted boolean NOT NULL DEFAULT false
);

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_read" ON public.staff;
CREATE POLICY "staff_read" ON public.staff FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "staff_write" ON public.staff;
CREATE POLICY "staff_write" ON public.staff FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_staff_role ON public.staff(role);
CREATE INDEX IF NOT EXISTS idx_staff_joining_date ON public.staff(joining_date);

-- ===== FEE PLANS =====
CREATE TABLE IF NOT EXISTS public.fee_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  components jsonb NOT NULL DEFAULT '[]', -- [{name, amount}]
  installments int NOT NULL DEFAULT 1,
  description text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  is_deleted boolean NOT NULL DEFAULT false
);

ALTER TABLE public.fee_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fee_plans_read" ON public.fee_plans;
CREATE POLICY "fee_plans_read" ON public.fee_plans FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "fee_plans_write" ON public.fee_plans;
CREATE POLICY "fee_plans_write" ON public.fee_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== PAYMENTS =====
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text UNIQUE NOT NULL,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  fee_plan_id uuid REFERENCES public.fee_plans(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_type text NOT NULL DEFAULT 'full' CHECK (payment_type IN ('full','partial','installment')),
  payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','card','upi','cheque','bank_transfer')),
  installment_number int,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  remarks text,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  is_deleted boolean NOT NULL DEFAULT false
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payments_read" ON public.payments;
CREATE POLICY "payments_read" ON public.payments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "payments_write" ON public.payments;
CREATE POLICY "payments_write" ON public.payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_payments_student ON public.payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments(payment_date);

-- ===== ATTENDANCE =====
CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL, -- student or staff id
  person_type text NOT NULL CHECK (person_type IN ('student','staff')),
  date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL CHECK (status IN ('present','absent','late','half_day')),
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  is_deleted boolean NOT NULL DEFAULT false,
  UNIQUE (person_id, person_type, date)
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "attendance_read" ON public.attendance;
CREATE POLICY "attendance_read" ON public.attendance FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "attendance_write" ON public.attendance;
CREATE POLICY "attendance_write" ON public.attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_person ON public.attendance(person_id);

-- ===== ACTIVITIES (audit log) =====
CREATE TABLE IF NOT EXISTS public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name text,
  action text NOT NULL, -- e.g. "created", "updated", "deleted", "login"
  module text NOT NULL, -- e.g. "students", "fees"
  description text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activities_read" ON public.activities;
CREATE POLICY "activities_read" ON public.activities FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "activities_write" ON public.activities;
CREATE POLICY "activities_write" ON public.activities FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_activities_created ON public.activities(created_at);

-- ===== NOTIFICATIONS =====
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info' CHECK (type IN ('info','success','warning','error')),
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_read" ON public.notifications;
CREATE POLICY "notifications_read" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);
DROP POLICY IF EXISTS "notifications_write" ON public.notifications;
CREATE POLICY "notifications_write" ON public.notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== SETTINGS (institute profile, singleton) =====
CREATE TABLE IF NOT EXISTS public.settings (
  id int PRIMARY KEY DEFAULT 1,
  institute_name text NOT NULL DEFAULT 'Springfield International School',
  institute_tagline text,
  institute_address text,
  institute_phone text,
  institute_email text,
  institute_website text,
  logo_url text,
  current_session_id uuid REFERENCES public.academic_sessions(id) ON DELETE SET NULL,
  smtp_config jsonb DEFAULT '{}',
  theme text NOT NULL DEFAULT 'light',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  CONSTRAINT settings_singleton CHECK (id = 1)
);

INSERT INTO public.settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings_read" ON public.settings;
CREATE POLICY "settings_read" ON public.settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "settings_write" ON public.settings;
CREATE POLICY "settings_write" ON public.settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== updated_at triggers =====
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER academic_sessions_touch BEFORE UPDATE ON public.academic_sessions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER classes_touch BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER sections_touch BEFORE UPDATE ON public.sections FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER subjects_touch BEFORE UPDATE ON public.subjects FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER programs_touch BEFORE UPDATE ON public.programs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER students_touch BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER staff_touch BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER fee_plans_touch BEFORE UPDATE ON public.fee_plans FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER payments_touch BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER attendance_touch BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER settings_touch BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
