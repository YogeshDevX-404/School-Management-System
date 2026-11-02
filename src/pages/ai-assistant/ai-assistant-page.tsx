import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Trash2, Edit2, Send, Bot, Copy, RefreshCw,
  Check, MessageSquare, X, Sparkles, Menu, Wrench, FileText, TrendingUp,
} from 'lucide-react';
import { aiApi, type ChatHistoryItem } from '@/services/ai-api';
import { useAuth } from '@/context/auth-context';
import { cn, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { AIMessage } from '@/types';

const SUGGESTED_QUESTIONS = [
  { icon: '📊', text: 'School Summary', query: 'Give me a school summary' },
  { icon: '👨‍🎓', text: 'Total Students', query: 'How many students are there?' },
  { icon: '👨‍🏫', text: 'Total Teachers', query: 'Show all teachers' },
  { icon: '💰', text: 'Pending Fees', query: 'How much fee is pending?' },
  { icon: '📅', text: "Today's Attendance", query: "Today's attendance summary" },
  { icon: '📢', text: 'Latest Notices', query: 'Show latest notices' },
  { icon: '📋', text: 'Absent Today', query: 'Who is absent today?' },
  { icon: '📅', text: "Today's Timetable", query: "Show today's timetable" },
];

const ADVANCED_QUESTIONS = [
  { icon: '📈', text: 'Attendance Trend', query: 'Show attendance trend for the last 7 days' },
  { icon: '⚠️', text: 'Low Attendance', query: 'Which students have attendance below 75%?' },
  { icon: '📉', text: 'Lowest Class', query: 'Which class has the lowest attendance today?' },
  { icon: '🎂', text: 'Birthdays', query: 'Any upcoming birthdays this week?' },
  { icon: '📝', text: 'Draft Notice', query: 'Draft a notice about upcoming parent-teacher meeting' },
  { icon: '💰', text: 'Fee Defaulters', query: 'Show students with pending fee above 5000' },
];

const TOOL_LABELS: Record<string, string> = {
  getSchoolSummary: 'School Summary',
  getStudents: 'Students',
  getStudentByName: 'Student Search',
  getTeachers: 'Teachers',
  getTeacherByName: 'Teacher Search',
  getAttendance: 'Attendance',
  getAttendanceByClass: 'Class Attendance',
  getAttendanceByStudent: 'Student Attendance',
  getAbsentStudents: 'Absent Students',
  getLowAttendanceStudents: 'Low Attendance',
  getLowestAttendanceClasses: 'Lowest Classes',
  getPendingFees: 'Pending Fees',
  getPendingFeeStudents: 'Fee Defaulters',
  getFeeSummary: 'Fee Summary',
  getFeeByStudent: 'Student Fees',
  getTimetable: 'Timetable',
  getNotices: 'Notices',
  getLeaveRequests: 'Leave Requests',
  getAdmissions: 'Admissions',
  getClasses: 'Classes',
  getSubjects: 'Subjects',
  getTeacherAssignments: 'Teacher Assignments',
  getUpcomingBirthdays: 'Birthdays',
  getAttendanceTrend: 'Attendance Trend',
  getFeeCollectionTrend: 'Fee Collection Trend',
  generateDocumentDraft: 'Document Draft',
};

function formatTime(date: string) {
  return new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// Simple markdown renderer for tables, bold, lists
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let listItems: string[] = [];

  const flushTable = () => {
    if (!tableRows.length) return;
    const headers = tableRows[0];
    const rows = tableRows.slice(2);
    elements.push(
      <div key={`table-${elements.length}`} className="my-3 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="border-b border-border px-3 py-2 text-left font-semibold">{renderInline(h)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-border last:border-0">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2">{renderInline(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
    inTable = false;
  };

  const flushList = () => {
    if (!listItems.length) return;
    elements.push(
      <ul key={`list-${elements.length}`} className="my-2 space-y-1 pl-4">
        {listItems.map((item, i) => (
          <li key={i} className="text-sm flex items-start gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ul>
    );
    listItems = [];
  };

  for (const line of lines) {
    if (line.startsWith('|') && line.endsWith('|')) {
      flushList();
      inTable = true;
      tableRows.push(line.slice(1, -1).split('|').map((c) => c.trim()));
    } else if (line.startsWith('• ')) {
      flushTable();
      listItems.push(line.slice(2));
    } else if (line.startsWith('---') && inTable) {
      continue;
    } else if (line.trim() === '') {
      flushTable();
      flushList();
    } else {
      flushTable();
      flushList();
      elements.push(<p key={`p-${elements.length}`} className="my-1 text-sm leading-relaxed">{renderInline(line)}</p>);
    }
  }
  flushTable();
  flushList();
  return elements;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

export function AIAssistantPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lastToolsUsed, setLastToolsUsed] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: chats } = useQuery({
    queryKey: ['ai-chats'],
    queryFn: aiApi.listChats,
  });

  const { data: chatMessages } = useQuery({
    queryKey: ['ai-messages', activeChatId],
    queryFn: () => aiApi.getMessages(activeChatId!),
    enabled: !!activeChatId,
  });

  useEffect(() => {
    if (chatMessages) setMessages(chatMessages);
  }, [chatMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const createChatMut = useMutation({
    mutationFn: () => aiApi.createChat(),
    onSuccess: (chat) => {
      qc.invalidateQueries({ queryKey: ['ai-chats'] });
      setActiveChatId(chat.id);
      setMessages([]);
      setShowSidebar(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendMessageMut = useMutation({
    mutationFn: async ({ message, history }: { message: string; history: { role: 'user' | 'assistant'; content: string }[] }) => {
      let chatId = activeChatId;
      if (!chatId) {
        const newChat = await aiApi.createChat(message.slice(0, 50));
        chatId = newChat.id;
        setActiveChatId(chatId);
      }
      await aiApi.addMessage(chatId, 'user', message);
      const result = await aiApi.sendMessage(message, history, profile!.id);
      await aiApi.addMessage(chatId, 'assistant', result.response, result.intent);
      if (messages.length === 0) {
        await aiApi.renameChat(chatId, message.slice(0, 50));
      }
      await aiApi.updateChatTimestamp(chatId);
      return { chatId, result };
    },
    onMutate: ({ message }) => {
      const tempUserMsg: AIMessage = {
        id: `temp-${Date.now()}`,
        chat_id: activeChatId || '',
        role: 'user',
        content: message,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempUserMsg]);
      setInput('');
      setIsTyping(true);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['ai-chats'] });
      qc.invalidateQueries({ queryKey: ['ai-messages', data.chatId] });
      setLastToolsUsed(data.result.toolsUsed || []);
      setIsTyping(false);
    },
    onError: (e: Error) => {
      setIsTyping(false);
      toast.error(e.message);
      setMessages((prev) => prev.filter((m) => !m.id.startsWith('temp-')));
    },
  });

  const deleteChatMut = useMutation({
    mutationFn: aiApi.deleteChat,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-chats'] });
      if (deleteId === activeChatId) {
        setActiveChatId(null);
        setMessages([]);
      }
      setDeleteId(null);
      toast.success('Chat deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renameChatMut = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => aiApi.renameChat(id, title),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-chats'] });
      setRenameId(null);
      toast.success('Chat renamed');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSend = useCallback(() => {
    if (!input.trim() || isTyping) return;
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    sendMessageMut.mutate({ message: input.trim(), history });
  }, [input, isTyping, messages, sendMessageMut]);

  const handleSuggestion = useCallback((query: string) => {
    if (isTyping) return;
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    sendMessageMut.mutate({ message: query, history });
  }, [isTyping, messages, sendMessageMut]);

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRegenerate = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser || isTyping) return;
    setMessages((prev) => prev.slice(0, prev.findIndex((m) => m.id === lastUser.id) + 1));
    const history = messages.slice(0, messages.findIndex((m) => m.id === lastUser.id)).map((m) => ({ role: m.role, content: m.content }));
    sendMessageMut.mutate({ message: lastUser.content, history });
  };

  const openChat = (chatId: string) => {
    setActiveChatId(chatId);
    setShowSidebar(false);
  };

  const startRename = (chat: ChatHistoryItem) => {
    setRenameId(chat.id);
    setRenameTitle(chat.title);
  };

  const filteredChats = (chats || []).filter((c) =>
    !searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const showWelcome = !activeChatId || messages.length === 0;

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-xl border border-border bg-background lg:h-[calc(100vh-7rem)]">
      {/* Sidebar */}
      <AnimatePresence>
        {showSidebar && (
          <motion.div
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            className="absolute z-20 h-full w-72 border-r border-border bg-card md:relative md:z-0"
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-border p-3">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  <span className="font-semibold">AI Assistant</span>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={() => setShowSidebar(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="p-3">
                <Button className="w-full justify-start gap-2" variant="outline" onClick={() => createChatMut.mutate()}>
                  <Plus className="h-4 w-4" /> New Chat
                </Button>
              </div>

              <div className="px-3 pb-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search chats..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 bg-muted/50 pl-9"
                  />
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="space-y-1 p-2">
                  {filteredChats.length === 0 ? (
                    <p className="py-8 text-center text-xs text-muted-foreground">No chats yet</p>
                  ) : (
                    filteredChats.map((chat) => (
                      <div
                        key={chat.id}
                        className={cn(
                          'group flex items-center gap-2 rounded-lg p-2 transition-colors',
                          activeChatId === chat.id ? 'bg-primary/10' : 'hover:bg-accent'
                        )}
                      >
                        <button onClick={() => openChat(chat.id)} className="flex flex-1 items-center gap-2 text-left">
                          <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium">{chat.title}</p>
                            <p className="truncate text-[10px] text-muted-foreground">{formatDate(chat.updated_at, 'dd MMM, HH:mm')}</p>
                          </div>
                        </button>
                        <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startRename(chat)}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(chat.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border p-3">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setShowSidebar(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">AI School Copilot</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              Powered by LLM · Tool Calling · Multi-step Reasoning
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => createChatMut.mutate()} disabled={createChatMut.isPending}>
            <Plus className="mr-1 h-4 w-4" /> New
          </Button>
        </div>

        {/* Messages / Welcome */}
        <ScrollArea className="flex-1">
          <div className="mx-auto max-w-3xl p-4">
            {showWelcome ? (
              <div className="flex flex-col items-center justify-center py-12">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', duration: 0.8 }}
                  className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10"
                >
                  <Bot className="h-9 w-9 text-primary" />
                </motion.div>
                <h2 className="mb-1 text-2xl font-bold">How can I help you?</h2>
                <p className="mb-8 text-sm text-muted-foreground">I understand English, Hindi, and Hinglish</p>

                <div className="grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
                  {SUGGESTED_QUESTIONS.map((q, i) => (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => handleSuggestion(q.query)}
                      disabled={isTyping}
                      className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-3 text-center transition-all hover:border-primary/50 hover:bg-accent hover:shadow-sm disabled:opacity-50"
                    >
                      <span className="text-xl">{q.icon}</span>
                      <span className="text-xs font-medium">{q.text}</span>
                    </motion.button>
                  ))}
                </div>

                <div className="mt-6 w-full max-w-2xl">
                  <div className="mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Advanced Analytics & Tools</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {ADVANCED_QUESTIONS.map((q, i) => (
                      <motion.button
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + i * 0.05 }}
                        onClick={() => handleSuggestion(q.query)}
                        disabled={isTyping}
                        className="flex items-center gap-2 rounded-xl border border-border bg-gradient-to-br from-card to-muted/20 p-3 text-left transition-all hover:border-primary/50 hover:shadow-sm disabled:opacity-50"
                      >
                        <span className="text-lg">{q.icon}</span>
                        <span className="text-xs font-medium">{q.text}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    {msg.role === 'assistant' && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Bot className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div className={cn('group max-w-[85%]', msg.role === 'user' && 'flex flex-col items-end')}>
                      <div
                        className={cn(
                          'rounded-2xl px-4 py-3',
                          msg.role === 'user'
                            ? 'rounded-br-md bg-primary text-primary-foreground'
                            : 'rounded-bl-md bg-card border border-border'
                        )}
                      >
                        {msg.role === 'assistant' ? (
                          msg.content.includes('**NOTICE**') || msg.content.includes('**CIRCULAR**') || msg.content.includes('**MEETING AGENDA**') || msg.content.includes('**DRAFT') ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                                <FileText className="h-3.5 w-3.5" />
                                Document Draft — Review & Confirm
                              </div>
                              {renderMarkdown(msg.content)}
                              <div className="mt-2 flex gap-2">
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleCopy(msg.id, msg.content)}>
                                  <Copy className="mr-1 h-3 w-3" /> Copy Draft
                                </Button>
                              </div>
                              <p className="text-[10px] text-muted-foreground">This is a draft. No changes have been published.</p>
                            </div>
                          ) : renderMarkdown(msg.content)
                        ) : <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
                      </div>
                      <div className={cn('mt-1 flex items-center gap-2 px-1', msg.role === 'user' && 'justify-end')}>
                        <span className="text-[10px] text-muted-foreground">{formatTime(msg.created_at)}</span>
                        {msg.role === 'assistant' && (
                          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button onClick={() => handleCopy(msg.id, msg.content)} className="text-muted-foreground hover:text-foreground" title="Copy">
                              {copiedId === msg.id ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                            </button>
                            <button onClick={handleRegenerate} className="text-muted-foreground hover:text-foreground" title="Regenerate">
                              <RefreshCw className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {msg.role === 'user' && (
                      <Avatar className="h-8 w-8 shrink-0 border border-border">
                        <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                          {profile?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </motion.div>
                ))}

                {isTyping && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Bot className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3">
                        <Sparkles className="h-4 w-4 animate-pulse text-primary" />
                        <span className="text-xs text-muted-foreground">Thinking and analyzing ERP data...</span>
                      </div>
                      <div className="flex items-center gap-1 px-2">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: '0ms' }} />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: '150ms' }} />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </motion.div>
                )}
                {!isTyping && lastToolsUsed.length > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap gap-1.5 px-2">
                    {lastToolsUsed.map((tool, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary">
                        <Wrench className="h-2.5 w-2.5" />
                        {TOOL_LABELS[tool] || tool}
                      </span>
                    ))}
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t border-border p-3">
          <div className="mx-auto flex max-w-3xl items-center gap-2">
            <Input
              ref={inputRef}
              placeholder="Ask me anything... (English, Hindi, Hinglish)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              disabled={isTyping}
              className="flex-1"
            />
            <Button size="icon" onClick={handleSend} disabled={!input.trim() || isTyping}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-muted-foreground">
            <Sparkles className="mr-1 inline h-3 w-3" />
            Enterprise AI Copilot · LLM Tool Calling · Context-Aware · Multi-Language · Document Generation
          </p>
        </div>
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the chat and all its messages. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteChatMut.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameId} onOpenChange={(o) => !o && setRenameId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Chat</DialogTitle>
          </DialogHeader>
          <Input
            value={renameTitle}
            onChange={(e) => setRenameTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && renameId) renameChatMut.mutate({ id: renameId, title: renameTitle }); }}
            placeholder="Enter new chat title"
          />
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={() => renameId && renameChatMut.mutate({ id: renameId, title: renameTitle })} disabled={!renameTitle.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
