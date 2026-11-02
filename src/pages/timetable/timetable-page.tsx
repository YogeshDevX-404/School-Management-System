import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Plus, Printer, Trash2, X, Save } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { classesApi, sectionsApi, subjectsApi, staffApi, timetableApi } from '@/services/api';
import { useAuth } from '@/context/auth-context';
import { canWrite } from '@/lib/permissions';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [
  { time: '09:00 - 10:00', label: 'Period 1', start: '09:00', end: '10:00' },
  { time: '10:00 - 11:00', label: 'Period 2', start: '10:00', end: '11:00' },
  { time: '11:00 - 12:00', label: 'Period 3', start: '11:00', end: '12:00' },
  { time: '12:00 - 13:00', label: 'Period 4', start: '12:00', end: '13:00' },
  { time: '14:00 - 15:00', label: 'Period 5', start: '14:00', end: '15:00' },
  { time: '15:00 - 16:00', label: 'Period 6', start: '15:00', end: '16:00' },
];

const SUBJECT_COLORS = ['bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300', 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300', 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300', 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300'];

const NONE_VAL = '__none__';

export function TimetablePage() {
  const { profile } = useAuth();
  const role = profile?.role;
  const canEdit = canWrite(role, 'timetable');

  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [editing, setEditing] = useState<{ day: string; period: number } | null>(null);
  const [editSubject, setEditSubject] = useState(NONE_VAL);
  const [editTeacher, setEditTeacher] = useState(NONE_VAL);
  const [editRoom, setEditRoom] = useState('');
  const queryClient = useQueryClient();

  const { data: classes } = useQuery({ queryKey: ['classes'], queryFn: classesApi.list });
  const { data: sections } = useQuery({ queryKey: ['sections'], queryFn: () => sectionsApi.list() });
  const { data: subjects } = useQuery({ queryKey: ['subjects'], queryFn: subjectsApi.list });
  const { data: staff } = useQuery({ queryKey: ['staff-all'], queryFn: () => staffApi.list({ pageSize: 200 }) });

  const teachers = (staff?.data || []).filter((s) => s.role === 'teacher');
  const classSections = (sections || []).filter((s) => !classId || s.class_id === classId);

  const { data: entries } = useQuery({
    queryKey: ['timetable', classId, sectionId],
    queryFn: () => timetableApi.list(classId || undefined, sectionId || undefined),
    enabled: !!classId && !!sectionId,
  });

  const createMut = useMutation({
    mutationFn: timetableApi.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['timetable'] }); toast.success('Entry saved'); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: timetableApi.remove,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['timetable'] }); toast.success('Entry deleted'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const getEntry = (day: string, period: number) => {
    return entries?.find((e) => e.day_of_week === day && e.period_number === period + 1);
  };

  const openEditor = (day: string, period: number) => {
    if (!canEdit) return;
    const existing = getEntry(day, period);
    setEditSubject(existing?.subject_id || NONE_VAL);
    setEditTeacher(existing?.teacher_id || NONE_VAL);
    setEditRoom(existing?.room || '');
    setEditing({ day, period });
  };

  const saveEntry = async () => {
    if (!editing || !classId || !sectionId) return;
    const existing = getEntry(editing.day, editing.period);
    try {
      if (existing) {
        if (editSubject === NONE_VAL) {
          await deleteMut.mutateAsync(existing.id);
        } else {
          await timetableApi.update(existing.id, {
            subject_id: editSubject === NONE_VAL ? null : editSubject,
            teacher_id: editTeacher === NONE_VAL ? null : editTeacher,
            room: editRoom || null,
          });
          queryClient.invalidateQueries({ queryKey: ['timetable'] });
          toast.success('Entry updated');
        }
      } else if (editSubject !== NONE_VAL) {
        await createMut.mutateAsync({
          class_id: classId,
          section_id: sectionId,
          subject_id: editSubject,
          teacher_id: editTeacher === NONE_VAL ? null : editTeacher,
          day_of_week: editing.day,
          period_number: editing.period + 1,
          start_time: PERIODS[editing.period].start,
          end_time: PERIODS[editing.period].end,
          room: editRoom || null,
        });
      }
      setEditing(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const print = () => {
    window.print();
    toast.success('Printing timetable');
  };

  const subjectName = (id: string | null) => subjects?.find((s) => s.id === id)?.name || '';
  const teacherName = (id: string | null) => {
    const t = staff?.data.find((s) => s.id === id);
    return t ? `${t.first_name} ${t.last_name}` : '';
  };

  return (
    <div>
      <PageHeader
        title="Timetable"
        description={canEdit ? 'Create and manage weekly class schedules' : 'View weekly class schedule'}
        actions={<Button variant="outline" size="sm" onClick={print}><Printer className="mr-2 h-4 w-4" />Print</Button>}
      />

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label>Class</Label>
            <Select value={classId} onValueChange={(v) => { setClassId(v); setSectionId(''); }}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>{(classes || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label>Section</Label>
            <Select value={sectionId} onValueChange={setSectionId}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select section" /></SelectTrigger>
              <SelectContent>{classSections.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {classId && sectionId ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" />
              Weekly Schedule
              <span className="text-muted-foreground">· {classes?.find((c) => c.id === classId)?.name} {sections?.find((s) => s.id === sectionId)?.name || ''}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto scrollbar-thin">
            <div className="min-w-[700px]">
              <div className="grid grid-cols-[100px_repeat(5,1fr)] gap-2">
                <div className="flex items-center justify-center text-xs font-semibold text-muted-foreground">Time</div>
                {DAYS.map((d) => <div key={d} className="rounded-lg bg-muted p-2 text-center text-xs font-semibold">{d}</div>)}

                {PERIODS.map((period, pi) => (
                  <div key={pi} className="contents">
                    <div className="flex flex-col items-center justify-center rounded-lg bg-muted/50 p-2 text-center">
                      <span className="text-[10px] font-semibold text-muted-foreground">{period.label}</span>
                      <span className="mt-0.5 text-[10px] text-muted-foreground">{period.time}</span>
                    </div>
                    {DAYS.map((day) => {
                      const entry = getEntry(day, pi);
                      const colorIdx = entry?.subject_id ? (entry.subject_id.charCodeAt(0) + entry.subject_id.charCodeAt(1)) % SUBJECT_COLORS.length : 0;
                      return (
                        <motion.div
                          key={day}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: (DAYS.indexOf(day) * PERIODS.length + pi) * 0.01 }}
                          onClick={() => openEditor(day, pi)}
                          className={cn(
                            'flex min-h-[64px] flex-col justify-center rounded-lg p-2 transition-all',
                            entry ? SUBJECT_COLORS[colorIdx] : 'bg-muted/30',
                            canEdit && 'cursor-pointer hover:ring-2 hover:ring-primary/40'
                          )}
                        >
                          {entry && entry.subject_id ? (
                            <>
                              <p className="text-xs font-semibold">{subjectName(entry.subject_id)}</p>
                              <p className="mt-0.5 text-[10px] opacity-80">{teacherName(entry.teacher_id)}</p>
                              {entry.room && <p className="mt-0.5 text-[10px] opacity-60">Room: {entry.room}</p>}
                            </>
                          ) : canEdit ? (
                            <div className="flex items-center justify-center text-muted-foreground/50">
                              <Plus className="h-4 w-4" />
                            </div>
                          ) : null}
                        </motion.div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CalendarDays className="mb-3 h-12 w-12 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Select a class and section to view the timetable</p>
        </div>
      )}

      {/* Edit modal */}
      <AnimatePresence>
        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setEditing(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-bold">Edit Slot</h3>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
              </div>
              <p className="mb-4 text-xs text-muted-foreground">{editing.day} · {PERIODS[editing.period].label} ({PERIODS[editing.period].time})</p>
              <div className="space-y-4">
                <div>
                  <Label>Subject</Label>
                  <Select value={editSubject} onValueChange={setEditSubject}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select subject" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VAL}>None (Clear slot)</SelectItem>
                      {(subjects || []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Teacher</Label>
                  <Select value={editTeacher} onValueChange={setEditTeacher}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select teacher" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VAL}>None</SelectItem>
                      {teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Room</Label>
                  <Input className="mt-1.5" value={editRoom} onChange={(e) => setEditRoom(e.target.value)} placeholder="Room number" />
                </div>
                <div className="flex justify-between pt-2">
                  {getEntry(editing.day, editing.period) && (
                    <Button variant="destructive" onClick={() => { deleteMut.mutate(getEntry(editing.day, editing.period)!.id); setEditing(null); }}>
                      <Trash2 className="mr-2 h-4 w-4" />Delete
                    </Button>
                  )}
                  <Button onClick={saveEntry} className="ml-auto"><Save className="mr-2 h-4 w-4" />Save</Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
