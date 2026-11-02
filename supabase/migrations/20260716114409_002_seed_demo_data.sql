/*
# Seed Demo Data

Populates academic_sessions, classes, sections, subjects, programs, fee_plans,
and a settings row so the dashboard and modules have meaningful content.
Does NOT create auth users (those are created via Supabase Auth signup).
*/

-- Academic sessions
INSERT INTO public.academic_sessions (name, start_date, end_date, is_current, status) VALUES
('2024-2025', '2024-04-01', '2025-03-31', false, 'inactive'),
('2025-2026', '2025-04-01', '2026-03-31', true, 'active')
ON CONFLICT DO NOTHING;

-- Programs
INSERT INTO public.programs (name, code, description, duration, status) VALUES
('CBSE Board', 'CBSE', 'Central Board of Secondary Education curriculum', '12 years', 'active'),
('ICSE Board', 'ICSE', 'Indian Certificate of Secondary Education', '10 years', 'active'),
('State Board', 'STATE', 'State government curriculum', '10 years', 'active'),
('International Baccalaureate', 'IB', 'IB Diploma Programme', '2 years', 'active')
ON CONFLICT DO NOTHING;

-- Classes (for current session)
DO $$
DECLARE
  sess uuid;
BEGIN
  SELECT id INTO sess FROM public.academic_sessions WHERE is_current = true LIMIT 1;
  INSERT INTO public.classes (name, class_numeric, session_id, status) VALUES
  ('Grade 6', 6, sess, 'active'),
  ('Grade 7', 7, sess, 'active'),
  ('Grade 8', 8, sess, 'active'),
  ('Grade 9', 9, sess, 'active'),
  ('Grade 10', 10, sess, 'active'),
  ('Grade 11', 11, sess, 'active'),
  ('Grade 12', 12, sess, 'active')
  ON CONFLICT DO NOTHING;
END $$;

-- Sections for each class
INSERT INTO public.sections (name, class_id, capacity, status)
SELECT s.name, c.id, 40, 'active'
FROM public.classes c
CROSS JOIN (VALUES ('A'), ('B'), ('C')) AS s(name)
WHERE NOT EXISTS (SELECT 1 FROM public.sections sec WHERE sec.class_id = c.id AND sec.name = s.name);

-- Subjects
INSERT INTO public.subjects (name, code, class_id, status) VALUES
('Mathematics', 'MATH', NULL, 'active'),
('Science', 'SCI', NULL, 'active'),
('English', 'ENG', NULL, 'active'),
('Social Studies', 'SOC', NULL, 'active'),
('Physics', 'PHY', NULL, 'active'),
('Chemistry', 'CHE', NULL, 'active'),
('Biology', 'BIO', NULL, 'active'),
('Computer Science', 'CS', NULL, 'active'),
('Hindi', 'HIN', NULL, 'active'),
('Physical Education', 'PE', NULL, 'active')
ON CONFLICT DO NOTHING;

-- Fee plans
INSERT INTO public.fee_plans (name, code, class_id, total_amount, components, installments, description, status) VALUES
('Standard Plan', 'STD-6', (SELECT id FROM public.classes WHERE class_numeric=6 LIMIT 1), 45000, '[{"name":"Tuition","amount":30000},{"name":"Library","amount":5000},{"name":"Lab","amount":5000},{"name":"Sports","amount":5000}]'::jsonb, 4, 'Annual fee plan for Grade 6', 'active'),
('Standard Plan', 'STD-7', (SELECT id FROM public.classes WHERE class_numeric=7 LIMIT 1), 48000, '[{"name":"Tuition","amount":32000},{"name":"Library","amount":5000},{"name":"Lab","amount":6000},{"name":"Sports","amount":5000}]'::jsonb, 4, 'Annual fee plan for Grade 7', 'active'),
('Standard Plan', 'STD-8', (SELECT id FROM public.classes WHERE class_numeric=8 LIMIT 1), 52000, '[{"name":"Tuition","amount":35000},{"name":"Library","amount":6000},{"name":"Lab","amount":6000},{"name":"Sports","amount":5000}]'::jsonb, 4, 'Annual fee plan for Grade 8', 'active'),
('Standard Plan', 'STD-9', (SELECT id FROM public.classes WHERE class_numeric=9 LIMIT 1), 58000, '[{"name":"Tuition","amount":40000},{"name":"Library","amount":6000},{"name":"Lab","amount":7000},{"name":"Sports","amount":5000}]'::jsonb, 4, 'Annual fee plan for Grade 9', 'active'),
('Standard Plan', 'STD-10', (SELECT id FROM public.classes WHERE class_numeric=10 LIMIT 1), 65000, '[{"name":"Tuition","amount":45000},{"name":"Library","amount":7000},{"name":"Lab","amount":8000},{"name":"Sports","amount":5000}]'::jsonb, 4, 'Annual fee plan for Grade 10', 'active'),
('Premium Plan', 'PRM-11', (SELECT id FROM public.classes WHERE class_numeric=11 LIMIT 1), 75000, '[{"name":"Tuition","amount":55000},{"name":"Library","amount":8000},{"name":"Lab","amount":8000},{"name":"Sports","amount":4000}]'::jsonb, 4, 'Premium plan for Grade 11', 'active'),
('Premium Plan', 'PRM-12', (SELECT id FROM public.classes WHERE class_numeric=12 LIMIT 1), 82000, '[{"name":"Tuition","amount":60000},{"name":"Library","amount":9000},{"name":"Lab","amount":9000},{"name":"Sports","amount":4000}]'::jsonb, 4, 'Premium plan for Grade 12', 'active')
ON CONFLICT DO NOTHING;

