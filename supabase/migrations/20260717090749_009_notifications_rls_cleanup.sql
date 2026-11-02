-- Clean up notifications policies: remove redundant/dangerous ones
DROP POLICY IF EXISTS "notifications_write" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_read" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_all" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete_admin" ON public.notifications;

-- SELECT: user sees own + broadcast (user_id IS NULL)
CREATE POLICY "notifications_select_own_or_broadcast"
ON public.notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR user_id IS NULL);

-- INSERT: any authenticated user can create notifications
-- (needed so teachers can create broadcast notifications for admin/principal)
CREATE POLICY "notifications_insert_authenticated"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (true);

-- UPDATE: user can mark their own notifications as read;
-- admin/principal can update any (for mark-all-read on broadcasts)
CREATE POLICY "notifications_update_own_or_admin"
ON public.notifications FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR get_user_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'principal'::text])
)
WITH CHECK (
  auth.uid() = user_id
  OR get_user_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'principal'::text])
);

-- DELETE: admin only
CREATE POLICY "notifications_delete_admin"
ON public.notifications FOR DELETE
TO authenticated
USING (
  get_user_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'principal'::text])
);