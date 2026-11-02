/*
# Notice Board Module — Database Schema

## Overview
Creates a production-ready Notice Board system for the School ERP.
Admin/Principal/Super Admin can publish notices targeted to specific role audiences.
Notices auto-appear on authorized users' dashboards via realtime.

## New Tables

### 1. notices
- id (uuid PK)
- title (text, NOT NULL)
- description (text, NOT NULL)
- priority (text: 'low'|'medium'|'high'|'urgent', default 'medium')
- created_by (uuid FK auth.users ON DELETE SET NULL, DEFAULT auth.uid())
- author_name (text, NOT NULL) — denormalized for display
- author_role (text, NOT NULL) — denormalized for display
- author_avatar (text, nullable) — denormalized for display
- attachment_url (text, nullable)
- attachment_name (text, nullable)
- attachment_type (text, nullable: 'image'|'pdf'|'word'|'excel'|'file')
- publish_date (timestamptz, NOT NULL, default now())
- expiry_date (timestamptz, nullable)
- is_published (boolean, default true)
- is_deleted (boolean, default false) — soft delete
- created_at, updated_at (timestamptz)

### 2. notice_audience
- id (uuid PK)
- notice_id (uuid FK notices ON DELETE CASCADE)
- role (text, NOT NULL) — target role: 'all'|'super_admin'|'admin'|'principal'|'teacher'|'accountant'|'student'
- UNIQUE(notice_id, role)

## Helper Function: get_visible_notices()
Returns notices visible to the current user based on:
1. is_published = true AND is_deleted = false
2. publish_date <= now()
3. (expiry_date IS NULL OR expiry_date > now())
4. audience includes 'all' OR the user's role
SECURITY DEFINER so it can join notice_audience without exposing RLS complexity.

## Security (RLS)
- notices SELECT: visible to user via get_visible_notices() OR (admin/principal/super_admin can see all their own + published)
- notices INSERT/UPDATE/DELETE: only super_admin, admin, principal (via get_user_role())
- notice_audience SELECT: visible if the parent notice is visible
- notice_audience INSERT/UPDATE/DELETE: only admin/principal/super_admin

## Realtime
- Realtime enabled on notices and notice_audience for instant dashboard updates

## Storage
- 'notice-attachments' bucket created for file uploads (images, PDF, Word, Excel)
- Authenticated RLS policies for upload/read/delete own files

## Important Notes
1. created_by defaults to auth.uid() so frontend inserts omit it
2. Expired notices are NOT deleted — they're hidden by the get_visible_notices() filter
3. Audience 'all' means every authenticated user sees the notice
4. The get_user_role() function (already exists) returns the current user's role
5. Author info is denormalized at insert time so it persists even if the profile changes
*/