import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CalendarDays, Plus, Check, X, FileText, Trash2, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { LoadingState } from '@/components/shared/loading-states';
import { leaveRequestsApi, staffApi, notificationsApi } from '@/services/api';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/context/auth-context';
import { canWrite } from '@/lib/permissions';

const LEAVE_TYPES = [
  { value: 'casual', label: 'Casual Leave' },
  { value: 'sick', label: 'Sick Leave' },
  { value: 'earned', label: 'Earned Leave' },
  { value: 'maternity', label: 'Maternity Leave' },
  { value: 'other', label: 'Other' },
];

export function LeaveRequestsPage() {
  const { profile } = useAuth();
  const canApprove = canWrite(profile?.role, 'leave_requests');
  const isTeacher = profile?.role === 'teacher';
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reviewItem, setReviewItem] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ leave_type: 'casual' as 'casual' | 'sick' | 'earned' | 'maternity' | 'other', reason: '', start_date: '', end_date: '' });

  const { data: myStaff } = useQuery({
    queryKey: ['my-staff-leave'],
    queryFn: async () => {
      const all = await staffApi.list({ pageSize: 200 });
      return all.data.find((s) => s.user_id === profile?.id || s.email === profile?.email) || null;
    },
    enabled: isTeacher,
  });

  const { data: allStaff } = useQuery({
    queryKey: ['staff-all-leave'],
    queryFn: () => staffApi.list({ pageSize: 200 }),
    enabled: canApprove,
  });

  const { data: requests, isLoading } = useQuery({
    queryKey: ['leave-requests', myStaff?.id],
    queryFn: async () => {
      if (canApprove) return leaveRequestsApi.list();
      if (myStaff) return leaveRequestsApi.list(myStaff.id);
      return [];
    },
    enabled: canApprove || !!myStaff,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!myStaff) throw new Error('Staff record not found');
      const payload = {
        teacher_id: myStaff.id,
        leave_type: form.leave_type,
        reason: form.reason,
        start_date: form.start_date,
        end_date: form.end_date,
      };
      if (editId) {
        return leaveRequestsApi.update(editId, payload);
      }
      return leaveRequestsApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave-requests'] });
      qc.invalidateQueries({ queryKey: ['navbar-notifications'] });
      qc.invalidateQueries({ queryKey: ['dashboard-notifications'] });
      // Send notification to principals/admins (broadcast)
      notificationsApi.create({
        user_id: null,
        title: 'New Leave Request',
        message: `${myStaff?.first_name} ${myStaff?.last_name} requested ${form.leave_type} leave from ${form.start_date} to ${form.end_date}`,
        type: 'leave_request',
        priority: 'medium',
        status: 'pending',
      }).catch(() => {});
      toast.success(editId ? 'Leave request updated' : 'Leave request submitted');
      setOpen(false);
      setEditId(null);
      setForm({ leave_type: 'casual', reason: '', start_date: '', end_date: '' });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: leaveRequestsApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave-requests'] });
      toast.success('Leave request deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'approved' | 'rejected' }) => {
      const req = requests?.find((r) => r.id === id);
      const updated = await leaveRequestsApi.update(id, {
        status,
        reviewed_by: profile?.id,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes,
      });
      if (req) {
        const teacher = allStaff?.data.find((s) => s.id === req.teacher_id);
        if (teacher?.user_id) {
          notificationsApi.create({
            user_id: teacher.user_id,
            title: `Leave ${status === 'approved' ? 'Approved' : 'Rejected'}`,
            message: `Your ${req.leave_type} leave request from ${req.start_date} to ${req.end_date} has been ${status}.`,
            type: 'leave_review',
            priority: status === 'approved' ? 'low' : 'high',
            status: status,
          }).catch(() => {});
        }
      }
      return updated;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['leave-requests'] });
      qc.invalidateQueries({ queryKey: ['navbar-notifications'] });
      qc.invalidateQueries({ queryKey: ['dashboard-notifications'] });
      toast.success(vars.status === 'approved' ? 'Leave approved' : 'Leave rejected');
      setReviewItem(null);
      setReviewNotes('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const teacherName = (id: string) => {
    const t = allStaff?.data.find((s) => s.id === id);
    return t ? `${t.first_name} ${t.last_name}` : 'Unknown';
  };

  return (
    <div>
      <PageHeader
        title={canApprove ? 'Leave Requests' : 'My Leave Requests'}
        description={canApprove ? 'Review and approve teacher leave requests' : 'Submit and track your leave requests'}
        actions={isTeacher ? <Button size="sm" onClick={() => { setEditId(null); setForm({ leave_type: 'casual', reason: '', start_date: '', end_date: '' }); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />New Request</Button> : undefined}
      />

      {isLoading ? <LoadingState /> : !requests?.length ? (
        <EmptyState icon={CalendarDays} title="No leave requests" description={isTeacher ? 'Submit your first leave request' : 'No pending requests'} action={isTeacher ? <Button size="sm" onClick={() => { setEditId(null); setForm({ leave_type: 'casual', reason: '', start_date: '', end_date: '' }); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />New Request</Button> : undefined} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {canApprove && <TableHead>Teacher</TableHead>}
                  <TableHead>Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Status</TableHead>
                  {canApprove && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => (
                  <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-border hover:bg-muted/50">
                    {canApprove && <TableCell className="text-sm font-medium">{teacherName(r.teacher_id)}</TableCell>}
                    <TableCell><Badge variant="secondary" className="text-[10px]">{LEAVE_TYPES.find((t) => t.value === r.leave_type)?.label}</Badge></TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">{r.reason}</TableCell>
                    <TableCell className="text-sm">{formatDate(r.start_date)}</TableCell>
                    <TableCell className="text-sm">{formatDate(r.end_date)}</TableCell>
                    <TableCell>
                      <Badge className={r.status === 'approved' ? 'bg-success text-white' : r.status === 'rejected' ? 'bg-destructive text-white' : 'bg-warning text-white'}>
                        {r.status === 'approved' ? 'Approved' : r.status === 'rejected' ? 'Rejected' : 'Pending'}
                      </Badge>
                    </TableCell>
                    {(canApprove || isTeacher) && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {canApprove && r.status === 'pending' && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setReviewItem(r.id); setReviewNotes(''); }} title="Review"><FileText className="h-4 w-4" /></Button>
                          )}
                          {canApprove && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteMut.mutate(r.id)} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          )}
                          {isTeacher && r.status === 'pending' && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                              setEditId(r.id);
                              setForm({ leave_type: r.leave_type, reason: r.reason, start_date: r.start_date, end_date: r.end_date });
                              setOpen(true);
                            }} title="Edit"><Pencil className="h-4 w-4" /></Button>
                          )}
                          {!canApprove && r.status !== 'pending' && (
                            <span className="text-xs text-muted-foreground">{r.review_notes || '-'}</span>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? 'Edit Leave Request' : 'New Leave Request'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Leave Type</Label>
              <Select value={form.leave_type} onValueChange={(v) => setForm({ ...form, leave_type: v as 'casual' | 'sick' | 'earned' | 'maternity' | 'other' })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{LEAVE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Reason</Label><Textarea className="mt-1.5" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Explain the reason for leave..." /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Start Date</Label><Input type="date" className="mt-1.5" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><Label>End Date</Label><Input type="date" className="mt-1.5" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !form.reason || !form.start_date || !form.end_date}>{createMut.isPending ? 'Saving...' : editId ? 'Update' : 'Submit'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review dialog */}
      <Dialog open={!!reviewItem} onOpenChange={(o) => !o && setReviewItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Review Leave Request</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Review Notes</Label><Textarea className="mt-1.5" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Add notes (optional)..." /></div>
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={() => approveMut.mutate({ id: reviewItem!, status: 'rejected' })} disabled={approveMut.isPending}><X className="mr-2 h-4 w-4" />Reject</Button>
            <Button className="bg-success hover:bg-success/90" onClick={() => approveMut.mutate({ id: reviewItem!, status: 'approved' })} disabled={approveMut.isPending}><Check className="mr-2 h-4 w-4" />Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
