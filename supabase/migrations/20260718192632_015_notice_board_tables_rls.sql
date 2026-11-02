-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  author_role text NOT NULL,
  author_avatar text,
  attachment_url text,
  attachment_name text,
  attachment_type text CHECK (attachment_type IS NULL OR attachment_type IN ('image','pdf','word','excel','file')),
  publish_date timestamptz NOT NULL DEFAULT now(),
  expiry_date timestamptz,
  is_published boolean NOT NULL DEFAULT true,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notice_audience (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id uuid NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('all','super_admin','admin','principal','teacher','accountant','student')),
  UNIQUE (notice_id, role)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_notices_published ON public.notices(is_published, is_deleted, publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_notices_created_by ON public.notices(created_by);
CREATE INDEX IF NOT EXISTS idx_notice_audience_notice ON public.notice_audience(notice_id);
CREATE INDEX IF NOT EXISTS idx_notice_audience_role ON public.notice_audience(role);

-- ============================================================
-- HELPER: get visible notices for current user
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_visible_notices()
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  priority text,
  created_by uuid,
  author_name text,
  author_role text,
  author_avatar text,
  attachment_url text,
  attachment_name text,
  attachment_type text,
  publish_date timestamptz,
  expiry_date timestamptz,
  is_published boolean,
  created_at timestamptz,
  updated_at timestamptz
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

  RETURN QUERY
  SELECT n.id, n.title, n.description, n.priority, n.created_by,
         n.author_name, n.author_role, n.author_avatar,
         n.attachment_url, n.attachment_name, n.attachment_type,
         n.publish_date, n.expiry_date, n.is_published,
         n.created_at, n.updated_at
  FROM public.notices n
  WHERE n.is_published = true
    AND n.is_deleted = false
    AND n.publish_date <= now()
    AND (n.expiry_date IS NULL OR n.expiry_date > now())
    AND EXISTS (
      SELECT 1 FROM public.notice_audience na
      WHERE na.notice_id = n.id
        AND (na.role = 'all' OR na.role = my_role)
    )
  ORDER BY n.publish_date DESC;
END;
$$;

-- ============================================================
-- HELPER: is admin/principal (can manage notices)
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_manage_notices()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT get_user_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'principal'::text]);
$$;

-- ============================================================
-- RLS: Enable
-- ============================================================
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notice_audience ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- notices RLS
-- ============================================================
DROP POLICY IF EXISTS "notices_select_visible" ON public.notices;
CREATE POLICY "notices_select_visible"
ON public.notices FOR SELECT
TO authenticated
USING (
  public.can_manage_notices()
  OR id IN (SELECT v.id FROM public.get_visible_notices() v)
);

DROP POLICY IF EXISTS "notices_insert_manager" ON public.notices;
CREATE POLICY "notices_insert_manager"
ON public.notices FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_notices());

DROP POLICY IF EXISTS "notices_update_manager" ON public.notices;
CREATE POLICY "notices_update_manager"
ON public.notices FOR UPDATE
TO authenticated
USING (public.can_manage_notices())
WITH CHECK (public.can_manage_notices());

DROP POLICY IF EXISTS "notices_delete_manager" ON public.notices;
CREATE POLICY "notices_delete_manager"
ON public.notices FOR DELETE
TO authenticated
USING (public.can_manage_notices());

-- ============================================================
-- notice_audience RLS
-- ============================================================
DROP POLICY IF EXISTS "na_select_visible" ON public.notice_audience;
CREATE POLICY "na_select_visible"
ON public.notice_audience FOR SELECT
TO authenticated
USING (
  public.can_manage_notices()
  OR notice_id IN (SELECT v.id FROM public.get_visible_notices() v)
);

DROP POLICY IF EXISTS "na_insert_manager" ON public.notice_audience;
CREATE POLICY "na_insert_manager"
ON public.notice_audience FOR INSERT
TO authenticated
WITH CHECK (
  public.can_manage_notices()
  AND notice_id IN (SELECT n.id FROM public.notices n WHERE n.created_by = auth.uid())
);

DROP POLICY IF EXISTS "na_delete_manager" ON public.notice_audience;
CREATE POLICY "na_delete_manager"
ON public.notice_audience FOR DELETE
TO authenticated
USING (
  public.can_manage_notices()
  AND notice_id IN (SELECT n.id FROM public.notices n WHERE n.created_by = auth.uid())
);

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.notices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notice_audience;

-- ============================================================
-- STORAGE BUCKET
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('notice-attachments', 'notice-attachments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "notice_attach_read_all" ON storage.objects;
CREATE POLICY "notice_attach_read_all"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'notice-attachments');

DROP POLICY IF EXISTS "notice_attach_insert_auth" ON storage.objects;
CREATE POLICY "notice_attach_insert_auth"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'notice-attachments');

DROP POLICY IF EXISTS "notice_attach_delete_own" ON storage.objects;
CREATE POLICY "notice_attach_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'notice-attachments' AND owner = auth.uid());