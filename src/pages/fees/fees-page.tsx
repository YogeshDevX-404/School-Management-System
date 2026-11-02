import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Wallet, Plus, Search, Download, Receipt, TrendingUp, DollarSign,
  Pencil, Trash2, RotateCcw, Printer, AlertCircle, Users, CheckCircle2,
  Send, FileText, BarChart3, IndianRupee, Save,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import { TableSkeleton } from '@/components/shared/loading-states';
import { Pagination } from '@/components/shared/pagination';
import { paymentsApi, feePlansApi, studentsApi, classesApi, notificationsApi } from '@/services/api';
import { feeApi, type PendingFeeStudent } from '@/services/fee-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { PAYMENT_METHODS } from '@/constants';
import { formatCurrency, formatDate, toCSV, downloadFile } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/context/auth-context';
import { canWrite } from '@/lib/permissions';
import type { Payment, FeePlan } from '@/types';

const PAYMENT_METHODS_EXT = [...PAYMENT_METHODS, { value: 'wallet', label: 'Wallet' }];

const collectSchema = z.object({
  studentId: z.string().min(1, 'Select student'),
  amount: z.coerce.number().min(1, 'Amount required'),
  paymentType: z.enum(['full', 'partial', 'installment']),
  paymentMethod: z.enum(['cash', 'card', 'upi', 'cheque', 'bank_transfer', 'wallet']),
  remarks: z.string().optional(),
  transactionId: z.string().optional(),
  lateFee: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).default(0),
  scholarship: z.coerce.number().min(0).default(0),
});
type CollectData = z.infer<typeof collectSchema>;

const editSchema = z.object({
  amount: z.coerce.number().min(0),
  paymentMethod: z.enum(['cash', 'card', 'upi', 'cheque', 'bank_transfer', 'wallet']),
  paymentType: z.enum(['full', 'partial', 'installment']),
  status: z.enum(['completed', 'pending', 'failed', 'refunded']),
  remarks: z.string().optional(),
});
type EditData = z.infer<typeof editSchema>;

const planSchema = z.object({
  name: z.string().min(2, 'Required'),
  code: z.string().min(2, 'Required'),
  totalAmount: z.coerce.number().min(0),
  installments: z.coerce.number().min(1).default(1),
  classId: z.string().optional(),
  description: z.string().optional(),
  applicableCategory: z.string().default('all'),
  effectiveDate: z.string().optional(),
  expiryDate: z.string().optional(),
});
type PlanData = z.infer<typeof planSchema>;

interface ReceiptInfo {
  number: string; amount: number; student: string; admissionNumber: string;
  className: string; paymentMethod: string; paymentDate: string;
  previousBalance: number; currentBalance: number; collectedBy: string;
}

