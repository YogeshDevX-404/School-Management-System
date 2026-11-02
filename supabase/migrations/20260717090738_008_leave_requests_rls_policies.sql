-- Drop all existing leave_requests policies and recreate with correct logic
DROP POLICY IF EXISTS "leave_insert_own" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_select_own_or_admin" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_update_own_or_admin" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_delete_admin" ON public.leave_requests;

-- INSERT: Teachers can insert only rows where user_id = auth.uid()
-- The DB DEFAULT on user_id fills it from the authenticated session,
-- so the frontend insert doesn't need to pass user_id.
CREATE POLICY "leave_insert_own"
ON public.leave_requests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- SELECT: Teachers see only their own; admin/principal see all
CREATE POLICY "leave_select_own_or_admin"
ON public.leave_requests FOR SELECT
TO authenticated
USING (
  get_user_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'principal'::text])
  OR auth.uid() = user_id
);

-- UPDATE: Teachers can update only their own PENDING requests.
-- Admin/principal can update (approve/reject) any request.
CREATE POLICY "leave_update_own_pending_or_admin"
ON public.leave_requests FOR UPDATE
TO authenticated
USING (
  get_user_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'principal'::text])
  OR (auth.uid() = user_id AND status = 'pending')
)
WITH CHECK (
  get_user_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'principal'::text])
  OR (auth.uid() = user_id AND status = 'pending')
);

-- DELETE: Only admin/principal can delete
CREATE POLICY "leave_delete_admin"
ON public.leave_requests FOR DELETE
TO authenticated
USING (
  get_user_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'principal'::text])
);