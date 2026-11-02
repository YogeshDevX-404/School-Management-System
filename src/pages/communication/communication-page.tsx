import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Send, Paperclip, Smile, ArrowLeft, CheckCheck,
  FileText, Image as ImageIcon, File, Circle,
} from 'lucide-react';
import { chatApi } from '@/services/chat-api';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/auth-context';
import { ROLE_LABELS } from '@/constants';
import { cn, formatDate, initials } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import type { ChatContact, ChatMessage } from '@/types';

const EMOJIS = ['😀','😂','😍','👍','🙏','🎉','❤️','😎','🤔','😢','🔥','✨','👏','💯','🙌','😅','🥳','😴','🤝','📌','📚','✅','⭐','🎯','💡','📝','🔔','💪','🤗','😊'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function getFileIcon(type: string) {
  if (type === 'image') return ImageIcon;
  if (type === 'pdf') return FileText;
  return File;
}

function formatTime(date: string) {
  return new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatLastSeen(date: string | null | undefined) {
  if (!date) return 'a while ago';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return formatDate(date, 'dd MMM');
}

export function CommunicationPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [activeContact, setActiveContact] = useState<ChatContact | null>(null);
  const [search, setSearch] = useState('');
  const [messageText, setMessageText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const myUserId = profile?.id || '';

  const { data: contacts } = useQuery({
    queryKey: ['chat-contacts'],
    queryFn: chatApi.getContacts,
    enabled: !!profile,
  });

  const { data: conversations } = useQuery({
    queryKey: ['chat-conversations'],
    queryFn: chatApi.getConversations,
    enabled: !!profile,
    refetchInterval: 10_000,
  });

  const { data: messages } = useQuery({
    queryKey: ['chat-messages', activeConvId],
    queryFn: () => chatApi.getMessages(activeConvId!),
    enabled: !!activeConvId,
  });

  const { data: unreadCount } = useQuery({
    queryKey: ['chat-unread-count'],
    queryFn: chatApi.getUnreadCount,
    enabled: !!profile,
    refetchInterval: 5_000,
  });

  // All user IDs to track presence for
  const allUserIds = [...(contacts || []).map((c) => c.id)];
  const { data: presenceMap } = useQuery({
    queryKey: ['chat-presence', allUserIds.join(',') ],
    queryFn: () => chatApi.getPresence(allUserIds),
    enabled: allUserIds.length > 0,
    refetchInterval: 10_000,
  });

  // Update own presence on mount
  useEffect(() => {
    if (!myUserId) return;
    chatApi.updatePresence(true).catch(() => {});
    const onUnload = () => chatApi.updatePresence(false).catch(() => {});
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      chatApi.updatePresence(false).catch(() => {});
    };
  }, [myUserId]);

  // Realtime: subscribe to new messages in active conversation
  useEffect(() => {
    if (!activeConvId) return;
    const channel = supabase
      .channel(`messages-${activeConvId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConvId}` },
        (payload) => {
          qc.invalidateQueries({ queryKey: ['chat-messages', activeConvId] });
          qc.invalidateQueries({ queryKey: ['chat-conversations'] });
          const msg = payload.new as ChatMessage;
          if (msg.sender_id !== myUserId) {
            chatApi.markMessagesRead(activeConvId).catch(() => {});
            qc.invalidateQueries({ queryKey: ['chat-unread-count'] });
          }
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'message_status' },
        () => {
          qc.invalidateQueries({ queryKey: ['chat-messages', activeConvId] });
          qc.invalidateQueries({ queryKey: ['chat-unread-count'] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeConvId, myUserId, qc]);

  // Realtime: subscribe to all conversations for new messages (sidebar updates)
  useEffect(() => {
    if (!myUserId) return;
    const channel = supabase
      .channel('conversations-sidebar')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
        () => qc.invalidateQueries({ queryKey: ['chat-conversations'] })
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_status' },
        () => {
          qc.invalidateQueries({ queryKey: ['chat-unread-count'] });
          qc.invalidateQueries({ queryKey: ['chat-conversations'] });
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'message_status' },
        () => {
          qc.invalidateQueries({ queryKey: ['chat-unread-count'] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [myUserId, qc]);

  // Realtime: typing indicator via Broadcast
  useEffect(() => {
    if (!activeConvId) return;
    const channel = supabase.channel(`typing-${activeConvId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'typing' }, () => setIsTyping(true))
      .on('broadcast', { event: 'stop-typing' }, () => setIsTyping(false))
      .subscribe();

    return () => { supabase.removeChannel(channel); setIsTyping(false); };
  }, [activeConvId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark messages read when opening conversation
  useEffect(() => {
    if (activeConvId) {
      chatApi.markMessagesRead(activeConvId).catch(() => {});
      qc.invalidateQueries({ queryKey: ['chat-unread-count'] });
    }
  }, [activeConvId, qc]);

  const openConversation = useCallback(async (contact: ChatContact) => {
    try {
      const convId = await chatApi.getOrCreateConversation(contact.id);
      if (!convId) {
        toast.error('Cannot start conversation with this user');
        return;
      }
      setActiveConvId(convId);
      setActiveContact(contact);
      setMobileShowChat(true);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (!activeConvId || !messageText.trim()) return;
    const text = messageText.trim();
    setMessageText('');
    setShowEmoji(false);
    try {
      await chatApi.sendMessage(activeConvId, text, 'text');
      qc.invalidateQueries({ queryKey: ['chat-messages', activeConvId] });
      qc.invalidateQueries({ queryKey: ['chat-conversations'] });
    } catch (err) {
      toast.error((err as Error).message);
      setMessageText(text);
    }
  }, [activeConvId, messageText, qc]);

  const handleTyping = useCallback(() => {
    if (!activeConvId) return;
    const channel = supabase.channel(`typing-${activeConvId}`, {
      config: { broadcast: { self: false } },
    });
    channel.send({ type: 'broadcast', event: 'typing', payload: {} });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      channel.send({ type: 'broadcast', event: 'stop-typing', payload: {} });
    }, 2000);
  }, [activeConvId]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConvId) return;
    e.target.value = '';

    if (file.size > MAX_FILE_SIZE) {
      toast.error('File size must be under 10MB');
      return;
    }

    setUploading(true);
    try {
      const attachment = await chatApi.uploadAttachment(file, activeConvId);
      let msgType: ChatMessage['message_type'] = 'file';
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) msgType = 'image';
      else if (ext === 'pdf') msgType = 'pdf';
      else if (['doc','docx'].includes(ext)) msgType = 'word';
      else if (['xls','xlsx','csv'].includes(ext)) msgType = 'excel';

      await chatApi.sendMessage(activeConvId, null, msgType, attachment);
      qc.invalidateQueries({ queryKey: ['chat-messages', activeConvId] });
      qc.invalidateQueries({ queryKey: ['chat-conversations'] });
      toast.success('File sent');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }, [activeConvId, qc]);

  // Build sidebar list: conversations with last message + contacts without conversations
  const filteredContacts = (contacts || []).filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.full_name.toLowerCase().includes(q) || c.role.toLowerCase().includes(q) || (c.department || '').toLowerCase().includes(q);
  });

  // Map conversation to contact for display
  const conversationContacts = new Map<string, ChatContact>();
  for (const conv of conversations || []) {
    const otherId = (contacts || []).find(() => {
      return conversations?.some(() => true);
    });
    if (otherId) conversationContacts.set(conv.id, otherId);
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-xl border border-border bg-background lg:h-[calc(100vh-7rem)]">
      {/* LEFT PANEL: Contacts / Conversations */}
      <div className={cn(
        'flex w-full flex-col border-r border-border bg-card md:w-80 lg:w-96',
        mobileShowChat && 'hidden md:flex'
      )}>
        {/* Header */}
        <div className="border-b border-border p-4">
          <h2 className="text-lg font-bold">Messages</h2>
          {unreadCount && unreadCount > 0 ? (
            <p className="text-xs text-muted-foreground">{unreadCount} unread message{unreadCount > 1 ? 's' : ''}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Start a new conversation</p>
          )}
        </div>

        {/* Search */}
        <div className="border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search people..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 bg-muted/50 pl-9"
            />
          </div>
        </div>

        {/* Contact List */}
        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2">
            {filteredContacts.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {search ? 'No people found' : 'No contacts available'}
              </div>
            ) : (
              filteredContacts.map((contact) => {
                const presence = presenceMap?.[contact.id];
                const isOnline = presence?.is_online ?? false;
                const isActive = activeContact?.id === contact.id;

                return (
                  <button
                    key={contact.id}
                    onClick={() => openConversation(contact)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors',
                      isActive ? 'bg-primary/10' : 'hover:bg-accent'
                    )}
                  >
                    <div className="relative">
                      <Avatar className="h-11 w-11 border border-border">
                        {contact.avatar_url && <AvatarImage src={contact.avatar_url} alt={contact.full_name} />}
                        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                          {initials(contact.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className={cn(
                        'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card',
                        isOnline ? 'bg-success' : 'bg-muted-foreground/40'
                      )} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="truncate text-sm font-semibold">{contact.full_name}</p>
                        {!isOnline && presence?.last_seen && (
                          <span className="shrink-0 text-[10px] text-muted-foreground">{formatLastSeen(presence.last_seen)}</span>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {ROLE_LABELS[contact.role as keyof typeof ROLE_LABELS] || contact.role}
                        {contact.department ? ` · ${contact.department}` : ''}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* RIGHT PANEL: Conversation */}
      <div className={cn(
        'flex flex-1 flex-col bg-background',
        !mobileShowChat && 'hidden md:flex'
      )}>
        {!activeConvId || !activeContact ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Send className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-lg font-semibold">Internal Communication</p>
              <p className="mt-1 text-sm text-muted-foreground">Select a person to start a private conversation</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="flex items-center gap-3 border-b border-border p-3">
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileShowChat(false)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="relative">
                <Avatar className="h-10 w-10 border border-border">
                  {activeContact.avatar_url && <AvatarImage src={activeContact.avatar_url} alt={activeContact.full_name} />}
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {initials(activeContact.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className={cn(
                  'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card',
                  presenceMap?.[activeContact.id]?.is_online ? 'bg-success' : 'bg-muted-foreground/40'
                )} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{activeContact.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {isTyping ? (
                    <span className="text-primary">typing...</span>
                  ) : presenceMap?.[activeContact.id]?.is_online ? (
                    <span className="text-success">Online</span>
                  ) : (
                    `Last seen ${formatLastSeen(presenceMap?.[activeContact.id]?.last_seen)}`
                  )}
                </p>
              </div>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
                {ROLE_LABELS[activeContact.role as keyof typeof ROLE_LABELS] || activeContact.role}
              </span>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1">
              <div className="space-y-2 p-4">
                {(messages || []).length === 0 ? (
                  <div className="flex h-full items-center justify-center py-12">
                    <p className="text-sm text-muted-foreground">No messages yet. Say hello!</p>
                  </div>
                ) : (
                  (messages || []).map((msg, idx) => {
                    const isMine = msg.sender_id === myUserId;
                    const prevMsg = (messages || [])[idx - 1];
                    const showTime = !prevMsg || new Date(prevMsg.created_at).getTime() - new Date(msg.created_at).getTime() > 5 * 60 * 1000;
                    const FileIcon = getFileIcon(msg.message_type);

                    return (
                      <div key={msg.id}>
                        {showTime && (
                          <div className="my-3 flex justify-center">
                            <span className="rounded-full bg-muted px-3 py-1 text-[10px] text-muted-foreground">
                              {formatDate(msg.created_at, 'dd MMM yyyy')}
                            </span>
                          </div>
                        )}
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn('flex', isMine ? 'justify-end' : 'justify-start')}
                        >
                          <div className={cn(
                            'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm',
                            isMine
                              ? 'rounded-br-md bg-primary text-primary-foreground'
                              : 'rounded-bl-md bg-muted text-foreground'
                          )}>
                            {msg.message_type !== 'text' && msg.attachment_url && (
                              <a
                                href={msg.attachment_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  'mb-2 flex items-center gap-2 rounded-lg p-2 transition-opacity hover:opacity-80',
                                  isMine ? 'bg-primary-foreground/10' : 'bg-background'
                                )}
                              >
                                {msg.message_type === 'image' ? (
                                  <img src={msg.attachment_url} alt={msg.attachment_name || ''} className="h-32 w-32 rounded-lg object-cover" />
                                ) : (
                                  <>
                                    <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', isMine ? 'bg-primary-foreground/20' : 'bg-primary/10')}>
                                      <FileIcon className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="truncate text-xs font-medium">{msg.attachment_name}</p>
                                      <p className="text-[10px] opacity-70">{msg.message_type.toUpperCase()}</p>
                                    </div>
                                  </>
                                )}
                              </a>
                            )}
                            {msg.body && <p className="whitespace-pre-wrap break-words">{msg.body}</p>}
                            <div className={cn('mt-1 flex items-center justify-end gap-1 text-[10px]', isMine ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                              {formatTime(msg.created_at)}
                              {isMine && <CheckCheck className="h-3 w-3" />}
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    );
                  })
                )}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-3">
                      <div className="flex gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '0ms' }} />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '150ms' }} />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Emoji Picker */}
            <AnimatePresence>
              {showEmoji && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-20 left-4 z-10 grid grid-cols-10 gap-1 rounded-xl border border-border bg-popover p-3 shadow-lg"
                >
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => { setMessageText((prev) => prev + emoji); }}
                      className="rounded-lg p-1.5 text-lg transition-colors hover:bg-accent"
                    >
                      {emoji}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Message Input */}
            <div className="border-t border-border p-3">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setShowEmoji(!showEmoji)} title="Emoji">
                  <Smile className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  title="Attach file"
                >
                  {uploading ? <Circle className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv"
                />
                <Input
                  placeholder="Type a message..."
                  value={messageText}
                  onChange={(e) => { setMessageText(e.target.value); handleTyping(); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={handleSend}
                  disabled={!messageText.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
