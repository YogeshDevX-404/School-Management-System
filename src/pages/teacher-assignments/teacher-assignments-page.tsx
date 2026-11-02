import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2, BookOpen, Users, GraduationCap, Layers } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import { LoadingState } from '@/components/shared/loading-states';
import {
  teacherAssignmentsApi, staffApi, classesApi, sectionsApi, subjectsApi, sessionsApi,
} from '@/services/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { initials, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/context/auth-context';
import type { TeacherClassAssignment, Staff, ClassRow, Section, Subject, AcademicSession } from '@/types';

const NONE_VAL = '__none__';

export function TeacherAssignmentsPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    teacher_id: '', class_id: '', section_id: '', subject_id: '', session_id: '',
  });

  const { data: assignments, isLoading } = useQuery({
    queryKey: ['teacher-assignments-all'],
    queryFn: teacherAssignmentsApi.listAll,
  });
  const { data: staffAll } = useQuery({ queryKey: ['staff-all-assign'], queryFn: () => staffApi.list({ pageSize: 200 }) });
  const { data: classes } = useQuery({ queryKey: ['classes-assign'], queryFn: classesApi.list });
  const { data: sections } = useQuery({ queryKey: ['sections-assign'], queryFn: () => sectionsApi.list() });
  const { data: subjects } = useQuery({ queryKey: ['subjects-assign'], queryFn: subjectsApi.list });
  const { data: sessions } = useQuery({ queryKey: ['sessions-assign'], queryFn: sessionsApi.list });

  const teachers = (staffAll?.data || []).filter((s) => s.role === 'teacher');

  const createMut = useMutation({
    mutationFn: async () => {
      const payload = {
        teacher_id: form.teacher_id,
        class_id: form.class_id,
        section_id: form.section_id === NONE_VAL ? null : form.section_id || null,
        subject_id: form.subject_id === NONE_VAL ? null : form.subject_id || null,
        session_id: form.session_id === NONE_VAL ? null : form.session_id || null,
        is_active: true,
        created_by: profile?.id || null,
      };
      if (editId) {
        return teacherAssignmentsApi.update(editId, payload);
      }
      return teacherAssignmentsApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teacher-assignments-all'] });
      qc.invalidateQueries({ queryKey: ['teacher-assignments'] });
      toast.success(editId ? 'Assignment updated' : 'Assignment created');
      setOpen(false);
      setEditId(null);
      setForm({ teacher_id: '', class_id: '', section_id: '', subject_id: '', session_id: '' });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: teacherAssignmentsApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teacher-assignments-all'] });
      qc.invalidateQueries({ queryKey: ['teacher-assignments'] });
      toast.success('Assignment deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const teacherName = (id: string) => {
    const t = (staffAll?.data || []).find((s) => s.id === id);
    return t ? `${t.first_name} ${t.last_name}` : 'Unknown';
  };
  const teacherEmail = (id: string) => (staffAll?.data || []).find((s) => s.id === id)?.email || '';
  const className = (id: string) => (classes || []).find((c) => c.id === id)?.name || '-';
  const sectionName = (id: string | null | undefined) => id ? (sections || []).find((s) => s.id === id)?.name || '-' : '-';
  const subjectName = (id: string | null | undefined) => id ? (subjects || []).find((s) => s.id === id)?.name || '-' : '-';
  const sessionName = (id: string | null | undefined) => id ? (sessions || []).find((s) => s.id === id)?.name || '-' : '-';

  const openCreate = () => {
    setEditId(null);
    setForm({ teacher_id: '', class_id: '', section_id: '', subject_id: '', session_id: '' });
    setOpen(true);
  };

  const openEdit = (a: TeacherClassAssignment) => {
    setEditId(a.id);
    setForm({
      teacher_id: a.teacher_id,
      class_id: a.class_id,
      section_id: a.section_id || NONE_VAL,
      subject_id: a.subject_id || NONE_VAL,
      session_id: a.session_id || NONE_VAL,
    });
    setOpen(true);
  };

  const classSections = (sections || []).filter((s) => !form.class_id || s.class_id === form.class_id);
  const canSubmit = form.teacher_id && form.class_id;

  return (
    <div>
      <PageHeader
        title="Teacher Assignments"
        description="Assign teachers to classes, sections, subjects, and academic sessions"
        actions={<Button size="sm" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Assign Teacher</Button>}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Assignments" value={assignments?.length ?? 0} icon={Layers} color="primary" />
        <StatCard title="Active Teachers" value={teachers.length} icon={Users} color="success" />
        <StatCard title="Classes" value={classes?.length ?? 0} icon={GraduationCap} color="warning" />
        <StatCard title="Subjects" value={subjects?.length ?? 0} icon={BookOpen} color="chart-4" />
      </div>

      {isLoading ? <LoadingState /> : !assignments?.length ? (
        <EmptyState
          icon={Layers}
          title="No teacher assignments"
          description="Assign teachers to classes and subjects"
          action={<Button size="sm" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Assign Teacher</Button>}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Assigned On</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((a) => (
                  <motion.tr key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-border hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                            {initials(teacherName(a.teacher_id))}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{teacherName(a.teacher_id)}</p>
                          <p className="text-xs text-muted-foreground">{teacherEmail(a.teacher_id)}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{className(a.class_id)}</Badge></TableCell>
                    <TableCell className="text-sm">{sectionName(a.section_id)}</TableCell>
                    <TableCell className="text-sm">{subjectName(a.subject_id)}</TableCell>
                    <TableCell className="text-sm">{sessionName(a.session_id)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(a.created_at, 'dd MMM yyyy')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteMut.mutate(a.id)} title="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Assignment' : 'Assign Teacher'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Teacher</Label>
              <Select value={form.teacher_id || NONE_VAL} onValueChange={(v) => setForm({ ...form, teacher_id: v === NONE_VAL ? '' : v })}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select teacher" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VAL}>None</SelectItem>
                  {teachers.map((t: Staff) => (
                    <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Class</Label>
              <Select value={form.class_id || NONE_VAL} onValueChange={(v) => { setForm({ ...form, class_id: v === NONE_VAL ? '' : v, section_id: '' }); }}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VAL}>None</SelectItem>
                  {(classes || []).map((c: ClassRow) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Section</Label>
              <Select value={form.section_id || NONE_VAL} onValueChange={(v) => setForm({ ...form, section_id: v === NONE_VAL ? '' : v })}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select section" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VAL}>All Sections</SelectItem>
                  {classSections.map((s: Section) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject</Label>
              <Select value={form.subject_id || NONE_VAL} onValueChange={(v) => setForm({ ...form, subject_id: v === NONE_VAL ? '' : v })}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VAL}>No Subject</SelectItem>
                  {(subjects || []).map((s: Subject) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Academic Session</Label>
              <Select value={form.session_id || NONE_VAL} onValueChange={(v) => setForm({ ...form, session_id: v === NONE_VAL ? '' : v })}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select session" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VAL}>No Session</SelectItem>
                  {(sessions || []).map((s: AcademicSession) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !canSubmit}>
              {createMut.isPending ? 'Saving...' : editId ? 'Update' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
