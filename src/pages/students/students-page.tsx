import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, Plus, Search, Eye, Trash2, Users, Download,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import { TableSkeleton } from '@/components/shared/loading-states';
import { Pagination } from '@/components/shared/pagination';
import { studentsApi, classesApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AdmissionWizard } from '@/pages/students/admission-wizard';
import { formatDate, initials, toCSV, downloadFile } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/context/auth-context';
import { canWrite } from '@/lib/permissions';

export function StudentsPage() {
  const { profile } = useAuth();
  const canEdit = canWrite(profile?.role, 'students');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['students', page, search, classFilter, statusFilter],
    queryFn: () => studentsApi.list({ page, search, classId: classFilter, status: statusFilter }),
  });
  const { data: totalStudents } = useQuery({ queryKey: ['student-count'], queryFn: studentsApi.count });
  const { data: todayAdm } = useQuery({ queryKey: ['today-adm'], queryFn: studentsApi.todayAdmissions });
  const { data: classes } = useQuery({ queryKey: ['classes'], queryFn: classesApi.list });

  const deleteMutation = useMutation({
    mutationFn: studentsApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      toast.success('Student removed');
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportCSV = () => {
    if (!data) return;
    const rows = data.data.map((s) => ({
      AdmissionNo: s.admission_number,
      Name: `${s.first_name} ${s.last_name}`,
      Gender: s.gender,
      Class: classes?.find((c) => c.id === s.class_id)?.name || '',
      Phone: s.phone,
      Guardian: s.guardian_name,
      Status: s.status,
      AdmissionDate: formatDate(s.admission_date),
    }));
    downloadFile(toCSV(rows), 'students.csv');
    toast.success('Exported to CSV');
  };

  return (
    <div>
      <PageHeader
        title="Students"
        description="Manage student admissions, profiles, and records"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCSV}><Download className="mr-2 h-4 w-4" />Export</Button>
            {canEdit && <Button size="sm" onClick={() => setWizardOpen(true)}><Plus className="mr-2 h-4 w-4" />New Admission</Button>}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Total Students" value={totalStudents ?? 0} icon={GraduationCap} color="primary" />
        <StatCard title="Today's Admissions" value={todayAdm ?? 0} icon={Users} color="success" />
        <StatCard title="Active" value={data?.total ?? 0} icon={Users} color="warning" />
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or admission number..."
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Select value={classFilter} onValueChange={(v) => { setClassFilter(v === 'all' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="All Classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {(classes || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6"><TableSkeleton /></div>
          ) : !data?.data.length ? (
            <EmptyState
              icon={GraduationCap}
              title="No students found"
              description="Start by admitting your first student"
              action={canEdit ? <Button size="sm" onClick={() => setWizardOpen(true)}><Plus className="mr-2 h-4 w-4" />New Admission</Button> : undefined}
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Admission No</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Guardian</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((s) => (
                    <motion.tr
                      key={s.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-border hover:bg-muted/50"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(`${s.first_name} ${s.last_name}`)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{s.first_name} {s.last_name}</p>
                            <p className="text-xs text-muted-foreground">{s.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{s.admission_number}</TableCell>
                      <TableCell>{classes?.find((c) => c.id === s.class_id)?.name || '-'}</TableCell>
                      <TableCell className="text-sm">{s.guardian_name || '-'}</TableCell>
                      <TableCell className="text-sm">{s.phone || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={s.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/app/students/${s.id}`)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canEdit && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteId(s.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>}
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={page} pageSize={10} total={data.total} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Wizard */}
      <AnimatePresence>
        {wizardOpen && (
          <AdmissionWizard onClose={() => setWizardOpen(false)} onCreated={() => {
            qc.invalidateQueries({ queryKey: ['students'] });
            qc.invalidateQueries({ queryKey: ['student-count'] });
          }} />
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove student?</AlertDialogTitle>
            <AlertDialogDescription>This will mark the student as removed. The record is retained for audit purposes.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