-- Staff
INSERT INTO public.staff (employee_number, first_name, last_name, email, phone, gender, role, department, qualification, salary, joining_date, status) VALUES
('EMP001', 'Rajesh', 'Kumar', 'rajesh.kumar@school.edu', '+919876543210', 'male', 'principal', 'Administration', 'Ph.D. Education', 120000, '2020-06-01', 'active'),
('EMP002', 'Priya', 'Sharma', 'priya.sharma@school.edu', '+919876543211', 'female', 'teacher', 'Mathematics', 'M.Sc. Mathematics', 55000, '2021-07-15', 'active'),
('EMP003', 'Amit', 'Verma', 'amit.verma@school.edu', '+919876543212', 'male', 'teacher', 'Science', 'M.Sc. Physics', 58000, '2021-08-01', 'active'),
('EMP004', 'Sneha', 'Patel', 'sneha.patel@school.edu', '+919876543213', 'female', 'teacher', 'English', 'M.A. English', 52000, '2022-04-10', 'active'),
('EMP005', 'Vikram', 'Singh', 'vikram.singh@school.edu', '+919876543214', 'male', 'accountant', 'Finance', 'M.Com', 48000, '2020-03-15', 'active'),
('EMP006', 'Anita', 'Reddy', 'anita.reddy@school.edu', '+919876543215', 'female', 'receptionist', 'Front Office', 'B.A.', 28000, '2023-01-20', 'active'),
('EMP007', 'Mohammed', 'Ali', 'mohammed.ali@school.edu', '+919876543216', 'male', 'librarian', 'Library', 'B.Lib', 35000, '2019-09-01', 'active'),
('EMP008', 'Suresh', 'Yadav', 'suresh.yadav@school.edu', '+919876543217', 'male', 'driver', 'Transport', '10th Pass', 22000, '2022-05-10', 'active'),
('EMP009', 'Lakshmi', 'Nair', 'lakshmi.nair@school.edu', '+919876543218', 'female', 'teacher', 'Computer Science', 'MCA', 60000, '2021-06-15', 'active'),
('EMP010', 'Deepak', 'Mehta', 'deepak.mehta@school.edu', '+919876543219', 'male', 'security', 'Security', '12th Pass', 18000, '2023-02-01', 'active')
ON CONFLICT DO NOTHING;

-- Students (sample, varied admission dates for trend charts)
DO $$
DECLARE
  sess uuid;
  cls6 uuid; cls7 uuid; cls8 uuid; cls9 uuid; cls10 uuid;
  sec6a uuid; sec6b uuid; sec7a uuid; sec8a uuid; sec9a uuid; sec10a uuid;
  fp6 uuid; fp7 uuid; fp8 uuid; fp9 uuid; fp10 uuid;
  prog uuid;
  d date;
  i int;
  first_names text[] := ARRAY['Aarav','Vivaan','Aditya','Ananya','Diya','Sai','Arjun','Reyansh','Krishna','Ishaan','Aanya','Kabir','Myra','Riya','Aryan','Neha','Rohan','Pooja','Karan','Meera'];
  last_names text[] := ARRAY['Gupta','Malhotra','Joshi','Bose','Rao','Nair','Iyer','Kapoor','Chopra','Bhat','Menon','Das','Pillai','Saxena','Trivedi'];
