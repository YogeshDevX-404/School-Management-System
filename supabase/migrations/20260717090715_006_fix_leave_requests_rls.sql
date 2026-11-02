/*
# Fix leave_requests RLS, add user_id/created_by, fix reviewed_by FK

## Problem
Teachers get "new row violates row-level security policy for table leave_requests"
when submitting leave requests. Root causes:
1. Table has NO user_id column — the requirement is user_id = auth.uid() but the
   column doesn't exist, so the INSERT policy relies on a fragile subquery to staff.
2. Table has NO created_by column — requirement asks created_by = auth.uid().
3. reviewed_by FK constraint is broken (references null table).
4. UPDATE policy doesn't restrict teachers to pending-only requests.
5. No index on staff.user_id — the policy subquery is slow.

## Changes

### 1. New columns on leave_requests
- user_id (uuid, NOT NULL, DEFAULT auth.uid()) — the authenticated user who created
  the request. The DEFAULT ensures inserts that omit user_id still satisfy the
  INSERT WITH CHECK (auth.uid() = user_id) policy.
- created_by (uuid, NOT NULL, DEFAULT auth.uid()) — audit trail of who created the row.

### 2. Fixed foreign keys
- reviewed_by now properly REFERENCES auth.users(id) ON DELETE SET NULL.
- user_id REFERENCES auth.users(id) ON DELETE CASCADE.
- created_by REFERENCES auth.users(id) ON DELETE SET NULL.

### 3. Index
- idx_staff_user_id on staff(user_id) for fast policy subqueries.

### 4. RLS policies (all 4 verbs, TO authenticated)

  INSERT (leave_insert_own):
    WITH CHECK (auth.uid() = user_id)
    — Teachers can only insert rows where user_id = auth.uid().
    The DB DEFAULT on user_id means the frontend insert doesn't need to pass it.

  SELECT (leave_select_own_or_admin):
    USING (get_user_role() IN ('super_admin','admin','principal')
           OR auth.uid() = user_id)
    — Teachers see only their own; admin/principal see all.

  UPDATE (leave_update_own_pending_or_admin):
    USING (get_user_role() IN ('super_admin','admin','principal')
           OR (auth.uid() = user_id AND status = 'pending'))
    WITH CHECK (get_user_role() IN ('super_admin','admin','principal')
           OR (auth.uid() = user_id AND status = 'pending'))
    — Teachers can update only their own PENDING requests.
    — Admin/principal can approve/reject any request.

  DELETE (leave_delete_admin):
    USING (get_user_role() IN ('super_admin','admin','principal'))
    — Only admin/principal can delete.

### 5. Notifications policies cleanup
  Removed redundant/dangerous policies (notifications_write FOR ALL, duplicate
  notifications_select_own). Kept clean set:
  - SELECT: auth.uid() = user_id OR user_id IS NULL (own + broadcast)
  - INSERT: WITH CHECK (true) — any authenticated user can create notifications
  - UPDATE: auth.uid() = user_id (mark own as read)
  - DELETE: admin only

## Important Notes
1. user_id and created_by have DEFAULT auth.uid() so the frontend insert does NOT
   pass them — the DB fills them from the authenticated session.
2. The existing INSERT policy (leave_insert_own) used a subquery to staff.user_id.
   The new policy uses the direct user_id column, which is simpler and faster.
3. Teachers can no longer edit requests after approval/rejection — the UPDATE
   policy enforces status = 'pending' for non-admin users.
4. Backfill: existing rows get user_id/created_by from their teacher_id → staff.user_id
   lookup so they remain visible to their owners.
*/