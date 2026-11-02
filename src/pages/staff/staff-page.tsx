import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Users, Plus, Search, Pencil, Trash2, Download,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import { TableSkeleton } from '@/components/shared/loading-states';
import { Pagination } from '@/components/shared/pagination';
import { staffApi, notificationsApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { STAFF_ROLES, GENDERS } from '@/constants';
import type { Staff, StaffRole } from '@/types';
import { formatDate, formatCurrency, initials, toCSV, downloadFile } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/context/auth-context';
import { canWrite } from '@/lib/permissions';

const schema = z.object({
  employee_number: z.string().min(1, 'Required'),
  first_name: z.string().min(2, 'Required'),
  last_name: z.string().min(1, 'Required'),
  email: z.string().email('Valid email'),
  phone: z.string().min(6, 'Required'),
  gender: z.enum(['male', 'female', 'other']),
  role: z.string().min(1, 'Required'),
  department: z.string().optional(),
  qualification: z.string().optional(),
  salary: z.coerce.number().min(0),
  joining_date: z.string().min(1, 'Required'),
  address_line: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export function StaffPage() {
  const { profile } = useAuth();
  const canEdit = canWrite(profile?.role, 'staff');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['staff', page, search, roleFilter],
    queryFn: () => staffApi.list({ page, search, role: roleFilter }),
  });
  const { data: totalStaff } = useQuery({ queryKey: ['staff-count'], queryFn: staffApi.count });
  const { data: teacherCount } = useQuery({ queryKey: ['teacher-count'], queryFn: staffApi.teacherCount });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { gender: 'male', role: 'teacher', joining_date: new Date().toISOString().slice(0, 10) },
  });

  const createMut = useMutation({
    mutationFn: (p: FormData) => staffApi.create({ ...p, role: p.role as StaffRole }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      notificationsApi.create({ user_id: null, title: 'New Staff Added', message: `${vars.first_name} ${vars.last_name} joined as ${vars.role}`, type: 'staff' }).catch(() => {});
      toast.success('Staff added'); setDialogOpen(false); reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, p }: { id: string; p: FormData }) => staffApi.update(id, { ...p, role: p.role as StaffRole }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff'] }); toast.success('Staff updated'); setDialogOpen(false); reset(); setEditId(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: staffApi.remove,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff'] }); toast.success('Staff removed'); setDeleteId(null); },
  });

  const openAdd = () => { reset({ gender: 'male', role: 'teacher', joining_date: new Date().toISOString().slice(0, 10) }); setEditId(null); setDialogOpen(true); };
  const openEdit = (s: Staff) => {
    setEditId(s.id);
    reset({
      employee_number: s.employee_number, first_name: s.first_name, last_name: s.last_name,
      email: s.email || '', phone: s.phone || '', gender: (s.gender || 'male') as 'male' | 'female' | 'other',
      role: s.role, department: s.department || '', qualification: s.qualification || '',
      salary: s.salary, joining_date: s.joining_date, address_line: s.address_line || '',
      city: s.city || '', state: s.state || '', pincode: s.pincode || '',
    });
    setDialogOpen(true);
  };

  const onSubmit = (d: FormData) => {
    if (editId) updateMut.mutate({ id: editId, p: d });
    else createMut.mutate(d);
  };

  const exportCSV = () => {
    if (!data) return;
    const rows = data.data.map((s) => ({
      EmpNo: s.employee_number, Name: `${s.first_name} ${s.last_name}`, Role: s.role,
      Department: s.department, Email: s.email, Phone: s.phone, Salary: s.salary, Joined: formatDate(s.joining_date),
    }));
    downloadFile(toCSV(rows), 'staff.csv');
    toast.success('Exported to CSV');
  };

  return (
    <div>
      <PageHeader
        title="Staff"
        description="Manage teachers, administrators, and support staff"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCSV}><Download className="mr-2 h-4 w-4" />Export</Button>
            {canEdit && <Button size="sm" onClick={openAdd}><Plus className="mr-2 h-4 w-4" />Add Staff</Button>}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Total Staff" value={totalStaff ?? 0} icon={Users} color="primary" />
        <StatCard title="Teachers" value={teacherCount ?? 0} icon={Users} color="success" />
        <StatCard title="Showing" value={data?.total ?? 0} icon={Users} color="warning" />
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name or employee number..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v === 'all' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="All Roles" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {STAFF_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-6"><TableSkeleton /></div> : !data?.data.length ? (
            <EmptyState icon={Users} title="No staff found" description="Add your first staff member" action={canEdit ? <Button size="sm" onClick={openAdd}><Plus className="mr-2 h-4 w-4" />Add Staff</Button> : undefined} />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead>
                    <TableHead>Emp No</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Salary</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((s) => (
                    <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-border hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9"><AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(`${s.first_name} ${s.last_name}`)}</AvatarFallback></Avatar>
                          <div><p className="text-sm font-medium">{s.first_name} {s.last_name}</p><p className="text-xs text-muted-foreground">{s.email}</p></div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{s.employee_number}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-[10px] capitalize">{s.role}</Badge></TableCell>
                      <TableCell className="text-sm">{s.department || '-'}</TableCell>
                      <TableCell className="text-sm font-medium">{formatCurrency(s.salary)}</TableCell>
                      <TableCell className="text-sm">{formatDate(s.joining_date)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                          {canEdit && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteId(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
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

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg">
          <DialogHeader><DialogTitle>{editId ? 'Edit Staff' : 'Add Staff Member'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Employee Number</Label><Input className="mt-1.5" {...register('employee_number')} />{errors.employee_number && <p className="text-xs text-destructive">{errors.employee_number.message}</p>}</div>
              <div><Label>Joining Date</Label><Input type="date" className="mt-1.5" {...register('joining_date')} />{errors.joining_date && <p className="text-xs text-destructive">{errors.joining_date.message}</p>}</div>
              <div><Label>First Name</Label><Input className="mt-1.5" {...register('first_name')} />{errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}</div>
              <div><Label>Last Name</Label><Input className="mt-1.5" {...register('last_name')} />{errors.last_name && <p className="text-xs text-destructive">{errors.last_name.message}</p>}</div>
              <div><Label>Email</Label><Input type="email" className="mt-1.5" {...register('email')} />{errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}</div>
              <div><Label>Phone</Label><Input className="mt-1.5" {...register('phone')} />{errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}</div>
              <div>
                <Label>Gender</Label>
                <Select value={watch('gender')} onValueChange={(v) => setValue('gender', v as 'male' | 'female' | 'other')}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{GENDERS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Role</Label>
                <Select value={watch('role')} onValueChange={(v) => setValue('role', v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{STAFF_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Department</Label><Input className="mt-1.5" {...register('department')} /></div>
              <div><Label>Qualification</Label><Input className="mt-1.5" {...register('qualification')} /></div>
              <div><Label>Salary</Label><Input type="number" className="mt-1.5" {...register('salary')} />{errors.salary && <p className="text-xs text-destructive">{errors.salary.message}</p>}</div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>{editId ? 'Update' : 'Add'} Staff</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove staff member?</AlertDialogTitle>
            <AlertDialogDescription>This will mark the staff member as removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteId && deleteMut.mutate(deleteId)}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
