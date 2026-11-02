/*
# AI School Assistant — Chat History Schema

## Overview
Stores conversation history for the AI School Assistant module.
Each user has their own chats — no cross-user access.

## New Tables

### 1. ai_chats
- id (uuid PK)
- user_id (uuid FK auth.users ON DELETE CASCADE, DEFAULT auth.uid())
- title (text, auto-generated from first message, editable)
- created_at, updated_at (timestamptz)

### 2. ai_messages
- id (uuid PK)
- chat_id (uuid FK ai_chats ON DELETE CASCADE)
- role (text: 'user' | 'assistant')
- content (text, the message body)
- intent (text, nullable — detected intent for assistant messages)
- created_at (timestamptz, DEFAULT now())

## Security (RLS)
- ai_chats: owner-scoped CRUD (user can only see/edit/delete their own chats)
- ai_messages: SELECT/INSERT for chat owners only (via join to ai_chats)

## Important Notes
1. user_id defaults to auth.uid() so frontend inserts omit it
2. Students have no access to the AI module at all (enforced by RBAC in permissions.ts
   and the edge function refuses to process student requests)
3. Chat title auto-generates from the first user message (truncated to 50 chars)
4. Messages ordered by created_at for conversation flow
5. Context memory: the edge function receives recent messages to maintain context
*/