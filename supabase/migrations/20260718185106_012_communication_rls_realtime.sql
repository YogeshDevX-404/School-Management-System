-- ============================================================
-- RLS: Enable on all tables
-- ============================================================
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- conversations RLS
-- ============================================================
DROP POLICY IF EXISTS "conv_select_participant" ON public.conversations;
CREATE POLICY "conv_select_participant"
ON public.conversations FOR SELECT
TO authenticated
USING (public.is_conversation_participant(id, auth.uid()));

DROP POLICY IF EXISTS "conv_insert_creator" ON public.conversations;
CREATE POLICY "conv_insert_creator"
ON public.conversations FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "conv_update_participant" ON public.conversations;
CREATE POLICY "conv_update_participant"
ON public.conversations FOR UPDATE
TO authenticated
USING (public.is_conversation_participant(id, auth.uid()))
WITH CHECK (public.is_conversation_participant(id, auth.uid()));

-- ============================================================
-- conversation_participants RLS
-- ============================================================
DROP POLICY IF EXISTS "cp_select_participant" ON public.conversation_participants;
CREATE POLICY "cp_select_participant"
ON public.conversation_participants FOR SELECT
TO authenticated
USING (
  conversation_id IN (
    SELECT cp2.conversation_id FROM public.conversation_participants cp2
    WHERE cp2.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "cp_insert_own" ON public.conversation_participants;
CREATE POLICY "cp_insert_own"
ON public.conversation_participants FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- ============================================================
-- messages RLS
-- ============================================================
DROP POLICY IF EXISTS "msg_select_participant" ON public.messages;
CREATE POLICY "msg_select_participant"
ON public.messages FOR SELECT
TO authenticated
USING (public.is_conversation_participant(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "msg_insert_sender" ON public.messages;
CREATE POLICY "msg_insert_sender"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND public.is_conversation_participant(conversation_id, auth.uid())
);

DROP POLICY IF EXISTS "msg_delete_sender" ON public.messages;
CREATE POLICY "msg_delete_sender"
ON public.messages FOR DELETE
TO authenticated
USING (sender_id = auth.uid());

-- ============================================================
-- message_status RLS
-- ============================================================
DROP POLICY IF EXISTS "ms_select_recipient" ON public.message_status;
CREATE POLICY "ms_select_recipient"
ON public.message_status FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR message_id IN (
    SELECT m.id FROM public.messages m WHERE m.sender_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "ms_insert_sender" ON public.message_status;
CREATE POLICY "ms_insert_sender"
ON public.message_status FOR INSERT
TO authenticated
WITH CHECK (
  user_id != auth.uid()
  AND message_id IN (
    SELECT m.id FROM public.messages m WHERE m.sender_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "ms_update_recipient" ON public.message_status;
CREATE POLICY "ms_update_recipient"
ON public.message_status FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ============================================================
-- user_presence RLS
-- ============================================================
DROP POLICY IF EXISTS "presence_select_all" ON public.user_presence;
CREATE POLICY "presence_select_all"
ON public.user_presence FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "presence_insert_own" ON public.user_presence;
CREATE POLICY "presence_insert_own"
ON public.user_presence FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "presence_update_own" ON public.user_presence;
CREATE POLICY "presence_update_own"
ON public.user_presence FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ============================================================
-- REALTIME: enable publication on all tables
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;