-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'direct' CHECK (type IN ('direct','group')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_message_id uuid,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  body text,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','image','pdf','word','excel','file')),
  attachment_url text,
  attachment_name text,
  attachment_size bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.message_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','delivered','read')),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_online boolean NOT NULL DEFAULT false,
  last_seen timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_conversations_last_at ON public.conversations(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_participants_user ON public.conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_conv ON public.conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON public.messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_message_status_user ON public.message_status(user_id, status);
CREATE INDEX IF NOT EXISTS idx_message_status_message ON public.message_status(message_id);

-- ============================================================
-- HELPER: is participant check
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_conversation_participant(conv_id uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = conv_id AND user_id = uid
  );
$$;

-- ============================================================
-- HELPER: role-based chat contact visibility
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_chat_contacts()
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  role text,
  avatar_url text,
  department text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  my_role text;
BEGIN
  SELECT p.role INTO my_role FROM public.profiles p WHERE p.id = auth.uid();
  IF my_role IS NULL THEN RETURN; END IF;

  IF my_role IN ('admin','super_admin') THEN
    RETURN QUERY
    SELECT p.id, p.full_name, p.email, p.role, p.avatar_url, s.department
    FROM public.profiles p
    LEFT JOIN public.staff s ON s.user_id = p.id
    WHERE p.id != auth.uid() AND p.is_active = true AND p.is_deleted = false
      AND p.role IN ('principal','teacher','accountant','admin','super_admin');
  ELSIF my_role = 'principal' THEN
    RETURN QUERY
    SELECT p.id, p.full_name, p.email, p.role, p.avatar_url, s.department
    FROM public.profiles p
    LEFT JOIN public.staff s ON s.user_id = p.id
    WHERE p.id != auth.uid() AND p.is_active = true AND p.is_deleted = false
      AND p.role IN ('admin','super_admin','teacher','accountant');
  ELSIF my_role = 'teacher' THEN
    RETURN QUERY
    SELECT p.id, p.full_name, p.email, p.role, p.avatar_url, s.department
    FROM public.profiles p
    LEFT JOIN public.staff s ON s.user_id = p.id
    WHERE p.id != auth.uid() AND p.is_active = true AND p.is_deleted = false
      AND p.role IN ('admin','super_admin','principal','teacher');
  ELSIF my_role = 'accountant' THEN
    RETURN QUERY
    SELECT p.id, p.full_name, p.email, p.role, p.avatar_url, s.department
    FROM public.profiles p
    LEFT JOIN public.staff s ON s.user_id = p.id
    WHERE p.id != auth.uid() AND p.is_active = true AND p.is_deleted = false
      AND p.role IN ('admin','super_admin','principal');
  END IF;
  RETURN;
END;
$$;

-- ============================================================
-- HELPER: get or create a direct conversation
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv_id uuid;
  my_role text;
  other_role text;
  allowed boolean := false;
BEGIN
  IF other_user_id IS NULL OR other_user_id = auth.uid() THEN RETURN NULL; END IF;

  SELECT role INTO my_role FROM public.profiles WHERE id = auth.uid();
  SELECT role INTO other_role FROM public.profiles WHERE id = other_user_id;
  IF my_role IS NULL OR other_role IS NULL THEN RETURN NULL; END IF;

  -- Enforce role-based visibility
  allowed := CASE my_role
    WHEN 'admin' THEN other_role IN ('principal','teacher','accountant','admin','super_admin')
    WHEN 'super_admin' THEN other_role IN ('principal','teacher','accountant','admin','super_admin')
    WHEN 'principal' THEN other_role IN ('admin','super_admin','teacher','accountant')
    WHEN 'teacher' THEN other_role IN ('admin','super_admin','principal','teacher')
    WHEN 'accountant' THEN other_role IN ('admin','super_admin','principal')
    ELSE false
  END;
  IF NOT allowed THEN RETURN NULL; END IF;

  -- Find existing direct conversation with both users
  SELECT c.id INTO conv_id
  FROM public.conversations c
  WHERE c.type = 'direct'
    AND c.id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid())
    AND c.id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = other_user_id)
    AND (
      SELECT count(*) FROM public.conversation_participants cp WHERE cp.conversation_id = c.id
    ) = 2
  LIMIT 1;

  IF conv_id IS NOT NULL THEN RETURN conv_id; END IF;

  -- Create new
  INSERT INTO public.conversations (type, created_by)
  VALUES ('direct', auth.uid())
  RETURNING id INTO conv_id;

  INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES
    (conv_id, auth.uid()),
    (conv_id, other_user_id);

  RETURN conv_id;
END;
$$;

-- ============================================================
-- HELPER: mark conversation messages as read
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_messages_read(conv_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_conversation_participant(conv_id, auth.uid()) THEN RETURN; END IF;

  UPDATE public.message_status
  SET status = 'read', read_at = now(), updated_at = now()
  WHERE user_id = auth.uid()
    AND status != 'read'
    AND message_id IN (
      SELECT m.id FROM public.messages m WHERE m.conversation_id = conv_id
    );
END;
$$;

-- ============================================================
-- HELPER: get unread message count for current user
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_unread_message_count()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT count(*)::int FROM public.message_status
  WHERE user_id = auth.uid() AND status != 'read';
$$;