export function FeesPage() {
  const { profile } = useAuth();
  const canEdit = canWrite(profile?.role, 'fees');
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [collectOpen, setCollectOpen] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptInfo | null>(null);
  const [editPayment, setEditPayment] = useState<Payment | null>(null);
  const [editFeePlan, setEditFeePlan] = useState<FeePlan | null>(null);
  const [feePlanOpen, setFeePlanOpen] = useState(false);
  const [pendingSearch, setPendingSearch] = useState('');
  const [reportFilters, setReportFilters] = useState({ dateFrom: '', dateTo: '', paymentMethod: 'all', status: 'all' });

  const { data, isLoading } = useQuery({ queryKey: ['payments', page, search], queryFn: () => paymentsApi.list({ page, search }) });
  const { data: feeStats } = useQuery({ queryKey: ['fee-dashboard-stats'], queryFn: feeApi.dashboardStats });
  const { data: pendingFees } = useQuery({ queryKey: ['pending-fees'], queryFn: feeApi.pendingFees });
  const { data: feePlans } = useQuery({ queryKey: ['fee-plans'], queryFn: feePlansApi.list });
  const { data: students } = useQuery({ queryKey: ['students-all'], queryFn: () => studentsApi.list({ pageSize: 200 }) });
  const { data: classes } = useQuery({ queryKey: ['classes'], queryFn: classesApi.list });

  const { data: reportData } = useQuery({ queryKey: ['fee-report', reportFilters], queryFn: () => feeApi.reportData(reportFilters) });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<CollectData>({
    resolver: zodResolver(collectSchema),
    defaultValues: { paymentType: 'full', paymentMethod: 'cash', lateFee: 0, discount: 0, scholarship: 0 },
  });
  const editForm = useForm<EditData>({ resolver: zodResolver(editSchema) });
  const planForm = useForm<PlanData>({ resolver: zodResolver(planSchema) });

  const collectMut = useMutation({
    mutationFn: async (d: CollectData) => {
      const s = students?.data.find((st) => st.id === d.studentId);
      const fp = feePlans?.find((f) => f.id === s?.fee_plan_id);
      const totalPaid = (data?.data || []).filter((p) => p.student_id === d.studentId && p.status === 'completed').reduce((sum, p) => sum + Number(p.amount), 0);
      const netPayable = (fp?.total_amount || 0) - (s?.discount_amount || 0);
      const prevBal = Math.max(0, netPayable - totalPaid);
      const currBal = Math.max(0, prevBal - d.amount);
      const payment = await feeApi.collectFee({
        student_id: d.studentId, amount: d.amount, payment_method: d.paymentMethod, payment_type: d.paymentType,
        remarks: d.remarks, collected_by: profile?.id, transaction_id: d.transactionId,
        late_fee: d.lateFee, discount_applied: d.discount, scholarship_applied: d.scholarship,
        previous_balance: prevBal, current_balance: currBal,
      });
      return { payment, student: s, d, prevBal, currBal };
    },
    onSuccess: ({ payment, student, d, prevBal, currBal }) => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['fee-dashboard-stats'] });
      qc.invalidateQueries({ queryKey: ['pending-fees'] });
      qc.invalidateQueries({ queryKey: ['total-collection'] });
      const cls = classes?.find((c) => c.id === student?.class_id);
      setReceipt({
        number: payment.receipt_number, amount: Number(d.amount),
        student: `${student?.first_name} ${student?.last_name}`,
        admissionNumber: student?.admission_number || 'N/A',
        className: cls?.name || 'N/A', paymentMethod: d.paymentMethod,
        paymentDate: payment.payment_date, previousBalance: prevBal, currentBalance: currBal,
        collectedBy: profile?.full_name || 'Staff',
      });
      notificationsApi.create({ user_id: null, title: 'Fee Payment Collected', message: `${formatCurrency(d.amount)} collected from ${student?.first_name} ${student?.last_name}`, type: 'payment' }).catch(() => {});
      toast.success('Payment collected successfully');
      reset();
      setCollectOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Payment> }) => paymentsApi.update(id, patch),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); qc.invalidateQueries({ queryKey: ['fee-dashboard-stats'] }); toast.success('Payment updated'); setEditPayment(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const refundMut = useMutation({
    mutationFn: (id: string) => paymentsApi.update(id, { status: 'refunded' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); qc.invalidateQueries({ queryKey: ['fee-dashboard-stats'] }); toast.success('Payment refunded'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: paymentsApi.remove,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); qc.invalidateQueries({ queryKey: ['fee-dashboard-stats'] }); toast.success('Payment deleted'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const savePlanMut = useMutation({
    mutationFn: async (d: PlanData) => {
      const payload: any = {
        name: d.name, code: d.code, total_amount: d.totalAmount, installments: d.installments,
        class_id: d.classId || null, description: d.description || null,
        applicable_category: d.applicableCategory, effective_date: d.effectiveDate || null,
        expiry_date: d.expiryDate || null, components: [{ name: 'Tuition', amount: d.totalAmount }],
      };
      if (editFeePlan) return feePlansApi.update(editFeePlan.id, payload);
      return feePlansApi.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-plans'] }); toast.success(editFeePlan ? 'Fee plan updated' : 'Fee plan created'); setFeePlanOpen(false); setEditFeePlan(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportCSV = () => {
    if (!data) return;
    downloadFile(toCSV(data.data.map((p) => ({ Receipt: p.receipt_number, Date: formatDate(p.payment_date), Amount: p.amount, Type: p.payment_type, Method: p.payment_method, Status: p.status }))), 'payments.csv');
    toast.success('Exported');
  };

  const exportReport = () => {
    if (!reportData?.length) { toast.error('No data to export'); return; }
    downloadFile(toCSV(reportData.map((r) => ({ Date: formatDate(r.date), Receipt: r.receipt_number, Student: r.student_name, Admission: r.admission_number, Class: r.class_name || '', Amount: r.amount, Method: r.payment_method, Status: r.status }))), 'fee-report.csv');
    toast.success('Report exported');
  };

  const printReceipt = (r: ReceiptInfo) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Receipt ${r.number}</title>
      <style>
        body{font-family:'Segoe UI',sans-serif;padding:40px;max-width:600px;margin:0 auto}
        .header{text-align:center;border-bottom:3px solid #0284c7;padding-bottom:20px;margin-bottom:30px}
        .logo{font-size:28px;font-weight:bold;color:#0284c7}
        .title{font-size:20px;margin:10px 0;color:#333}
        .box{border:2px solid #e0e0e0;border-radius:12px;padding:24px;margin:20px 0}
        .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0}
        .row:last-child{border:none}
        .label{color:#666;font-size:14px}.value{font-weight:600;font-size:14px}
        .amount{font-size:24px;font-weight:bold;color:#16a34a;text-align:center;padding:16px;background:#f0fdf4;border-radius:8px;margin:16px 0}
        .footer{text-align:center;margin-top:30px;color:#999;font-size:12px}
        .qr{text-align:center;margin:20px 0}
      </style></head><body>
      <div class="header"><div class="logo">Scholar ERP</div><div class="title">Fee Payment Receipt</div></div>
      <div class="box">
        <div class="row"><span class="label">Receipt No</span><span class="value">${r.number}</span></div>
        <div class="row"><span class="label">Date</span><span class="value">${formatDate(r.paymentDate)}</span></div>
        <div class="row"><span class="label">Student</span><span class="value">${r.student}</span></div>
        <div class="row"><span class="label">Admission No</span><span class="value">${r.admissionNumber}</span></div>
        <div class="row"><span class="label">Class</span><span class="value">${r.className}</span></div>
        <div class="row"><span class="label">Collected By</span><span class="value">${r.collectedBy}</span></div>
        <div class="row"><span class="label">Payment Mode</span><span class="value">${r.paymentMethod.toUpperCase()}</span></div>
        <div class="row"><span class="label">Previous Balance</span><span class="value">${formatCurrency(r.previousBalance)}</span></div>
        <div class="row"><span class="label">Current Balance</span><span class="value">${formatCurrency(r.currentBalance)}</span></div>
      </div>
      <div class="amount">Amount Paid: ${formatCurrency(r.amount)}</div>
      <div class="qr"><img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(r.number)}" alt="QR" width="120" height="120" /></div>
      <div class="footer">This is a computer-generated receipt · Thank you for your payment</div>
      <script>window.print()</script></body></html>`);
    w.document.close();
  };

  const openEditPayment = (p: Payment) => {
    setEditPayment(p);
    editForm.reset({ amount: Number(p.amount), paymentMethod: p.payment_method as 'cash' | 'card' | 'upi' | 'cheque' | 'bank_transfer' | 'wallet', paymentType: p.payment_type as 'full' | 'partial' | 'installment', status: p.status as 'completed' | 'pending' | 'failed' | 'refunded', remarks: p.remarks || '' });
  };

  const openEditFeePlan = (fp?: FeePlan) => {
    if (fp) {
      setEditFeePlan(fp);
      planForm.reset({ name: fp.name, code: fp.code, totalAmount: Number(fp.total_amount), installments: fp.installments, classId: fp.class_id || '', description: fp.description || '', applicableCategory: fp.applicable_category || 'all', effectiveDate: fp.effective_date || '', expiryDate: fp.expiry_date || '' });
    } else {
      setEditFeePlan(null);
      planForm.reset({ name: '', code: '', totalAmount: 0, installments: 1, classId: '', description: '', applicableCategory: 'all', effectiveDate: '', expiryDate: '' });
    }
    setFeePlanOpen(true);
  };

  const filteredPending = (pendingFees || []).filter((s) => !pendingSearch || `${s.first_name} ${s.last_name}`.toLowerCase().includes(pendingSearch.toLowerCase()) || s.admission_number?.toLowerCase().includes(pendingSearch.toLowerCase()));

  return (
    <div>
      <PageHeader title="Fee Management" description="Collect fees, manage plans, track payments, and generate reports"
        actions={<>
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="mr-2 h-4 w-4" />Export</Button>
          {canEdit && <Button size="sm" onClick={() => setCollectOpen(true)}><Plus className="mr-2 h-4 w-4" />Collect Fee</Button>}
        </>}
      />

      {/* Dashboard Cards */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Today's Collection" value={formatCurrency(feeStats?.todayCollection ?? 0)} icon={IndianRupee} color="success" delay={0} />
        <StatCard title="This Month" value={formatCurrency(feeStats?.monthCollection ?? 0)} icon={TrendingUp} color="primary" delay={0.05} />
        <StatCard title="Pending Fees" value={formatCurrency(feeStats?.pendingFees ?? 0)} icon={AlertCircle} color="destructive" delay={0.1} />
        <StatCard title="Partially Paid" value={feeStats?.partiallyPaidCount ?? 0} icon={Users} color="warning" delay={0.15} />
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Total Collection" value={formatCurrency(feeStats?.totalCollection ?? 0)} icon={DollarSign} color="success" delay={0.2} />
        <StatCard title="Expected Collection" value={formatCurrency(feeStats?.expectedCollection ?? 0)} icon={BarChart3} color="primary" delay={0.25} />
        <Card>
          <CardContent className="p-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Collection Rate</span>
              <span className="text-2xl font-bold text-primary">{feeStats?.collectionRate ?? 0}%</span>
            </div>
            <Progress value={feeStats?.collectionRate ?? 0} className="h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setCollectOpen(true)} disabled={!canEdit}><Wallet className="mr-2 h-4 w-4" />Collect Fee</Button>
        <Button variant="outline" size="sm" onClick={() => setActiveTab('plans')}><FileText className="mr-2 h-4 w-4" />Fee Plans</Button>
        <Button variant="outline" size="sm" onClick={() => setActiveTab('pending')}><AlertCircle className="mr-2 h-4 w-4" />Pending Fees</Button>
        <Button variant="outline" size="sm" onClick={() => setActiveTab('reports')}><BarChart3 className="mr-2 h-4 w-4" />Reports</Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pending">Pending Fees</TabsTrigger>
          <TabsTrigger value="plans">Fee Plans</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview">
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search by receipt number..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0">
              {isLoading ? <div className="p-6"><TableSkeleton /></div> : !data?.data.length ? (
                <EmptyState icon={Wallet} title="No payments yet" description="Collect your first fee payment" action={canEdit ? <Button size="sm" onClick={() => setCollectOpen(true)}><Plus className="mr-2 h-4 w-4" />Collect Fee</Button> : undefined} />
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Receipt No</TableHead><TableHead>Student</TableHead><TableHead>Date</TableHead>
                        <TableHead>Method</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        {canEdit && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.data.map((p) => {
                        const s = students?.data.find((st) => st.id === p.student_id);
                        return (
                          <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-border hover:bg-muted/50">
                            <TableCell className="font-mono text-xs">{p.receipt_number}</TableCell>
                            <TableCell className="text-sm font-medium">{s ? `${s.first_name} ${s.last_name}` : p.student_id.slice(0, 8)}</TableCell>
                            <TableCell className="text-sm">{formatDate(p.payment_date)}</TableCell>
                            <TableCell className="capitalize text-sm">{p.payment_method}</TableCell>
                            <TableCell><Badge variant="secondary" className="text-[10px]">{p.payment_type}</Badge></TableCell>
                            <TableCell><Badge className={p.status === 'completed' ? 'bg-success text-white' : p.status === 'refunded' ? 'bg-destructive text-white' : 'bg-warning text-white'}>{p.status}</Badge></TableCell>
                            <TableCell className="text-right font-semibold text-success">{formatCurrency(p.amount)}</TableCell>
                            {canEdit && (
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Print Receipt" onClick={() => printReceipt({ number: p.receipt_number, amount: Number(p.amount), student: s ? `${s.first_name} ${s.last_name}` : '', admissionNumber: s?.admission_number || '', className: classes?.find((c) => c.id === s?.class_id)?.name || '', paymentMethod: p.payment_method, paymentDate: p.payment_date, previousBalance: p.previous_balance || 0, currentBalance: p.current_balance || 0, collectedBy: profile?.full_name || 'Staff' })}><Printer className="h-4 w-4" /></Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => openEditPayment(p)}><Pencil className="h-4 w-4" /></Button>
                                  {p.status !== 'refunded' && <Button variant="ghost" size="icon" className="h-8 w-8" title="Refund" onClick={() => refundMut.mutate(p.id)}><RotateCcw className="h-4 w-4 text-warning" /></Button>}
                                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Delete" onClick={() => deleteMut.mutate(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                </div>
                              </TableCell>
                            )}
                          </motion.tr>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <Pagination page={page} pageSize={10} total={data.total} onPageChange={setPage} />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PENDING FEES */}
        <TabsContent value="pending">
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative max-w-sm flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Search students..." className="pl-9" value={pendingSearch} onChange={(e) => setPendingSearch(e.target.value)} />
                </div>
                <Badge variant="outline" className="w-fit">{filteredPending.length} students with pending fees</Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0">
              {!filteredPending.length ? <EmptyState icon={CheckCircle2} title="No pending fees" description="All fees are paid" /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead><TableHead>Class</TableHead><TableHead>Guardian</TableHead><TableHead>Phone</TableHead>
                      <TableHead className="text-right">Total</TableHead><TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Pending</TableHead>
                      {canEdit && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPending.map((s: PendingFeeStudent) => (
                      <TableRow key={s.student_id}>
                        <TableCell><div><p className="text-sm font-medium">{s.first_name} {s.last_name}</p><p className="text-xs text-muted-foreground">{s.admission_number}</p></div></TableCell>
                        <TableCell className="text-sm">{s.class_name || '-'}</TableCell>
                        <TableCell className="text-sm">{s.guardian_name || '-'}</TableCell>
                        <TableCell className="text-sm">{s.guardian_phone || s.phone || '-'}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(s.total_fee)}</TableCell>
                        <TableCell className="text-right text-sm text-success">{formatCurrency(s.paid_amount)}</TableCell>
                        <TableCell className="text-right font-semibold text-destructive">{formatCurrency(s.pending_amount)}</TableCell>
                        {canEdit && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="Send Reminder" onClick={() => { toast.success(`Reminder sent to ${s.first_name}'s guardian`); notificationsApi.create({ user_id: null, title: 'Fee Reminder Sent', message: `Reminder sent to ${s.first_name} ${s.last_name}'s guardian`, type: 'reminder' }).catch(() => {}); }}><Send className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="Collect Fee" onClick={() => { setValue('studentId', s.student_id, { shouldValidate: true }); setCollectOpen(true); }}><Wallet className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* FEE PLANS */}
        <TabsContent value="plans">
          <div className="mb-4 flex justify-end">{canEdit && <Button size="sm" onClick={() => openEditFeePlan()}><Plus className="mr-2 h-4 w-4" />Add Fee Plan</Button>}</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(feePlans || []).map((fp) => (
              <Card key={fp.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>{fp.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{fp.code}</Badge>
                      {canEdit && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditFeePlan(fp)}><Pencil className="h-3.5 w-3.5" /></Button>}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(fp.total_amount)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{fp.installments} installments · {classes?.find((c) => c.id === fp.class_id)?.name || 'All classes'}</p>
                  {fp.applicable_category && fp.applicable_category !== 'all' && <Badge variant="secondary" className="mt-2 text-[10px]">{fp.applicable_category === 'new_admission' ? 'New Admission' : 'Existing Student'}</Badge>}
                  <div className="mt-3 space-y-1">{fp.components.map((c, i) => <div key={i} className="flex justify-between text-xs"><span className="text-muted-foreground">{c.name}</span><span>{formatCurrency(c.amount)}</span></div>)}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* REPORTS */}
        <TabsContent value="reports">
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div><Label className="text-xs">From Date</Label><Input type="date" value={reportFilters.dateFrom} onChange={(e) => setReportFilters({ ...reportFilters, dateFrom: e.target.value })} /></div>
                <div><Label className="text-xs">To Date</Label><Input type="date" value={reportFilters.dateTo} onChange={(e) => setReportFilters({ ...reportFilters, dateTo: e.target.value })} /></div>
                <div><Label className="text-xs">Payment Mode</Label>
                  <Select value={reportFilters.paymentMethod} onValueChange={(v) => setReportFilters({ ...reportFilters, paymentMethod: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Methods</SelectItem>{PAYMENT_METHODS_EXT.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select>
                </div>
                <div><Label className="text-xs">Status</Label>
                  <Select value={reportFilters.status} onValueChange={(v) => setReportFilters({ ...reportFilters, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="refunded">Refunded</SelectItem></SelectContent></Select>
                </div>
              </div>
              <div className="mt-3 flex justify-end"><Button variant="outline" size="sm" onClick={exportReport}><Download className="mr-2 h-4 w-4" />Export CSV</Button></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0">
              {!reportData?.length ? <EmptyState icon={BarChart3} title="No data" description="Adjust filters and generate report" /> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Receipt</TableHead><TableHead>Student</TableHead><TableHead>Class</TableHead><TableHead>Method</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {reportData.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{formatDate(r.date)}</TableCell>
                        <TableCell className="font-mono text-xs">{r.receipt_number}</TableCell>
                        <TableCell><div><p className="text-sm font-medium">{r.student_name}</p><p className="text-xs text-muted-foreground">{r.admission_number}</p></div></TableCell>
                        <TableCell className="text-sm">{r.class_name || '-'}</TableCell>
                        <TableCell className="capitalize text-sm">{r.payment_method}</TableCell>
                        <TableCell><Badge className={r.status === 'completed' ? 'bg-success text-white' : 'bg-warning text-white'}>{r.status}</Badge></TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(r.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Collect Fee Dialog */}
      <Dialog open={collectOpen} onOpenChange={setCollectOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" />Collect Fee</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => collectMut.mutate(d))} className="space-y-4">
            <div>
              <Label>Student</Label>
              <Select value={watch('studentId')} onValueChange={(v) => setValue('studentId', v, { shouldValidate: true })}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>{(students?.data || []).map((s) => <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.admission_number})</SelectItem>)}</SelectContent>
              </Select>
              {errors.studentId && <p className="text-xs text-destructive">{errors.studentId.message}</p>}
            </div>
            {watch('studentId') && (() => {
              const s = students?.data.find((st) => st.id === watch('studentId'));
              const fp = feePlans?.find((f) => f.id === s?.fee_plan_id);
              const totalPaid = (data?.data || []).filter((p) => p.student_id === s?.id && p.status === 'completed').reduce((sum, p) => sum + Number(p.amount), 0);
              const netPayable = (fp?.total_amount || 0) - (s?.discount_amount || 0);
              const pend = Math.max(0, netPayable - totalPaid);
              return (
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-warning"><AlertCircle className="h-4 w-4" />Pending Amount: {formatCurrency(pend)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Total: {formatCurrency(netPayable)} · Paid: {formatCurrency(totalPaid)}</div>
                </div>
              );
            })()}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Amount</Label><Input type="number" className="mt-1.5" {...register('amount')} />{errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}</div>
              <div><Label>Payment Type</Label>
                <Select value={watch('paymentType')} onValueChange={(v) => setValue('paymentType', v as 'full' | 'partial' | 'installment')}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="full">Full</SelectItem><SelectItem value="partial">Partial</SelectItem><SelectItem value="installment">Installment</SelectItem></SelectContent></Select>
              </div>
            </div>
            <div><Label>Payment Method</Label>
              <Select value={watch('paymentMethod')} onValueChange={(v) => setValue('paymentMethod', v as 'cash' | 'card' | 'upi' | 'cheque' | 'bank_transfer' | 'wallet')}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_METHODS_EXT.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">Late Fee</Label><Input type="number" className="mt-1" {...register('lateFee')} /></div>
              <div><Label className="text-xs">Discount</Label><Input type="number" className="mt-1" {...register('discount')} /></div>
              <div><Label className="text-xs">Scholarship</Label><Input type="number" className="mt-1" {...register('scholarship')} /></div>
            </div>
            <div><Label>Transaction ID</Label><Input className="mt-1.5" {...register('transactionId')} placeholder="Bank/UPI reference (optional)" /></div>
            <div><Label>Remarks</Label><Input className="mt-1.5" {...register('remarks')} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCollectOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={collectMut.isPending}><Wallet className="mr-2 h-4 w-4" />{collectMut.isPending ? 'Collecting...' : 'Collect Payment'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Payment Dialog */}
      <Dialog open={!!editPayment} onOpenChange={(o) => !o && setEditPayment(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Payment</DialogTitle></DialogHeader>
          <form onSubmit={editForm.handleSubmit((d) => updateMut.mutate({ id: editPayment!.id, patch: { amount: d.amount, payment_method: d.paymentMethod, payment_type: d.paymentType, status: d.status, remarks: d.remarks } }))} className="space-y-4">
            <div><Label>Amount</Label><Input type="number" className="mt-1.5" {...editForm.register('amount')} /></div>
            <div><Label>Payment Method</Label>
              <Select value={editForm.watch('paymentMethod')} onValueChange={(v) => editForm.setValue('paymentMethod', v as 'cash' | 'card' | 'upi' | 'cheque' | 'bank_transfer' | 'wallet')}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_METHODS_EXT.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select>
            </div>
            <div><Label>Payment Type</Label>
              <Select value={editForm.watch('paymentType')} onValueChange={(v) => editForm.setValue('paymentType', v as 'full' | 'partial' | 'installment')}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="full">Full</SelectItem><SelectItem value="partial">Partial</SelectItem><SelectItem value="installment">Installment</SelectItem></SelectContent></Select>
            </div>
            <div><Label>Status</Label>
              <Select value={editForm.watch('status')} onValueChange={(v) => editForm.setValue('status', v as 'completed' | 'pending' | 'failed' | 'refunded')}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="completed">Completed</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="failed">Failed</SelectItem><SelectItem value="refunded">Refunded</SelectItem></SelectContent></Select>
            </div>
            <div><Label>Remarks</Label><Textarea className="mt-1.5" {...editForm.register('remarks')} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setEditPayment(null)}>Cancel</Button><Button type="submit" disabled={updateMut.isPending}>{updateMut.isPending ? 'Updating...' : 'Update'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Fee Plan Dialog */}
      <Dialog open={feePlanOpen} onOpenChange={setFeePlanOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editFeePlan ? 'Edit Fee Plan' : 'Add Fee Plan'}</DialogTitle></DialogHeader>
          <form onSubmit={planForm.handleSubmit((d) => savePlanMut.mutate(d))} className="space-y-4">
            <div><Label>Name</Label><Input className="mt-1.5" {...planForm.register('name')} /></div>
            <div><Label>Code</Label><Input className="mt-1.5" {...planForm.register('code')} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Total Amount</Label><Input type="number" className="mt-1.5" {...planForm.register('totalAmount')} /></div>
              <div><Label>Installments</Label><Input type="number" className="mt-1.5" {...planForm.register('installments')} /></div>
            </div>
            <div><Label>Class (optional)</Label>
              <Select value={planForm.watch('classId') || 'all'} onValueChange={(v) => planForm.setValue('classId', v === 'all' ? '' : v)}><SelectTrigger className="mt-1.5"><SelectValue placeholder="All classes" /></SelectTrigger><SelectContent><SelectItem value="all">All classes</SelectItem>{(classes || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div><Label>Applicable Category</Label>
              <Select value={planForm.watch('applicableCategory')} onValueChange={(v) => planForm.setValue('applicableCategory', v)}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Students</SelectItem><SelectItem value="new_admission">New Admission</SelectItem><SelectItem value="existing">Existing Student</SelectItem></SelectContent></Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Effective Date</Label><Input type="date" className="mt-1.5" {...planForm.register('effectiveDate')} /></div>
              <div><Label>Expiry Date</Label><Input type="date" className="mt-1.5" {...planForm.register('expiryDate')} /></div>
            </div>
            <div><Label>Description</Label><Textarea className="mt-1.5" {...planForm.register('description')} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setFeePlanOpen(false)}>Cancel</Button><Button type="submit" disabled={savePlanMut.isPending}><Save className="mr-2 h-4 w-4" />{savePlanMut.isPending ? 'Saving...' : 'Save'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent className="max-w-md">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-success/15"><Receipt className="h-8 w-8 text-success" /></div>
            <DialogTitle>Payment Successful</DialogTitle>
            <p className="text-sm text-muted-foreground">Fee has been collected successfully</p>
          </div>
          {receipt && (
            <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Receipt No</span><span className="font-mono font-semibold">{receipt.number}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Student</span><span className="font-medium">{receipt.student}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Admission No</span><span>{receipt.admissionNumber}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Class</span><span>{receipt.className}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Date</span><span>{formatDate(receipt.paymentDate)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Collected By</span><span>{receipt.collectedBy}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Method</span><span className="capitalize">{receipt.paymentMethod}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Previous Balance</span><span>{formatCurrency(receipt.previousBalance)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Current Balance</span><span>{formatCurrency(receipt.currentBalance)}</span></div>
                <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm"><span className="font-semibold">Amount Paid</span><span className="font-bold text-success">{formatCurrency(receipt.amount)}</span></div>
              </div>
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => receipt && printReceipt(receipt)}><Printer className="mr-2 h-4 w-4" />Print</Button>
            <Button variant="outline" className="flex-1" onClick={() => { navigator.clipboard.writeText(`Receipt: ${receipt?.number}\nAmount: ${formatCurrency(receipt?.amount || 0)}\nStudent: ${receipt?.student}`); toast.success('Receipt copied'); }}><Send className="mr-2 h-4 w-4" />Share</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
