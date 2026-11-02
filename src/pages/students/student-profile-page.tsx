import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Mail, Phone, MapPin, Calendar, User, Heart, Shield, BookOpen, Wallet,
  Pencil, Save, X, Receipt, Clock, CheckCircle2, AlertCircle, FileText,
} from 'lucide-react';
import { studentsApi, classesApi, sectionsApi, programsApi, feePlansApi, paymentsApi, sessionsApi, notificationsApi } from '@/services/api';
import { feeApi } from '@/services/fee-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { LoadingState } from '@/components/shared/loading-states';
import { formatDate, formatCurrency, initials } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { canWrite } from '@/lib/permissions';
import { GENDERS, BLOOD_GROUPS, STUDENT_TYPES, PAYMENT_METHODS } from '@/constants';
import { toast } from 'sonner';
import type { Student, FeeInstallment } from '@/types';

const PAYMENT_METHODS_EXT = [...PAYMENT_METHODS, { value: 'wallet', label: 'Wallet' }];

const NONE_VAL = '__none__';

export function StudentProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const canEdit = canWrite(profile?.role, 'students');
  const canEditFees = canWrite(profile?.role, 'fees');
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Student>>({});
  const [activeTab, setActiveTab] = useState('overview');
  const [collectOpen, setCollectOpen] = useState(false);
  const [collectAmount, setCollectAmount] = useState(0);
  const [collectMethod, setCollectMethod] = useState('cash');
  const [collectType, setCollectType] = useState('full');
  const [collectRemarks, setCollectRemarks] = useState('');
  const [collectTxnId, setCollectTxnId] = useState('');

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: () => studentsApi.get(id!),
    enabled: !!id,
  });
  const { data: classes } = useQuery({ queryKey: ['classes'], queryFn: classesApi.list });
  const { data: sections } = useQuery({ queryKey: ['sections'], queryFn: () => sectionsApi.list() });
  const { data: programs } = useQuery({ queryKey: ['programs'], queryFn: programsApi.list });
  const { data: feePlans } = useQuery({ queryKey: ['fee-plans'], queryFn: feePlansApi.list });
  const { data: sessions } = useQuery({ queryKey: ['sessions'], queryFn: sessionsApi.list });
  const { data: payments } = useQuery({
    queryKey: ['student-payments', id],
    queryFn: () => paymentsApi.list({ studentId: id, pageSize: 100 }),
    enabled: !!id,
  });
  const { data: installments } = useQuery({
    queryKey: ['fee-installments', id],
    queryFn: () => feeApi.getInstallments(id!),
    enabled: !!id && canEditFees,
  });

  const collectMut = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('No student');
      const prevBal = pending;
      const currBal = Math.max(0, prevBal - collectAmount);
      return feeApi.collectFee({
        student_id: id, amount: collectAmount, payment_method: collectMethod, payment_type: collectType,
        remarks: collectRemarks, collected_by: profile?.id, transaction_id: collectTxnId,
        previous_balance: prevBal, current_balance: currBal,
      });
    },
    onSuccess: (payment) => {
      qc.invalidateQueries({ queryKey: ['student-payments', id] });
      qc.invalidateQueries({ queryKey: ['fee-installments', id] });
      qc.invalidateQueries({ queryKey: ['fee-dashboard-stats'] });
      qc.invalidateQueries({ queryKey: ['pending-fees'] });
      notificationsApi.create({ user_id: null, title: 'Fee Payment Collected', message: `${formatCurrency(collectAmount)} collected from ${student?.first_name} ${student?.last_name}`, type: 'payment' }).catch(() => {});
      toast.success('Payment collected successfully');
      setCollectOpen(false);
      setCollectAmount(0); setCollectRemarks(''); setCollectTxnId('');
      printStudentReceipt(payment.receipt_number, Number(payment.amount), payment.payment_date, payment.previous_balance || 0, payment.current_balance || 0, payment.payment_method);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const printStudentReceipt = (rcptNum: string, amt: number, date: string, prevBal: number, currBal: number, method: string) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Receipt ${rcptNum}</title><style>
      body{font-family:'Segoe UI',sans-serif;padding:40px;max-width:600px;margin:0 auto}
      .header{text-align:center;border-bottom:3px solid #0284c7;padding-bottom:20px;margin-bottom:30px}
      .logo{font-size:28px;font-weight:bold;color:#0284c7}
      .title{font-size:20px;margin:10px 0;color:#333}
      .box{border:2px solid #e0e0e0;border-radius:12px;padding:24px;margin:20px 0}
      .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0}.row:last-child{border:none}
      .label{color:#666;font-size:14px}.value{font-weight:600;font-size:14px}
      .amount{font-size:24px;font-weight:bold;color:#16a34a;text-align:center;padding:16px;background:#f0fdf4;border-radius:8px;margin:16px 0}
      .footer{text-align:center;margin-top:30px;color:#999;font-size:12px}
      .qr{text-align:center;margin:20px 0}
    </style></head><body>
      <div class="header"><div class="logo">Scholar ERP</div><div class="title">Fee Payment Receipt</div></div>
      <div class="box">
        <div class="row"><span class="label">Receipt No</span><span class="value">${rcptNum}</span></div>
        <div class="row"><span class="label">Date</span><span class="value">${formatDate(date)}</span></div>
        <div class="row"><span class="label">Student</span><span class="value">${student?.first_name} ${student?.last_name}</span></div>
        <div class="row"><span class="label">Admission No</span><span class="value">${student?.admission_number || 'N/A'}</span></div>
        <div class="row"><span class="label">Class</span><span class="value">${className || 'N/A'}</span></div>
        <div class="row"><span class="label">Collected By</span><span class="value">${profile?.full_name || 'Staff'}</span></div>
        <div class="row"><span class="label">Payment Mode</span><span class="value">${method.toUpperCase()}</span></div>
        <div class="row"><span class="label">Previous Balance</span><span class="value">${formatCurrency(prevBal)}</span></div>
        <div class="row"><span class="label">Current Balance</span><span class="value">${formatCurrency(currBal)}</span></div>
      </div>
      <div class="amount">Amount Paid: ${formatCurrency(amt)}</div>
      <div class="qr"><img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(rcptNum)}" alt="QR" width="120" height="120" /></div>
      <div class="footer">This is a computer-generated receipt · Thank you for your payment</div>
      <script>window.print()</script></body></html>`);
    w.document.close();
  };

  const updateMut = useMutation({
    mutationFn: (patch: Partial<Student>) => studentsApi.update(id!, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student', id] });
      toast.success('Student updated');
      setEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !student) return <LoadingState />;

  const className = classes?.find((c) => c.id === student.class_id)?.name;
  const sectionName = sections?.find((s) => s.id === student.section_id)?.name;
  const programName = programs?.find((p) => p.id === student.program_id)?.name;
  const feePlan = feePlans?.find((f) => f.id === student.fee_plan_id);
  const totalPaid = (payments?.data || []).reduce((sum, p) => sum + (p.status === 'completed' ? Number(p.amount) : 0), 0);
  const netPayable = (feePlan?.total_amount || 0) - (student.discount_amount || 0);
  const pending = Math.max(0, netPayable - totalPaid);

  const startEdit = () => { setForm({ ...student }); setEditing(true); };
  const cancelEdit = () => { setEditing(false); setForm({}); };
  const save = () => updateMut.mutate(form);
  const set = (key: keyof Student, value: string | number | null) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/students')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Students
        </Button>
        {canEdit && !editing && (
          <Button size="sm" onClick={startEdit}><Pencil className="mr-2 h-4 w-4" />Edit Student</Button>
        )}
        {editing && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={cancelEdit}><X className="mr-2 h-4 w-4" />Cancel</Button>
            <Button size="sm" onClick={save} disabled={updateMut.isPending}><Save className="mr-2 h-4 w-4" />{updateMut.isPending ? 'Saving...' : 'Save'}</Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: profile card */}
        <div className="lg:col-span-1">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardContent className="flex flex-col items-center p-6 text-center">
                <Avatar className="h-24 w-24 border-4 border-primary/10">
                  {student.photo_url && <AvatarImage src={student.photo_url} alt={student.first_name} />}
                  <AvatarFallback className="bg-primary/10 text-2xl font-bold text-primary">
                    {initials(`${student.first_name} ${student.last_name}`)}
                  </AvatarFallback>
                </Avatar>
                <h2 className="mt-4 text-lg font-bold">{student.first_name} {student.last_name}</h2>
                <p className="text-sm text-muted-foreground">{student.admission_number}</p>
                <Badge className="mt-2" variant={student.status === 'active' ? 'default' : 'secondary'}>{student.status}</Badge>

                <div className="mt-6 w-full space-y-2 text-left">
                  <InfoRow icon={Mail} label="Email" value={student.email} />
                  <InfoRow icon={Phone} label="Phone" value={student.phone} />
                  <InfoRow icon={Calendar} label="DOB" value={formatDate(student.date_of_birth)} />
                  <InfoRow icon={Heart} label="Blood" value={student.blood_group} />
                  <InfoRow icon={Calendar} label="Admitted" value={formatDate(student.admission_date)} />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Right: details or edit form */}
        <div className="space-y-6 lg:col-span-2">
          {editing ? (
            <EditForm form={form} set={set} classes={classes} sections={sections} programs={programs} feePlans={feePlans} sessions={sessions} />
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="fee">Fee</TabsTrigger>
              </TabsList>

              {/* OVERVIEW TAB */}
              <TabsContent value="overview" className="space-y-6">
                {/* Personal & Parents */}
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2 text-base"><User className="h-4 w-4" /> Personal & Parents</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <InfoRow icon={User} label="Father's Name" value={student.father_name} />
                      <InfoRow icon={User} label="Mother's Name" value={student.mother_name} />
                      <InfoRow icon={User} label="Guardian Name" value={student.guardian_name} />
                      <InfoRow icon={User} label="Relation" value={student.guardian_relation} />
                      <InfoRow icon={Phone} label="Guardian Phone" value={student.guardian_phone} />
                      <InfoRow icon={Mail} label="Guardian Email" value={student.guardian_email} />
                      <InfoRow icon={Shield} label="Occupation" value={student.guardian_occupation} />
                    </div>
                  </CardContent>
                </Card>

                {/* Address */}
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4" /> Address</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <InfoRow icon={MapPin} label="Address" value={student.address_line} />
                      <InfoRow icon={MapPin} label="City" value={student.city} />
                      <InfoRow icon={MapPin} label="State" value={student.state} />
                      <InfoRow icon={MapPin} label="Pincode" value={student.pincode} />
                    </div>
                  </CardContent>
                </Card>

                {/* Academic */}
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4" /> Academic</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <InfoRow icon={BookOpen} label="Class" value={className} />
                      <InfoRow icon={BookOpen} label="Section" value={sectionName} />
                      <InfoRow icon={BookOpen} label="Program" value={programName} />
                      <InfoRow icon={BookOpen} label="Roll No" value={student.roll_number} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* FEE TAB */}
              <TabsContent value="fee" className="space-y-6">
                {/* Fee Summary Card */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4" /> Fee Summary</CardTitle>
                      {canEditFees && (
                        <Button size="sm" onClick={() => setCollectOpen(true)} className="bg-success hover:bg-success/90">
                          <Wallet className="mr-2 h-4 w-4" /> Collect Fee
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <FeeBox label="Total Fee" value={formatCurrency(feePlan?.total_amount || 0)} />
                      <FeeBox label="Paid" value={formatCurrency(totalPaid)} color="text-success" />
                      <FeeBox label="Pending" value={formatCurrency(pending)} color="text-destructive" />
                      <div className="rounded-lg border border-border p-3">
                        <p className="text-xs text-muted-foreground">Payment Status</p>
                        <Badge className={`mt-1 ${pending <= 0 ? 'bg-success text-white' : pending < netPayable ? 'bg-warning text-white' : 'bg-destructive text-white'}`}>
                          {pending <= 0 ? 'Fully Paid' : pending < netPayable ? 'Partially Paid' : 'Unpaid'}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Payment Progress</span><span>{feePlan ? Math.round((totalPaid / netPayable) * 100) : 0}%</span></div>
                      <Progress value={feePlan ? (totalPaid / Math.max(1, netPayable)) * 100 : 0} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

                {/* Fee Details */}
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Receipt className="h-4 w-4" /> Fee Details</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <InfoRow icon={FileText} label="Fee Plan" value={feePlan?.name || 'Not assigned'} />
                      <InfoRow icon={Calendar} label="Academic Session" value={sessions?.find((s) => s.id === student.session_id)?.name} />
                      <InfoRow icon={CheckCircle2} label="Status" value={pending <= 0 ? 'Fully Paid' : 'Pending'} />
                      <InfoRow icon={Clock} label="Last Payment Date" value={payments?.data?.[0] ? formatDate(payments.data[0].payment_date) : '-'} />
                      <InfoRow icon={Wallet} label="Last Payment Amount" value={payments?.data?.[0] ? formatCurrency(payments.data[0].amount) : '-'} />
                      <InfoRow icon={AlertCircle} label="Pending Amount" value={formatCurrency(pending)} />
                      <InfoRow icon={Shield} label="Scholarship / Discount" value={student.scholarship || formatCurrency(student.discount_amount)} />
                      <InfoRow icon={AlertCircle} label="Late Fee" value={formatCurrency(payments?.data?.[0]?.late_fee || 0)} />
                    </div>

                    {/* Installment Status */}
                    {(installments && installments.length > 0) && (
                      <div className="mt-4">
                        <p className="mb-2 text-xs font-semibold text-muted-foreground">Installment Status</p>
                        <div className="space-y-2">
                          {installments.map((inst: FeeInstallment) => (
                            <div key={inst.id} className="flex items-center justify-between rounded-lg border border-border p-2.5">
                              <div className="flex items-center gap-2">
                                <Badge variant={inst.status === 'paid' ? 'default' : inst.status === 'overdue' ? 'destructive' : 'secondary'} className="text-[10px]">{inst.status}</Badge>
                                <span className="text-sm font-medium">{inst.title}</span>
                                <span className="text-xs text-muted-foreground">Due: {formatDate(inst.due_date)}</span>
                              </div>
                              <span className="text-sm font-semibold">{formatCurrency(inst.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Payment History Timeline */}
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4" /> Payment History</CardTitle></CardHeader>
                  <CardContent>
                    {!payments?.data.length ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">No payments recorded yet.</p>
                    ) : (
                      <div className="relative space-y-4 before:absolute before:left-3 before:top-2 before:h-[calc(100%-1rem)] before:w-0.5 before:bg-border">
                        {payments.data.map((p) => (
                          <div key={p.id} className="relative flex gap-3 pl-8">
                            <div className={`absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full ${p.status === 'completed' ? 'bg-success/15' : 'bg-warning/15'}`}>
                              {p.status === 'completed' ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Clock className="h-3.5 w-3.5 text-warning" />}
                            </div>
                            <div className="flex-1 rounded-lg border border-border p-3">
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-xs font-semibold">{p.receipt_number}</span>
                                <Badge className={p.status === 'completed' ? 'bg-success text-white' : 'bg-warning text-white'}>{p.status}</Badge>
                              </div>
                              <div className="mt-1 grid grid-cols-2 gap-1 text-xs text-muted-foreground sm:grid-cols-4">
                                <span><Calendar className="mr-1 inline h-3 w-3" />{formatDate(p.payment_date)}</span>
                                <span className="capitalize"><Wallet className="mr-1 inline h-3 w-3" />{p.payment_method}</span>
                                {p.transaction_id && <span className="font-mono">Txn: {p.transaction_id}</span>}
                                {p.collected_by && <span>By: Staff</span>}
                              </div>
                              <div className="mt-2 flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Balance: {formatCurrency(p.current_balance || 0)}</span>
                                <span className="text-sm font-bold text-success">{formatCurrency(p.amount)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>

        {/* Collect Fee Dialog */}
        <Dialog open={collectOpen} onOpenChange={setCollectOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" />Collect Fee</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-warning"><AlertCircle className="h-4 w-4" />Pending Amount: {formatCurrency(pending)}</div>
              </div>
              <div><Label>Amount</Label><Input type="number" className="mt-1.5" value={collectAmount || ''} onChange={(e) => setCollectAmount(Number(e.target.value))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Payment Type</Label>
                  <Select value={collectType} onValueChange={setCollectType}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="full">Full</SelectItem><SelectItem value="partial">Partial</SelectItem><SelectItem value="installment">Installment</SelectItem></SelectContent></Select>
                </div>
                <div><Label>Payment Method</Label>
                  <Select value={collectMethod} onValueChange={setCollectMethod}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_METHODS_EXT.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select>
                </div>
              </div>
              <div><Label>Transaction ID</Label><Input className="mt-1.5" value={collectTxnId} onChange={(e) => setCollectTxnId(e.target.value)} placeholder="Bank/UPI reference (optional)" /></div>
              <div><Label>Remarks</Label><Input className="mt-1.5" value={collectRemarks} onChange={(e) => setCollectRemarks(e.target.value)} /></div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCollectOpen(false)}>Cancel</Button>
                <Button onClick={() => collectMut.mutate()} disabled={collectMut.isPending || collectAmount <= 0}><Wallet className="mr-2 h-4 w-4" />{collectMut.isPending ? 'Collecting...' : 'Collect Payment'}</Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function EditForm({ form, set, classes, sections, programs, feePlans, sessions }: {
  form: Partial<Student>;
  set: (key: keyof Student, value: string | number | null) => void;
  classes: Awaited<ReturnType<typeof classesApi.list>> | undefined;
  sections: Awaited<ReturnType<typeof sectionsApi.list>> | undefined;
  programs: Awaited<ReturnType<typeof programsApi.list>> | undefined;
  feePlans: Awaited<ReturnType<typeof feePlansApi.list>> | undefined;
  sessions: Awaited<ReturnType<typeof sessionsApi.list>> | undefined;
}) {
  const classSections = (sections || []).filter((s) => !form.class_id || s.class_id === form.class_id);
  return (
    <>
      <Card>
        <CardHeader><CardTitle className="text-base">Personal Information</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><Label>First Name</Label><Input className="mt-1.5" value={form.first_name || ''} onChange={(e) => set('first_name', e.target.value)} /></div>
          <div><Label>Last Name</Label><Input className="mt-1.5" value={form.last_name || ''} onChange={(e) => set('last_name', e.target.value)} /></div>
          <div><Label>Father's Name</Label><Input className="mt-1.5" value={form.father_name || ''} onChange={(e) => set('father_name', e.target.value)} /></div>
          <div><Label>Mother's Name</Label><Input className="mt-1.5" value={form.mother_name || ''} onChange={(e) => set('mother_name', e.target.value)} /></div>
          <div><Label>Email</Label><Input className="mt-1.5" value={form.email || ''} onChange={(e) => set('email', e.target.value)} /></div>
          <div><Label>Phone</Label><Input className="mt-1.5" value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} /></div>
          <div>
            <Label>Gender</Label>
            <Select value={form.gender || NONE_VAL} onValueChange={(v) => set('gender', v === NONE_VAL ? null : v)}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>{GENDERS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Date of Birth</Label><Input type="date" className="mt-1.5" value={form.date_of_birth || ''} onChange={(e) => set('date_of_birth', e.target.value)} /></div>
          <div>
            <Label>Blood Group</Label>
            <Select value={form.blood_group || NONE_VAL} onValueChange={(v) => set('blood_group', v === NONE_VAL ? null : v)}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={NONE_VAL}>None</SelectItem>{BLOOD_GROUPS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Student Type</Label>
            <Select value={form.student_type || 'new'} onValueChange={(v) => set('student_type', v)}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>{STUDENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Guardian</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><Label>Guardian Name</Label><Input className="mt-1.5" value={form.guardian_name || ''} onChange={(e) => set('guardian_name', e.target.value)} /></div>
          <div><Label>Relation</Label><Input className="mt-1.5" value={form.guardian_relation || ''} onChange={(e) => set('guardian_relation', e.target.value)} /></div>
          <div><Label>Guardian Phone</Label><Input className="mt-1.5" value={form.guardian_phone || ''} onChange={(e) => set('guardian_phone', e.target.value)} /></div>
          <div><Label>Guardian Email</Label><Input className="mt-1.5" value={form.guardian_email || ''} onChange={(e) => set('guardian_email', e.target.value)} /></div>
          <div><Label>Occupation</Label><Input className="mt-1.5" value={form.guardian_occupation || ''} onChange={(e) => set('guardian_occupation', e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Address</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Address Line</Label><Textarea className="mt-1.5" value={form.address_line || ''} onChange={(e) => set('address_line', e.target.value)} /></div>
          <div><Label>City</Label><Input className="mt-1.5" value={form.city || ''} onChange={(e) => set('city', e.target.value)} /></div>
          <div><Label>State</Label><Input className="mt-1.5" value={form.state || ''} onChange={(e) => set('state', e.target.value)} /></div>
          <div><Label>Country</Label><Input className="mt-1.5" value={form.country || ''} onChange={(e) => set('country', e.target.value)} /></div>
          <div><Label>Pincode</Label><Input className="mt-1.5" value={form.pincode || ''} onChange={(e) => set('pincode', e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Academic</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Class</Label>
            <Select value={form.class_id || NONE_VAL} onValueChange={(v) => { set('class_id', v === NONE_VAL ? null : v); set('section_id', null); }}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent><SelectItem value={NONE_VAL}>None</SelectItem>{(classes || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Section</Label>
            <Select value={form.section_id || NONE_VAL} onValueChange={(v) => set('section_id', v === NONE_VAL ? null : v)}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select section" /></SelectTrigger>
              <SelectContent><SelectItem value={NONE_VAL}>None</SelectItem>{classSections.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Program</Label>
            <Select value={form.program_id || NONE_VAL} onValueChange={(v) => set('program_id', v === NONE_VAL ? null : v)}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select program" /></SelectTrigger>
              <SelectContent><SelectItem value={NONE_VAL}>None</SelectItem>{(programs || []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Session</Label>
            <Select value={form.session_id || NONE_VAL} onValueChange={(v) => set('session_id', v === NONE_VAL ? null : v)}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select session" /></SelectTrigger>
              <SelectContent><SelectItem value={NONE_VAL}>None</SelectItem>{(sessions || []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Roll Number</Label><Input className="mt-1.5" value={form.roll_number || ''} onChange={(e) => set('roll_number', e.target.value)} /></div>
          <div>
            <Label>Fee Plan</Label>
            <Select value={form.fee_plan_id || NONE_VAL} onValueChange={(v) => set('fee_plan_id', v === NONE_VAL ? null : v)}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select fee plan" /></SelectTrigger>
              <SelectContent><SelectItem value={NONE_VAL}>None</SelectItem>{(feePlans || []).map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Discount Amount</Label><Input type="number" className="mt-1.5" value={form.discount_amount || 0} onChange={(e) => set('discount_amount', Number(e.target.value))} /></div>
          <div><Label>Scholarship</Label><Input className="mt-1.5" value={form.scholarship || ''} onChange={(e) => set('scholarship', e.target.value)} /></div>
          <div>
            <Label>Status</Label>
            <Select value={form.status || 'active'} onValueChange={(v) => set('status', v)}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="graduated">Graduated</SelectItem><SelectItem value="left">Left</SelectItem></SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Medical</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Medical Info</Label><Textarea className="mt-1.5" value={form.medical_info || ''} onChange={(e) => set('medical_info', e.target.value)} placeholder="Allergies, conditions..." /></div>
          <div><Label>Emergency Contact</Label><Input className="mt-1.5" value={form.emergency_contact || ''} onChange={(e) => set('emergency_contact', e.target.value)} /></div>
        </CardContent>
      </Card>
    </>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value?: string | null }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg p-2 hover:bg-muted/50">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value || '-'}</p>
      </div>
    </div>
  );
}

function FeeBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-bold ${color || ''}`}>{value}</p>
    </div>
  );
}
