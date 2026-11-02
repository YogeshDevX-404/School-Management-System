/*
# Internal Communication Module — Database Schema

## Overview
Creates a secure, private, real-time internal messaging system (WhatsApp-style)
for the School ERP. Every conversation is private — only participants can read
messages. Role-based user visibility controls who can message whom.

## New Tables

### 1. conversations
- id (uuid PK)
- type (text, always 'direct' for 1:1 chats; extensible to 'group' later)
- created_by (uuid FK auth.users, who initiated)
- last_message_id (uuid FK messages, denormalized for fast sidebar sorting)
- last_message_at (timestamptz, for sorting conversations by latest activity)
- created_at, updated_at

### 2. conversation_participants
- id (uuid PK)
- conversation_id (uuid FK conversations ON DELETE CASCADE)
- user_id (uuid FK auth.users ON DELETE CASCADE)
- joined_at (timestamptz)
- UNIQUE(conversation_id, user_id) — no duplicate participants

### 3. messages
- id (uuid PK)
- conversation_id (uuid FK conversations ON DELETE CASCADE)
- sender_id (uuid FK auth.users ON DELETE CASCADE, DEFAULT auth.uid())
- body (text, nullable when only attachments)
- message_type (text: 'text' | 'image' | 'pdf' | 'word' | 'excel' | 'file')
- attachment_url (text, nullable)
- attachment_name (text, nullable)
- attachment_size (bigint, nullable, bytes)
- created_at (timestamptz, DEFAULT now())
- Indexes on conversation_id + created_at for fast message loading

### 4. message_status
- id (uuid PK)
- message_id (uuid FK messages ON DELETE CASCADE)
- user_id (uuid FK auth.users ON DELETE CASCADE) — the recipient
- status (text: 'sent' | 'delivered' | 'read')
- read_at (timestamptz, nullable)
- created_at, updated_at
- UNIQUE(message_id, user_id) — one status row per recipient per message

### 5. user_presence
- user_id (uuid PK FK auth.users ON DELETE CASCADE)
- is_online (boolean, default false)
- last_seen (timestamptz, default now())
- Updated on connect/disconnect via Realtime Presence

## Helper Functions

### get_or_create_conversation(other_user_id uuid)
Returns a conversation id. If a direct conversation already exists between
auth.uid() and other_user_id, returns it. Otherwise creates a new conversation
with both users as participants. SECURITY DEFINER so it can insert into
conversation_participants on behalf of the caller.

### get_chat_contacts()
Returns the list of profiles the current user is allowed to message, based on
role-based visibility rules:
- admin / super_admin → principal, teacher, accountant
- principal → admin, teacher, accountant
- teacher → admin, principal, teacher (other teachers)
- accountant → admin, principal, student
Students are NEVER included (they have no chat access).

## Security (RLS)

All tables have RLS enabled with participant-scoped policies:
- conversations: SELECT/INSERT/UPDATE for participants only
- conversation_participants: SELECT for participants; INSERT via RPC only
- messages: SELECT for participants; INSERT only by sender; UPDATE none; DELETE by sender
- message_status: SELECT/UPDATE for the recipient only; INSERT by message sender
- user_presence: SELECT for anyone authenticated (to show online status);
  INSERT/UPDATE for own row only

## Realtime
- Realtime enabled on conversations, messages, message_status, user_presence
- Frontend subscribes to Postgres Changes on these tables filtered by
  conversation_id / user_id, plus Broadcast channels for typing and Presence
  for online/offline status.

## Important Notes
1. sender_id has DEFAULT auth.uid() so frontend inserts omit it.
2. The get_or_create_conversation RPC enforces that both users are allowed to
   chat (role visibility) before creating — returns NULL if not allowed.
3. message_status rows are created by the sender when sending a message (one
   row per other participant with status='sent'); the recipient updates to
   'read' when they open the conversation.
4. Unread count = message_status rows WHERE user_id = auth.uid() AND status != 'read'.
5. No student can ever access any of these tables — enforced by both the
   get_chat_contacts function and RLS policies (students have no INSERT/SELECT
   grants on conversations/messages).
*/