import { supabase } from '@/lib/supabase';
import type { AIChat, AIMessage } from '@/types';

export interface ChatHistoryItem {
  id: string;
  title: string;
  updated_at: string;
  created_at: string;
}

export const aiApi = {
  async createChat(title = 'New Chat'): Promise<AIChat> {
    const { data, error } = await supabase
      .from('ai_chats')
      .insert({ title })
      .select()
      .single();
    if (error) throw error;
    return data as AIChat;
  },

  async listChats(): Promise<ChatHistoryItem[]> {
    const { data, error } = await supabase
      .from('ai_chats')
      .select('id, title, updated_at, created_at')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data || []) as ChatHistoryItem[];
  },

  async getMessages(chatId: string): Promise<AIMessage[]> {
    const { data, error } = await supabase
      .from('ai_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []) as AIMessage[];
  },

  async addMessage(chatId: string, role: 'user' | 'assistant', content: string, intent?: string): Promise<AIMessage> {
    const { data, error } = await supabase
      .from('ai_messages')
      .insert({ chat_id: chatId, role, content, intent })
      .select()
      .single();
    if (error) throw error;
    return data as AIMessage;
  },

  async renameChat(chatId: string, title: string): Promise<void> {
    const { error } = await supabase
      .from('ai_chats')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', chatId);
    if (error) throw error;
  },

  async deleteChat(chatId: string): Promise<void> {
    const { error } = await supabase
      .from('ai_chats')
      .delete()
      .eq('id', chatId);
    if (error) throw error;
  },

  async updateChatTimestamp(chatId: string): Promise<void> {
    const { error } = await supabase
      .from('ai_chats')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', chatId);
    if (error) throw error;
  },

  async sendMessage(
    message: string,
    history: { role: 'user' | 'assistant'; content: string }[],
    userId: string
  ): Promise<{ response: string; intent: string; toolsUsed?: string[] }> {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ message, history, userId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Request failed (${res.status})`);
    }

    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return { response: data.response, intent: data.intent, toolsUsed: data.toolsUsed };
  },
};
