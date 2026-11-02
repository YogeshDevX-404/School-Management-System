import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Plus, Search, Megaphone, Edit2, Trash2, Paperclip, X, FileText,
  Image as ImageIcon, File, AlertTriangle, Clock, Eye,
} from 'lucide-react';
import { noticesApi, type NoticeCreatePayload } from '@/services/notices-api';
import { notificationsApi } from '@/services/api';
import { useAuth } from '@/context/auth-context';
import { canWrite } from '@/lib/permissions';
import { ROLE_LABELS } from '@/constants';
import { formatDate, initials, cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { LoadingState } from '@/components/shared/loading-states';
import { EmptyState } from '@/components/shared/empty-state';
import { Pagination } from '@/components/shared/pagination';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import type { NoticeWithAudience, NoticePriority, NoticeAudienceRole, AttachmentType } from '@/types';

const PRIORITIES: { value: NoticePriority; label: string; color: string; bg: string }[] = [
  { value: 'low', label: 'Low', color: 'text-success', bg: 'bg-success/10 border-success/20' },
  { value: 'medium', label: 'Medium', color: 'text-warning', bg: 'bg-warning/10 border-warning/20' },
  { value: 'high', label: 'High', color: 'text-orange-500', bg: 'bg-orange-500/10 border-orange-500/20' },
  { value: 'urgent', label: 'Urgent', color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/20' },
];

const AUDIENCES: { value: NoticeAudienceRole; label: string }[] = [
  { value: 'all', label: 'All Users' },
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'principal', label: 'Principal' },
  { value: 'teacher', label: 'Teachers' },
  { value: 'accountant', label: 'Accountants' },
  { value: 'student', label: 'Students' },
];

const PRIORITY_MAP: Record<NoticePriority, typeof PRIORITIES[0]> = {
  low: PRIORITIES[0], medium: PRIORITIES[1], high: PRIORITIES[2], urgent: PRIORITIES[3],
};

function getAttachmentIcon(type?: AttachmentType | null) {
  if (type === 'image') return ImageIcon;
  if (type === 'pdf') return FileText;
  return File;
}

function isExpired(notice: NoticeWithAudience): boolean {
  return !!notice.expiry_date && new Date(notice.expiry_date) < new Date();
}

interface NoticeFormState {
  title: string;
  description: string;
  priority: NoticePriority;
  audiences: NoticeAudienceRole[];
  publish_date: string;
  expiry_date: string;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_type: AttachmentType | null;
}

const EMPTY_FORM: NoticeFormState = {
  title: '', description: '', priority: 'medium', audiences: ['all'],
  publish_date: new Date().toISOString().slice(0, 16), expiry_date: '',
  attachment_url: null, attachment_name: null, attachment_type: null,
};

export function NoticeBoardPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const canPublish = !!profile && canWrite(profile.role, 'notices') === true;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<NoticePriority | 'all'>('all');
  const [audienceFilter, setAudienceFilter] = useState<NoticeAudienceRole | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewNotice, setViewNotice] = useState<NoticeWithAudience | null>(null);
  const [form, setForm] = useState<NoticeFormState>(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pageSize = 9;

  const { data, isLoading } = useQuery({
    queryKey: ['notices', { page, search, priorityFilter, audienceFilter, dateFrom, dateTo }],
    queryFn: () => noticesApi.list({
      page, pageSize, search,
      priority: priorityFilter,
      audience: audienceFilter,
      dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      dateTo: dateTo ? new Date(dateTo).toISOString() : undefined,
    }),
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const payload: NoticeCreatePayload = {
        title: form.title,
        description: form.description,
        priority: form.priority,
        audiences: form.audiences,
        publish_date: new Date(form.publish_date).toISOString(),
        expiry_date: form.expiry_date ? new Date(form.expiry_date).toISOString() : null,
        attachment_url: form.attachment_url,
        attachment_name: form.attachment_name,
        attachment_type: form.attachment_type,
      };
      if (editId) return noticesApi.update(editId, payload);
      return noticesApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notices'] });
      qc.invalidateQueries({ queryKey: ['latest-notices'] });
      qc.invalidateQueries({ queryKey: ['dashboard-notifications'] });
      qc.invalidateQueries({ queryKey: ['navbar-notifications'] });
      if (!editId && form.audiences.includes('all')) {
        notificationsApi.create({
          user_id: null,
          title: 'New Notice Published',
          message: form.title,
          type: 'notice',
          priority: form.priority === 'urgent' ? 'high' : 'medium',
        }).catch(() => {});
      }
      toast.success(editId ? 'Notice updated' : 'Notice published');
      setModalOpen(false);
      setEditId(null);
      setForm(EMPTY_FORM);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: noticesApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notices'] });
      qc.invalidateQueries({ queryKey: ['latest-notices'] });
      toast.success('Notice deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (notice: NoticeWithAudience) => {
    setEditId(notice.id);
    setForm({
      title: notice.title,
      description: notice.description,
      priority: notice.priority,
      audiences: notice.audiences.length ? notice.audiences : ['all'],
      publish_date: new Date(notice.publish_date).toISOString().slice(0, 16),
      expiry_date: notice.expiry_date ? new Date(notice.expiry_date).toISOString().slice(0, 16) : '',
      attachment_url: notice.attachment_url || null,
      attachment_name: notice.attachment_name || null,
      attachment_type: notice.attachment_type || null,
    });
    setModalOpen(true);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    try {
      const result = await noticesApi.uploadAttachment(file);
      setForm((prev) => ({
        ...prev,
        attachment_url: result.url,
        attachment_name: result.name,
        attachment_type: result.type,
      }));
      toast.success('Attachment uploaded');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = () => {
    setForm((prev) => ({ ...prev, attachment_url: null, attachment_name: null, attachment_type: null }));
  };

  const toggleAudience = (role: NoticeAudienceRole) => {
    setForm((prev) => {
      if (role === 'all') return { ...prev, audiences: ['all'] };
      let audiences: NoticeAudienceRole[] = prev.audiences.filter((a) => a !== 'all');
      if (audiences.includes(role)) audiences = audiences.filter((a) => a !== role);
      else audiences.push(role);
      if (audiences.length === 0) audiences = ['all'];
      return { ...prev, audiences };
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        title="Notice Board"
        description="Stay updated with the latest school announcements and notices."
        actions={canPublish ? (
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> New Notice
          </Button>
        ) : undefined}
      />

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by title, description, or author..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-9 pl-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex">
              <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v as NoticePriority | 'all'); setPage(1); }}>
                <SelectTrigger className="h-9 w-full lg:w-[130px]"><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={audienceFilter as string} onValueChange={(v) => { setAudienceFilter(v as NoticeAudienceRole | 'all'); setPage(1); }}>
                <SelectTrigger className="h-9 w-full lg:w-[130px]"><SelectValue placeholder="Audience" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Audiences</SelectItem>
                  {AUDIENCES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="h-9" />
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="h-9" />
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Notices */}
      {isLoading ? (
        <LoadingState label="Loading notices..." />
      ) : !data?.data.length ? (
        <EmptyState icon={Megaphone} title="No notices found" description={canPublish ? 'Create the first notice for your school.' : 'Check back later for new announcements.'} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.data.map((notice, i) => {
              const pri = PRIORITY_MAP[notice.priority];
              const expired = isExpired(notice);
              const AttIcon = getAttachmentIcon(notice.attachment_type);
              return (
                <motion.div key={notice.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card className={cn('flex flex-col border-l-4', expired ? 'opacity-60' : '')} style={{ borderLeftColor: notice.priority === 'urgent' ? 'hsl(var(--destructive))' : notice.priority === 'high' ? 'hsl(var(--warning))' : notice.priority === 'medium' ? 'hsl(var(--warning))' : 'hsl(var(--success))' }}>
                    <CardContent className="flex flex-1 flex-col p-4">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <Badge className={cn('border', pri.bg, pri.color)} variant="outline">
                          {notice.priority === 'urgent' && <AlertTriangle className="mr-1 h-3 w-3" />}
                          {pri.label}
                        </Badge>
                        {expired && <Badge variant="secondary" className="text-[10px]">Expired</Badge>}
                      </div>
                      <h3 className="mb-1 line-clamp-2 text-base font-bold">{notice.title}</h3>
                      <p className="mb-3 line-clamp-3 flex-1 text-sm text-muted-foreground">{notice.description}</p>
                      {notice.attachment_url && (
                        <a href={notice.attachment_url} target="_blank" rel="noopener noreferrer" className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2 text-xs hover:bg-muted/60">
                          <AttIcon className="h-4 w-4 shrink-0 text-primary" />
                          <span className="truncate">{notice.attachment_name}</span>
                        </a>
                      )}
                      <div className="flex items-center gap-2 border-t border-border pt-3">
                        <Avatar className="h-7 w-7">
                          {notice.author_avatar && <AvatarImage src={notice.author_avatar} alt={notice.author_name} />}
                          <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">{initials(notice.author_name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{notice.author_name}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{ROLE_LABELS[notice.author_role as keyof typeof ROLE_LABELS] || notice.author_role}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{formatDate(notice.publish_date, 'dd MMM')}</span>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setViewNotice(notice)}>
                          <Eye className="mr-1 h-3 w-3" /> Read More
                        </Button>
                        {canPublish && !expired && (
                          <>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(notice)}><Edit2 className="h-3 w-3" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteMut.mutate(notice.id)}><Trash2 className="h-3 w-3" /></Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
          {data.total > pageSize && (
            <div className="mt-6">
              <Pagination page={page} pageSize={pageSize} total={data.total} onPageChange={setPage} />
            </div>
          )}
        </>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Notice' : 'Create Notice'}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              <div>
                <Label>Title <span className="text-destructive">*</span></Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Enter notice title" className="mt-1.5" />
              </div>
              <div>
                <Label>Description <span className="text-destructive">*</span></Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Enter notice description" className="mt-1.5 min-h-[100px]" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as NoticePriority })}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Publish Date <span className="text-destructive">*</span></Label>
                  <Input type="datetime-local" value={form.publish_date} onChange={(e) => setForm({ ...form, publish_date: e.target.value })} className="mt-1.5" />
                </div>
              </div>
              <div>
                <Label>Expiry Date</Label>
                <Input type="datetime-local" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} className="mt-1.5" />
                <p className="mt-1 text-[11px] text-muted-foreground">Leave empty for no expiry</p>
              </div>
              <div>
                <Label>Audience</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {AUDIENCES.map((a) => (
                    <button
                      key={a.value}
                      type="button"
                      onClick={() => toggleAudience(a.value)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                        form.audiences.includes(a.value)
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background hover:bg-accent'
                      )}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Attachment (Optional)</Label>
                <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv" />
                {form.attachment_url ? (
                  <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="flex-1 truncate text-xs">{form.attachment_name}</span>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={removeAttachment}><X className="h-3 w-3" /></Button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" size="sm" className="mt-1.5" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    <Paperclip className="mr-2 h-4 w-4" /> {uploading ? 'Uploading...' : 'Upload File (max 20MB)'}
                  </Button>
                )}
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Author</Label>
                <div className="mt-2 flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.full_name} />}
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(profile?.full_name || '')}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{profile?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{ROLE_LABELS[profile?.role as keyof typeof ROLE_LABELS] || profile?.role}</p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !form.title || !form.description}>
              {createMut.isPending ? 'Saving...' : editId ? 'Update' : 'Publish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Notice Modal */}
      <Dialog open={!!viewNotice} onOpenChange={(o) => !o && setViewNotice(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden">
          {viewNotice && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge className={cn('border', PRIORITY_MAP[viewNotice.priority].bg, PRIORITY_MAP[viewNotice.priority].color)} variant="outline">
                    {PRIORITY_MAP[viewNotice.priority].label}
                  </Badge>
                  {isExpired(viewNotice) && <Badge variant="secondary" className="text-[10px]">Expired</Badge>}
                </div>
                <DialogTitle className="text-lg">{viewNotice.title}</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[55vh] pr-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
                    <Avatar className="h-10 w-10">
                      {viewNotice.author_avatar && <AvatarImage src={viewNotice.author_avatar} alt={viewNotice.author_name} />}
                      <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(viewNotice.author_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{viewNotice.author_name}</p>
                      <p className="text-xs text-muted-foreground">{ROLE_LABELS[viewNotice.author_role as keyof typeof ROLE_LABELS] || viewNotice.author_role}</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDate(viewNotice.publish_date)}</p>
                      {viewNotice.expiry_date && <p className="mt-0.5">Expires: {formatDate(viewNotice.expiry_date)}</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {viewNotice.audiences.map((a) => (
                      <Badge key={a} variant="secondary" className="text-[10px]">
                        {AUDIENCES.find((au) => au.value === a)?.label || a}
                      </Badge>
                    ))}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{viewNotice.description}</p>
                  {viewNotice.attachment_url && (
                    <a href={viewNotice.attachment_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3 hover:bg-muted/60">
                      {viewNotice.attachment_type === 'image' ? (
                        <img src={viewNotice.attachment_url} alt={viewNotice.attachment_name || ''} className="h-16 w-16 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          {(() => { const I = getAttachmentIcon(viewNotice.attachment_type); return <I className="h-5 w-5 text-primary" />; })()}
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium">{viewNotice.attachment_name}</p>
                        <p className="text-xs text-muted-foreground">Click to download</p>
                      </div>
                    </a>
                  )}
                </div>
              </ScrollArea>
              <DialogFooter>
                <DialogClose asChild><Button>Close</Button></DialogClose>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
