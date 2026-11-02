import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CalendarCheck, Check, X, Clock, Users, Download, Lock, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { LoadingState } from '@/components/shared/loading-states';
import { attendanceApi, studentsApi, staffApi, teacherAssignmentsApi, classesApi, sectionsApi } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn, formatDate, initials, toCSV, downloadFile } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/context/auth-context';
import type { Attendance } from '@/types';

type Status = 'present' | 'absent' | 'late' | 'half_day';
const ATTENDANCE_WINDOW_START = 9 * 60;
const ATTENDANCE_WINDOW_END = 9 * 60 + 30;

interface Person {
  id: string;
  first_name: string;
  last_name: string;
  admission_number?: string;
  employee_number?: string;
  class_id?: string | null;
  section_id?: string | null;
}

function isWithinAttendanceWindow(): boolean {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= ATTENDANCE_WINDOW_START && minutes <= ATTENDANCE_WINDOW_END;
}

export function AttendancePage() {
  const { profile } = useAuth();
  const role = profile?.role;
  const isStudent = role === 'student';
  const isTeacher = role === 'teacher';
  const isAdmin = role === 'super_admin' || role === 'admin' || role === 'principal';

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [tab, setTab] = useState<'student' | 'staff'>('student');
  const [records, setRecords] = useState<Record<string, Status>>({});
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const qc = useQueryClient();

  const { data: classes } = useQuery({ queryKey: ['classes'], queryFn: classesApi.list });
  const { data: allSections } = useQuery({ queryKey: ['sections'], queryFn: () => sectionsApi.list() });

  const { data: teacherAssignments } = useQuery({
    queryKey: ['teacher-assignments', profile?.id],
    queryFn: async () => {
      const allStaff = await staffApi.list({ pageSize: 200 });
      const me = allStaff.data.find((s) => s.user_id === profile?.id || s.email === profile?.email);
      if (!me) return [];
      return teacherAssignmentsApi.list(me.id);
    },
    enabled: isTeacher,
  });
  const assignedClassIds = (teacherAssignments || []).map((a) => a.class_id);

  const { data: studentsData } = useQuery({
    queryKey: ['students-all'],
    queryFn: () => studentsApi.list({ pageSize: 500 }),
    enabled: !isStudent,
  });

  const { data: myStudentRecord } = useQuery({
    queryKey: ['my-student-record'],
    queryFn: async () => {
      const all = await studentsApi.list({ pageSize: 500 });
      return all.data.find((s) => s.email === profile?.email) || null;
    },
    enabled: isStudent,
  });

  const { data: staffData } = useQuery({
    queryKey: ['staff-all'],
    queryFn: () => staffApi.list({ pageSize: 200 }),
    enabled: isAdmin && tab === 'staff',
  });

  const { data: myStaffRecord } = useQuery({
    queryKey: ['my-staff-record'],
    queryFn: async () => {
      const all = await staffApi.list({ pageSize: 200 });
      return all.data.find((s) => s.user_id === profile?.id || s.email === profile?.email) || null;
    },
    enabled: isTeacher,
  });

  const { data: existing } = useQuery({
    queryKey: ['attendance', date, tab],
    queryFn: () => attendanceApi.listForDate(date, tab),
    enabled: !!date && !isStudent,
  });

  const { data: myAttendance } = useQuery({
    queryKey: ['my-attendance', date],
    queryFn: async () => {
      if (!myStaffRecord) return null;
      const recs = await attendanceApi.listForDate(date, 'staff');
      return recs.find((r) => r.person_id === myStaffRecord.id) || null;
    },
    enabled: isTeacher && !!myStaffRecord,
  });

  const { data: myStudentAttendance } = useQuery({
    queryKey: ['my-student-attendance', date],
    queryFn: async () => {
      if (!myStudentRecord) return null;
      const recs = await attendanceApi.listForDate(date, 'student');
      return recs.find((r) => r.person_id === myStudentRecord.id) || null;
    },
    enabled: isStudent && !!myStudentRecord,
  });

  useEffect(() => {
    if (existing) {
      const r: Record<string, Status> = {};
      existing.forEach((a: Attendance) => { r[a.person_id] = a.status as Status; });
      setRecords(r);
    } else {
      setRecords({});
    }
  }, [existing, date, tab]);

  const saveMut = useMutation({
    mutationFn: (recs: { person_id: string; person_type: 'student' | 'staff'; date: string; status: Status }[]) =>
      attendanceApi.upsertMany(recs),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] });
      qc.invalidateQueries({ queryKey: ['my-attendance'] });
      toast.success('Attendance saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markOwnMut = useMutation({
    mutationFn: (status: Status) => {
      if (!myStaffRecord) throw new Error('Staff record not found');
      return attendanceApi.upsertMany([{ person_id: myStaffRecord.id, person_type: 'staff', date, status }]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-attendance'] });
      toast.success('Attendance marked');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  let list: Person[] = [];
  if (isStudent) {
    list = myStudentRecord ? [myStudentRecord as Person] : [];
  } else if (isTeacher && tab === 'student') {
    list = (studentsData?.data || []).filter((s) => {
      if (!selectedClass) return assignedClassIds.includes(s.class_id || '');
      if (selectedSection) return s.class_id === selectedClass && s.section_id === selectedSection;
      return s.class_id === selectedClass;
    }) as Person[];
  } else if (isAdmin && tab === 'student') {
    list = (studentsData?.data || []).filter((s) => {
      if (!selectedClass) return true;
      if (selectedSection) return s.class_id === selectedClass && s.section_id === selectedSection;
      return s.class_id === selectedClass;
    }) as Person[];
  } else if (isAdmin && tab === 'staff') {
    list = (staffData?.data || []) as Person[];
  } else if (isTeacher && tab === 'staff') {
    list = myStaffRecord ? [myStaffRecord as Person] : [];
  }

  const setStatus = (id: string, status: Status) => setRecords((r) => ({ ...r, [id]: status }));
  const markAll = (status: Status) => {
    const r: Record<string, Status> = {};
    list.forEach((p) => { r[p.id] = status; });
    setRecords(r);
  };
  const save = () => {
    const recs = list.map((p) => ({ person_id: p.id, person_type: tab, date, status: records[p.id] || 'present' }));
    saveMut.mutate(recs);
  };

  const presentCount = list.filter((p) => records[p.id] === 'present' || !records[p.id]).length;
  const absentCount = list.filter((p) => records[p.id] === 'absent').length;
  const lateCount = list.filter((p) => records[p.id] === 'late').length;

  const exportCSV = () => {
    const rows = list.map((p) => ({ Name: `${p.first_name} ${p.last_name}`, Date: formatDate(date), Status: records[p.id] || 'present' }));
    downloadFile(toCSV(rows), `attendance-${date}.csv`);
  };

  const withinWindow = isWithinAttendanceWindow();
  const teacherSelfMarked = !!myAttendance;

  const statusButtons: { v: Status; label: string; cls: string }[] = [
    { v: 'present', label: 'P', cls: 'bg-success text-white' },
    { v: 'absent', label: 'A', cls: 'bg-destructive text-white' },
    { v: 'late', label: 'L', cls: 'bg-warning text-white' },
    { v: 'half_day', label: 'H', cls: 'bg-muted-foreground text-white' },
  ];

  // STUDENT VIEW
  if (isStudent) {
    return (
      <div>
        <PageHeader title="My Attendance" description="View your attendance records" />
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Attendance for {formatDate(date)}</CardTitle></CardHeader>
          <CardContent>
            {!myStudentRecord ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No student record linked to your account.</p>
            ) : myStudentAttendance ? (
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10"><AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(`${myStudentRecord.first_name} ${myStudentRecord.last_name}`)}</AvatarFallback></Avatar>
                  <div><p className="text-sm font-medium">{myStudentRecord.first_name} {myStudentRecord.last_name}</p><p className="text-xs text-muted-foreground">{myStudentRecord.admission_number}</p></div>
                </div>
                <Badge className={myStudentAttendance.status === 'present' ? 'bg-success text-white' : myStudentAttendance.status === 'absent' ? 'bg-destructive text-white' : 'bg-warning text-white'}>{myStudentAttendance.status}</Badge>
              </div>
            ) : (
              <div className="flex flex-col items-center py-8 text-center">
                <CalendarCheck className="mb-2 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No attendance recorded for this date</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // TEACHER VIEW
  if (isTeacher) {
    return (
      <div>
        <PageHeader title="Attendance" description="Mark your attendance and student attendance for assigned classes" />

        <Card className="mb-4">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarCheck className="h-4 w-4" /> My Attendance - {formatDate(new Date().toISOString().slice(0, 10))}</CardTitle></CardHeader>
          <CardContent>
            {teacherSelfMarked ? (
              <div className="flex items-center gap-3 rounded-lg bg-success/10 p-4">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <div><p className="text-sm font-semibold text-success">Attendance Already Marked</p><p className="text-xs text-muted-foreground">Status: <Badge className="ml-1">{myAttendance?.status}</Badge></p></div>
              </div>
            ) : !withinWindow ? (
              <div className="flex items-center gap-3 rounded-lg bg-muted p-4">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <div><p className="text-sm font-semibold">Attendance Window Closed</p><p className="text-xs text-muted-foreground">You can only mark attendance between 9:00 AM and 9:30 AM</p></div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-sm">Mark your attendance for today:</p>
                <Button size="sm" className="bg-success hover:bg-success/90" onClick={() => markOwnMut.mutate('present')} disabled={markOwnMut.isPending}><Check className="mr-1.5 h-4 w-4" />Present</Button>
                <Button size="sm" variant="destructive" onClick={() => markOwnMut.mutate('absent')} disabled={markOwnMut.isPending}><X className="mr-1.5 h-4 w-4" />Absent</Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard title="Present" value={presentCount} icon={Check} color="success" />
          <StatCard title="Absent" value={absentCount} icon={X} color="destructive" />
          <StatCard title="Late" value={lateCount} icon={Clock} color="warning" />
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">Student Attendance - Assigned Classes</CardTitle>
              <div className="flex items-center gap-2">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
                <Button variant="outline" size="sm" onClick={exportCSV}><Download className="mr-2 h-4 w-4" />Export</Button>
                <Button size="sm" onClick={save} disabled={saveMut.isPending || !list.length}>{saveMut.isPending ? 'Saving...' : 'Save'}</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {!list.length ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Users className="mb-2 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{assignedClassIds.length === 0 ? 'No classes assigned. Contact admin.' : 'No students found.'}</p>
              </div>
            ) : list.map((p) => (
              <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/30">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9"><AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(`${p.first_name} ${p.last_name}`)}</AvatarFallback></Avatar>
                  <div><p className="text-sm font-medium">{p.first_name} {p.last_name}</p><p className="text-xs text-muted-foreground">{p.admission_number}</p></div>
                </div>
                <div className="flex gap-1">
                  {statusButtons.map((b) => (
                    <button key={b.v} onClick={() => setStatus(p.id, b.v)} className={cn('flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold transition-all', records[p.id] === b.v ? b.cls : 'bg-muted text-muted-foreground hover:bg-muted/70')}>{b.label}</button>
                  ))}
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ADMIN VIEW
  return (
    <div>
      <PageHeader title="Attendance" description="Mark and track attendance" actions={<Button variant="outline" size="sm" onClick={exportCSV}><Download className="mr-2 h-4 w-4" />Export</Button>} />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Present" value={presentCount} icon={Check} color="success" />
        <StatCard title="Absent" value={absentCount} icon={X} color="destructive" />
        <StatCard title="Late" value={lateCount} icon={Clock} color="warning" />
      </div>
      <Tabs value={tab} onValueChange={(v) => { setTab(v as 'student' | 'staff'); setRecords({}); }}>
        <TabsList className="mb-4">
          <TabsTrigger value="student"><Users className="mr-2 h-4 w-4" />Students</TabsTrigger>
          <TabsTrigger value="staff"><CalendarCheck className="mr-2 h-4 w-4" />Staff</TabsTrigger>
        </TabsList>
        <TabsContent value="student">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base">Student Attendance</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={selectedClass || 'all'} onValueChange={(v) => { setSelectedClass(v === 'all' ? '' : v); setSelectedSection(''); }}>
                    <SelectTrigger className="w-32"><SelectValue placeholder="All Classes" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All Classes</SelectItem>{(classes || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                  {selectedClass && (allSections || []).filter((s) => s.class_id === selectedClass).length > 0 && (
                    <Select value={selectedSection || 'all'} onValueChange={(v) => setSelectedSection(v === 'all' ? '' : v)}>
                      <SelectTrigger className="w-28"><SelectValue placeholder="All Sections" /></SelectTrigger>
                      <SelectContent><SelectItem value="all">All Sections</SelectItem>{(allSections || []).filter((s) => s.class_id === selectedClass).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                  <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setRecords({}); }} className="w-40" />
                  <Button variant="outline" size="sm" onClick={() => markAll('present')}>All Present</Button>
                  <Button size="sm" onClick={save} disabled={saveMut.isPending || !list.length}>{saveMut.isPending ? 'Saving...' : 'Save'}</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {!list.length ? <LoadingState /> : list.map((p) => (
                <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9"><AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(`${p.first_name} ${p.last_name}`)}</AvatarFallback></Avatar>
                    <div><p className="text-sm font-medium">{p.first_name} {p.last_name}</p><p className="text-xs text-muted-foreground">{p.admission_number}</p></div>
                  </div>
                  <div className="flex gap-1">
                    {statusButtons.map((b) => (
                      <button key={b.v} onClick={() => setStatus(p.id, b.v)} className={cn('flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold transition-all', records[p.id] === b.v ? b.cls : 'bg-muted text-muted-foreground hover:bg-muted/70')}>{b.label}</button>
                    ))}
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="staff">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Staff Attendance</CardTitle>
                <div className="flex items-center gap-2">
                  <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setRecords({}); }} className="w-40" />
                  <Button variant="outline" size="sm" onClick={() => markAll('present')}>All Present</Button>
                  <Button size="sm" onClick={save} disabled={saveMut.isPending || !list.length}>{saveMut.isPending ? 'Saving...' : 'Save'}</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {!list.length ? <LoadingState /> : list.map((p) => (
                <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9"><AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(`${p.first_name} ${p.last_name}`)}</AvatarFallback></Avatar>
                    <div><p className="text-sm font-medium">{p.first_name} {p.last_name}</p><p className="text-xs text-muted-foreground">{p.employee_number}</p></div>
                  </div>
                  <div className="flex gap-1">
                    {statusButtons.map((b) => (
                      <button key={b.v} onClick={() => setStatus(p.id, b.v)} className={cn('flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold transition-all', records[p.id] === b.v ? b.cls : 'bg-muted text-muted-foreground hover:bg-muted/70')}>{b.label}</button>
                    ))}
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
