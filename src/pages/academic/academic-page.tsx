import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Plus, Pencil, Trash2, Building2, Layers, Calendar } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { sessionsApi, classesApi, sectionsApi, subjectsApi } from '@/services/api';
import { EmptyState } from '@/components/shared/empty-state';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/context/auth-context';
import { canWrite } from '@/lib/permissions';

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}
    </div>
  );
}

export function AcademicPage() {
  return (
    <div>
      <PageHeader title="Academic Management" description="Manage sessions, classes, sections, and subjects" />
      <Tabs defaultValue="sessions">
        <TabsList className="mb-4">
          <TabsTrigger value="sessions"><Calendar className="mr-2 h-4 w-4" />Sessions</TabsTrigger>
          <TabsTrigger value="classes"><Building2 className="mr-2 h-4 w-4" />Classes</TabsTrigger>
          <TabsTrigger value="sections"><Layers className="mr-2 h-4 w-4" />Sections</TabsTrigger>
          <TabsTrigger value="subjects"><BookOpen className="mr-2 h-4 w-4" />Subjects</TabsTrigger>
        </TabsList>
        <TabsContent value="sessions"><SessionsTab /></TabsContent>
        <TabsContent value="classes"><ClassesTab /></TabsContent>
        <TabsContent value="sections"><SectionsTab /></TabsContent>
        <TabsContent value="subjects"><SubjectsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function SessionsTab() {
  const { profile } = useAuth();
  const canEdit = canWrite(profile?.role, 'academic');
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['sessions'], queryFn: sessionsApi.list });
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<{ id?: string; name: string; start: string; end: string; current: boolean }>({ name: '', start: '', end: '', current: false });

  const saveMut = useMutation({
    mutationFn: async (d: typeof edit) => {
      if (d.id) await sessionsApi.update(d.id, { name: d.name, start_date: d.start, end_date: d.end, is_current: d.current });
      else await sessionsApi.create({ name: d.name, start_date: d.start, end_date: d.end, is_current: d.current });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sessions'] }); toast.success('Session saved'); setOpen(false); },
  });
  const delMut = useMutation({ mutationFn: sessionsApi.remove, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sessions'] }); toast.success('Removed'); } });

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex justify-end p-4">
          {canEdit && <Button size="sm" onClick={() => { setEdit({ name: '', start: '', end: '', current: false }); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />Add Session</Button>}
        </div>
        {isLoading ? <div className="p-6"><TableSkeleton /></div> : !data?.length ? <EmptyState icon={Calendar} title="No sessions" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{formatDate(s.start_date)}</TableCell>
                  <TableCell>{formatDate(s.end_date)}</TableCell>
                  <TableCell>{s.is_current ? <Badge className="text-[10px]">Current</Badge> : <Badge variant="secondary" className="text-[10px]">{s.status}</Badge>}</TableCell>
                  <TableCell className="text-right">
                    {canEdit && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEdit({ id: s.id, name: s.name, start: s.start_date, end: s.end_date, current: s.is_current }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>}
                    {canEdit && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => delMut.mutate(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit.id ? 'Edit Session' : 'Add Session'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Session Name</Label><Input className="mt-1.5" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="2025-2026" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Start Date</Label><Input type="date" className="mt-1.5" value={edit.start} onChange={(e) => setEdit({ ...edit, start: e.target.value })} /></div>
              <div><Label>End Date</Label><Input type="date" className="mt-1.5" value={edit.end} onChange={(e) => setEdit({ ...edit, end: e.target.value })} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.current} onChange={(e) => setEdit({ ...edit, current: e.target.checked })} /> Set as current session</label>
          </div>
          <DialogFooter><Button onClick={() => saveMut.mutate(edit)} disabled={saveMut.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ClassesTab() {
  const { profile } = useAuth();
  const canEdit = canWrite(profile?.role, 'academic');
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['classes'], queryFn: classesApi.list });
  const { data: sessions } = useQuery({ queryKey: ['sessions'], queryFn: sessionsApi.list });
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<{ id?: string; name: string; num: number; sessionId: string }>({ name: '', num: 0, sessionId: '' });

  const saveMut = useMutation({
    mutationFn: async (d: typeof edit) => {
      if (d.id) await classesApi.update(d.id, { name: d.name, class_numeric: d.num, session_id: d.sessionId || null });
      else await classesApi.create({ name: d.name, class_numeric: d.num, session_id: d.sessionId || null });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['classes'] }); toast.success('Class saved'); setOpen(false); },
  });
  const delMut = useMutation({ mutationFn: classesApi.remove, onSuccess: () => { qc.invalidateQueries({ queryKey: ['classes'] }); toast.success('Removed'); } });

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex justify-end p-4">{canEdit && <Button size="sm" onClick={() => { setEdit({ name: '', num: 0, sessionId: '' }); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />Add Class</Button>}</div>
        {isLoading ? <div className="p-6"><TableSkeleton /></div> : !data?.length ? <EmptyState icon={Building2} title="No classes" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Level</TableHead><TableHead>Session</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.class_numeric}</TableCell>
                  <TableCell className="text-sm">{sessions?.find((s) => s.id === c.session_id)?.name || '-'}</TableCell>
                  <TableCell className="text-right">
                    {canEdit && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEdit({ id: c.id, name: c.name, num: c.class_numeric, sessionId: c.session_id || '' }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>}
                    {canEdit && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => delMut.mutate(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit.id ? 'Edit Class' : 'Add Class'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Class Name</Label><Input className="mt-1.5" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Grade 10" /></div>
            <div><Label>Level (numeric)</Label><Input type="number" className="mt-1.5" value={edit.num} onChange={(e) => setEdit({ ...edit, num: Number(e.target.value) })} /></div>
            <div>
              <Label>Session</Label>
              <Select value={edit.sessionId} onValueChange={(v) => setEdit({ ...edit, sessionId: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select session" /></SelectTrigger>
                <SelectContent>{(sessions || []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={() => saveMut.mutate(edit)} disabled={saveMut.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function SectionsTab() {
  const { profile } = useAuth();
  const canEdit = canWrite(profile?.role, 'academic');
  const qc = useQueryClient();
  const { data: classes } = useQuery({ queryKey: ['classes'], queryFn: classesApi.list });
  const { data: sections, isLoading } = useQuery({ queryKey: ['sections'], queryFn: () => sectionsApi.list() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ name: string; classId: string; capacity: number }>({ name: '', classId: '', capacity: 40 });
  const [delId, setDelId] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: () => sectionsApi.create({ name: form.name, class_id: form.classId, capacity: form.capacity }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sections'] }); toast.success('Section added'); setOpen(false); setForm({ name: '', classId: '', capacity: 40 }); },
  });
  const delMut = useMutation({ mutationFn: sectionsApi.remove, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sections'] }); toast.success('Removed'); setDelId(null); } });

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex justify-end p-4">{canEdit && <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Add Section</Button>}</div>
        {isLoading ? <div className="p-6"><TableSkeleton /></div> : !sections?.length ? <EmptyState icon={Layers} title="No sections" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Class</TableHead><TableHead>Capacity</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {sections.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{classes?.find((c) => c.id === s.class_id)?.name || '-'}</TableCell>
                  <TableCell>{s.capacity}</TableCell>
                  <TableCell className="text-right">{canEdit && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDelId(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Section</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Section Name</Label><Input className="mt-1.5" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="A" /></div>
            <div>
              <Label>Class</Label>
              <Select value={form.classId} onValueChange={(v) => setForm({ ...form, classId: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{(classes || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Capacity</Label><Input type="number" className="mt-1.5" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} /></div>
          </div>
          <DialogFooter><Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Remove section?</AlertDialogTitle><AlertDialogDescription>This will remove the section.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => delId && delMut.mutate(delId)}>Remove</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function SubjectsTab() {
  const { profile } = useAuth();
  const canEdit = canWrite(profile?.role, 'academic');
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['subjects'], queryFn: subjectsApi.list });
  const { data: classes } = useQuery({ queryKey: ['classes'], queryFn: classesApi.list });
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<{ id?: string; name: string; code: string; classId: string }>({ name: '', code: '', classId: '' });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (edit.id) await subjectsApi.update(edit.id, { name: edit.name, code: edit.code, class_id: edit.classId || null });
      else await subjectsApi.create({ name: edit.name, code: edit.code, class_id: edit.classId || null });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subjects'] }); toast.success('Subject saved'); setOpen(false); },
  });
  const delMut = useMutation({ mutationFn: subjectsApi.remove, onSuccess: () => { qc.invalidateQueries({ queryKey: ['subjects'] }); toast.success('Removed'); } });

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex justify-end p-4">{canEdit && <Button size="sm" onClick={() => { setEdit({ name: '', code: '', classId: '' }); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />Add Subject</Button>}</div>
        {isLoading ? <div className="p-6"><TableSkeleton /></div> : !data?.length ? <EmptyState icon={BookOpen} title="No subjects" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Code</TableHead><TableHead>Class</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="font-mono text-xs">{s.code}</TableCell>
                  <TableCell>{classes?.find((c) => c.id === s.class_id)?.name || 'All'}</TableCell>
                  <TableCell className="text-right">
                    {canEdit && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEdit({ id: s.id, name: s.name, code: s.code, classId: s.class_id || '' }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>}
                    {canEdit && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => delMut.mutate(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit.id ? 'Edit Subject' : 'Add Subject'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Subject Name</Label><Input className="mt-1.5" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Mathematics" /></div>
            <div><Label>Code</Label><Input className="mt-1.5" value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} placeholder="MATH" /></div>
            <div>
              <Label>Class (optional)</Label>
              <Select value={edit.classId} onValueChange={(v) => setEdit({ ...edit, classId: v === 'all' ? '' : v })}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="All classes" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All classes</SelectItem>{(classes || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
