-- ============================================================
-- TABLES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New Chat',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.ai_chats(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  intent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_chats_user ON public.ai_chats(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_chat ON public.ai_messages(chat_id, created_at);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.ai_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_chats_select_own" ON public.ai_chats;
CREATE POLICY "ai_chats_select_own" ON public.ai_chats FOR SELECT
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "ai_chats_insert_own" ON public.ai_chats;
CREATE POLICY "ai_chats_insert_own" ON public.ai_chats FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "ai_chats_update_own" ON public.ai_chats;
CREATE POLICY "ai_chats_update_own" ON public.ai_chats FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "ai_chats_delete_own" ON public.ai_chats;
CREATE POLICY "ai_chats_delete_own" ON public.ai_chats FOR DELETE
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "ai_msgs_select_own" ON public.ai_messages;
CREATE POLICY "ai_msgs_select_own" ON public.ai_messages FOR SELECT
  TO authenticated USING (
    chat_id IN (SELECT c.id FROM public.ai_chats c WHERE c.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "ai_msgs_insert_own" ON public.ai_messages;
CREATE POLICY "ai_msgs_insert_own" ON public.ai_messages FOR INSERT
  TO authenticated WITH CHECK (
    chat_id IN (SELECT c.id FROM public.ai_chats c WHERE c.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "ai_msgs_delete_own" ON public.ai_messages;
CREATE POLICY "ai_msgs_delete_own" ON public.ai_messages FOR DELETE
  TO authenticated USING (
    chat_id IN (SELECT c.id FROM public.ai_chats c WHERE c.user_id = auth.uid())
  );