BEGIN
  SELECT id INTO sess FROM public.academic_sessions WHERE is_current = true LIMIT 1;
  SELECT id INTO prog FROM public.programs LIMIT 1;
  SELECT id INTO cls6 FROM public.classes WHERE class_numeric=6 LIMIT 1;
  SELECT id INTO cls7 FROM public.classes WHERE class_numeric=7 LIMIT 1;
  SELECT id INTO cls8 FROM public.classes WHERE class_numeric=8 LIMIT 1;
  SELECT id INTO cls9 FROM public.classes WHERE class_numeric=9 LIMIT 1;
  SELECT id INTO cls10 FROM public.classes WHERE class_numeric=10 LIMIT 1;
  SELECT id INTO sec6a FROM public.sections WHERE class_id=cls6 AND name='A' LIMIT 1;
  SELECT id INTO sec6b FROM public.sections WHERE class_id=cls6 AND name='B' LIMIT 1;
  SELECT id INTO sec7a FROM public.sections WHERE class_id=cls7 AND name='A' LIMIT 1;
  SELECT id INTO sec8a FROM public.sections WHERE class_id=cls8 AND name='A' LIMIT 1;
  SELECT id INTO sec9a FROM public.sections WHERE class_id=cls9 AND name='A' LIMIT 1;
  SELECT id INTO sec10a FROM public.sections WHERE class_id=cls10 AND name='A' LIMIT 1;
  SELECT id INTO fp6 FROM public.fee_plans WHERE code='STD-6' LIMIT 1;
  SELECT id INTO fp7 FROM public.fee_plans WHERE code='STD-7' LIMIT 1;
  SELECT id INTO fp8 FROM public.fee_plans WHERE code='STD-8' LIMIT 1;
  SELECT id INTO fp9 FROM public.fee_plans WHERE code='STD-9' LIMIT 1;
  SELECT id INTO fp10 FROM public.fee_plans WHERE code='STD-10' LIMIT 1;

  FOR i IN 1..40 LOOP
    d := CURRENT_DATE - (random() * 240)::int;
    INSERT INTO public.students (
      admission_number, first_name, last_name, email, phone, gender,
      date_of_birth, student_type, guardian_name, guardian_relation, guardian_phone,
      guardian_occupation, address_line, city, state, country, pincode,
      class_id, section_id, program_id, session_id, admission_date, roll_number,
      fee_plan_id, discount_amount, status
    ) VALUES (
      'ADM' || lpad(i::text, 4, '0'),
      first_names[1 + (i % array_length(first_names,1))],
      last_names[1 + ((i*3) % array_length(last_names,1))],
      'student' || i || '@school.edu',
      '+9198' || lpad((10000000 + i)::text, 8, '0'),
      CASE WHEN i % 2 = 0 THEN 'male' ELSE 'female' END,
      (CURRENT_DATE - (15*365 + (random()*1095)::int))::date,
      CASE WHEN i % 5 = 0 THEN 'transfer' ELSE 'new' END,
      'Parent ' || first_names[1 + (i % array_length(first_names,1))],
      CASE WHEN i % 3 = 0 THEN 'Mother' ELSE 'Father' END,
      '+9198' || lpad((20000000 + i)::text, 8, '0'),
      CASE WHEN i % 4 = 0 THEN 'Business' WHEN i % 4 = 1 THEN 'Service' WHEN i % 4 = 2 THEN 'Doctor' ELSE 'Engineer' END,
      'House ' || i || ', Sector ' || (i % 20),
      'Springfield', 'Maharashtra', 'India', '411001',
      CASE WHEN i % 5 = 0 THEN cls10 WHEN i % 5 = 1 THEN cls9 WHEN i % 5 = 2 THEN cls8 WHEN i % 5 = 3 THEN cls7 ELSE cls6 END,
      CASE WHEN i % 5 = 0 THEN sec10a WHEN i % 5 = 1 THEN sec9a WHEN i % 5 = 2 THEN sec8a WHEN i % 5 = 3 THEN sec7a ELSE (CASE WHEN i % 2 = 0 THEN sec6a ELSE sec6b END) END,
      prog, sess, d, 'R' || lpad(i::text, 3, '0'),
      CASE WHEN i % 5 = 0 THEN fp10 WHEN i % 5 = 1 THEN fp9 WHEN i % 5 = 2 THEN fp8 WHEN i % 5 = 3 THEN fp7 ELSE fp6 END,
      (i % 5) * 2000,
      'active'
    ) ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Payments (sample for charts)
DO $$
DECLARE
  s record;
  amt numeric;
  methods text[] := ARRAY['cash','card','upi','cheque','bank_transfer'];
  i int := 0;
BEGIN
  FOR s IN SELECT id, fee_plan_id FROM public.students WHERE is_deleted=false LOOP
    i := i + 1;
    amt := 5000 + (random() * 40000)::int;
    INSERT INTO public.payments (receipt_number, student_id, fee_plan_id, amount, payment_type, payment_method, payment_date, remarks, status)
    VALUES (
      'RCPT' || lpad(i::text, 5, '0'),
      s.id, s.fee_plan_id, amt,
      CASE WHEN amt > 30000 THEN 'full' ELSE 'partial' END,
      methods[1 + (i % array_length(methods,1))],
      (CURRENT_DATE - (random() * 120)::int)::date,
      'Fee collection',
      'completed'
    ) ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Activities
INSERT INTO public.activities (user_name, action, module, description) VALUES
('System', 'initialized', 'system', 'School ERP system initialized with demo data'),
('Priya Sharma', 'created', 'attendance', 'Marked attendance for Grade 10 - Section A'),
('Vikram Singh', 'collected', 'fees', 'Collected fee payment from Aarav Gupta'),
('Anita Reddy', 'admitted', 'students', 'New admission: Diya Bose - Grade 8'),
('Rajesh Kumar', 'updated', 'settings', 'Updated institute profile settings')
ON CONFLICT DO NOTHING;
