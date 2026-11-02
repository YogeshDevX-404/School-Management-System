-- Add user_id column with DEFAULT auth.uid()
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leave_requests' AND column_name = 'user_id') THEN
    ALTER TABLE public.leave_requests ADD COLUMN user_id uuid;
  END IF;
END $$;

-- Backfill existing rows: set user_id from staff.user_id via teacher_id
UPDATE public.leave_requests lr
SET user_id = s.user_id
FROM public.staff s
WHERE lr.teacher_id = s.id AND lr.user_id IS NULL AND s.user_id IS NOT NULL;

-- Now make it NOT NULL with DEFAULT auth.uid()
ALTER TABLE public.leave_requests ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.leave_requests ALTER COLUMN user_id SET NOT NULL;

-- Add FK constraint for user_id -> auth.users
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_leave_requests_user_id' AND table_name = 'leave_requests'
  ) THEN
    ALTER TABLE public.leave_requests
      ADD CONSTRAINT fk_leave_requests_user_id
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add created_by column with DEFAULT auth.uid()
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leave_requests' AND column_name = 'created_by') THEN
    ALTER TABLE public.leave_requests ADD COLUMN created_by uuid;
  END IF;
END $$;

-- Backfill created_by from user_id
UPDATE public.leave_requests SET created_by = user_id WHERE created_by IS NULL;

ALTER TABLE public.leave_requests ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.leave_requests ALTER COLUMN created_by SET NOT NULL;

-- Add FK constraint for created_by -> auth.users
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_leave_requests_created_by' AND table_name = 'leave_requests'
  ) THEN
    ALTER TABLE public.leave_requests
      ADD CONSTRAINT fk_leave_requests_created_by
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Fix reviewed_by FK: drop old broken constraint, add correct one
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'leave_requests_reviewed_by_fkey' AND table_name = 'leave_requests'
  ) THEN
    ALTER TABLE public.leave_requests DROP CONSTRAINT leave_requests_reviewed_by_fkey;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_leave_requests_reviewed_by' AND table_name = 'leave_requests'
  ) THEN
    ALTER TABLE public.leave_requests
      ADD CONSTRAINT fk_leave_requests_reviewed_by
      FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add index on staff.user_id for fast policy subqueries
CREATE INDEX IF NOT EXISTS idx_staff_user_id ON public.staff(user_id);

-- Add index on leave_requests.user_id for fast owner-filtered queries
CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON public.leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);