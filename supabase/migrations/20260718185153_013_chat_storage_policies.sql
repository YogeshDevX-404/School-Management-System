-- Storage policies for chat-attachments bucket
DROP POLICY IF EXISTS "chat_attach_read_all" ON storage.objects;
CREATE POLICY "chat_attach_read_all"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "chat_attach_insert_auth" ON storage.objects;
CREATE POLICY "chat_attach_insert_auth"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "chat_attach_update_own" ON storage.objects;
CREATE POLICY "chat_attach_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'chat-attachments' AND owner = auth.uid())
WITH CHECK (bucket_id = 'chat-attachments' AND owner = auth.uid());

DROP POLICY IF EXISTS "chat_attach_delete_own" ON storage.objects;
CREATE POLICY "chat_attach_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat-attachments' AND owner = auth.uid());