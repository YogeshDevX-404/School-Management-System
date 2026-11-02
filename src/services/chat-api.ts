import { supabase } from '@/lib/supabase';
import type { Conversation, ChatMessage, ChatContact, UserPresence } from '@/types';

export const chatApi = {
  async getContacts(): Promise<ChatContact[]> {
    const { data, error } = await supabase.rpc('get_chat_contacts');
    if (error) throw error;
    return (data || []) as ChatContact[];
  },

  async getOrCreateConversation(otherUserId: string): Promise<string | null> {
    const { data, error } = await supabase.rpc('get_or_create_conversation', {
      other_user_id: otherUserId,
    });
    if (error) throw error;
    return data as string | null;
  },

  async getConversations(): Promise<Conversation[]> {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .order('last_message_at', { ascending: false, nullsFirst: false });
    if (error) throw error;
    return (data || []) as Conversation[];
  },

  async getMessages(conversationId: string, limit = 100): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return (data || []) as ChatMessage[];
  },

  async sendMessage(
    conversationId: string,
    body: string | null,
    messageType: ChatMessage['message_type'] = 'text',
    attachment?: { url: string; name: string; size: number }
  ): Promise<ChatMessage | null> {
    const payload: Record<string, unknown> = {
      conversation_id: conversationId,
      message_type: messageType,
    };
    if (body) payload.body = body;
    if (attachment) {
      payload.attachment_url = attachment.url;
      payload.attachment_name = attachment.name;
      payload.attachment_size = attachment.size;
    }

    const { data, error } = await supabase.from('messages').insert(payload).select().single();
    if (error) throw error;

    // Update conversation's last_message_at
    await supabase
      .from('conversations')
      .update({ last_message_id: data.id, last_message_at: data.created_at, updated_at: data.created_at })
      .eq('id', conversationId);

    // Create message_status rows for all other participants
    const { data: participants } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .neq('user_id', data.sender_id);

    if (participants && participants.length) {
      const statusRows = participants.map((p) => ({
        message_id: data.id,
        user_id: p.user_id,
        status: 'sent' as const,
      }));
      await supabase.from('message_status').insert(statusRows);
    }

    return data as ChatMessage;
  },

  async markMessagesRead(conversationId: string): Promise<void> {
    const { error } = await supabase.rpc('mark_messages_read', { conv_id: conversationId });
    if (error) throw error;
  },

  async getUnreadCount(): Promise<number> {
    const { data, error } = await supabase.rpc('get_unread_message_count');
    if (error) throw error;
    return data as number;
  },

  async getUnreadCountsByConversation(): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from('message_status')
      .select('message_id, user_id, status, messages!inner(conversation_id)')
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
      .neq('status', 'read');
    if (error) return {};
    const counts: Record<string, number> = {};
    for (const row of data || []) {
      const convId = (row as unknown as { messages: { conversation_id: string } }).messages?.conversation_id;
      if (convId) counts[convId] = (counts[convId] || 0) + 1;
    }
    return counts;
  },

  async getPresence(userIds: string[]): Promise<Record<string, UserPresence>> {
    if (!userIds.length) return {};
    const { data, error } = await supabase
      .from('user_presence')
      .select('*')
      .in('user_id', userIds);
    if (error) return {};
    const map: Record<string, UserPresence> = {};
    for (const p of data || []) map[p.user_id] = p as UserPresence;
    return map;
  },

  async updatePresence(isOnline: boolean): Promise<void> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return;
    await supabase.from('user_presence').upsert({
      user_id: userId,
      is_online: isOnline,
      last_seen: new Date().toISOString(),
    });
  },

  async uploadAttachment(file: File, conversationId: string): Promise<{ url: string; name: string; size: number }> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('Not authenticated');
    const ext = file.name.split('.').pop() || 'file';
    const path = `${conversationId}/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await supabase.storage.from('chat-attachments').upload(path, file, { upsert: false });
    if (upErr) throw upErr;
    const { data: urlData } = supabase.storage.from('chat-attachments').getPublicUrl(path);
    return { url: urlData.publicUrl, name: file.name, size: file.size };
  },

  async getOtherParticipant(conversationId: string, myUserId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .neq('user_id', myUserId)
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data.user_id;
  },
};

export type ChatApi = typeof chatApi;
