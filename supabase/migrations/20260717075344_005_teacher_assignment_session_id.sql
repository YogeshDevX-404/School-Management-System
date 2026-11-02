-- Add session_id to teacher_class_assignments
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teacher_class_assignments' AND column_name = 'session_id') THEN
    ALTER TABLE public.teacher_class_assignments ADD COLUMN session_id uuid REFERENCES public.academic_sessions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add priority column to notifications (for Medium/High/Low)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'priority') THEN
    ALTER TABLE public.notifications ADD COLUMN priority text DEFAULT 'medium' CHECK (priority IN ('low','medium','high'));
  END IF;
END $$;

-- Add status column to notifications (for Pending/Approved/Rejected context)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'status') THEN
    ALTER TABLE public.notifications ADD COLUMN status text DEFAULT 'unread' CHECK (status IN ('unread','read','pending','approved','rejected'));
  END IF;
END $$;
