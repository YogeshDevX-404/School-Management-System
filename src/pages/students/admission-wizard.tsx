import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm, FormProvider } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import {
  GraduationCap, User, Users, MapPin, BookOpen, Wallet, Percent,
  CheckCircle2, ChevronLeft, ChevronRight, PartyPopper, X,
} from 'lucide-react';
import { classesApi, sectionsApi, programsApi, feePlansApi, sessionsApi, studentsApi, paymentsApi, activitiesApi, notificationsApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency, generateAdmissionNumber, generateReceiptNumber } from '@/lib/utils';
import { STUDENT_TYPES, GENDERS, BLOOD_GROUPS, PAYMENT_METHODS } from '@/constants';
import { useAuth } from '@/context/auth-context';
import { toast } from 'sonner';

const NONE_VAL = '__none__';

const schema = z.object({
  studentType: z.enum(['new', 'transfer', 're_admission']),
  firstName: z.string().min(2, 'Required'),
  lastName: z.string().min(1, 'Required'),
  email: z.string().email('Valid email required'),
  phone: z.string().min(6, 'Required'),
  gender: z.enum(['male', 'female', 'other']),
  dateOfBirth: z.string().min(1, 'Required'),
  bloodGroup: z.string().optional(),
  guardianName: z.string().min(2, 'Required'),
  guardianRelation: z.string().min(2, 'Required'),
  guardianPhone: z.string().min(6, 'Required'),
  guardianEmail: z.string().email('Valid email').optional().or(z.literal('')),
  guardianOccupation: z.string().optional(),
  addressLine: z.string().min(2, 'Required'),
  city: z.string().min(2, 'Required'),
  state: z.string().min(2, 'Required'),
  country: z.string().min(2, 'Required'),
  pincode: z.string().min(3, 'Required'),
  medicalInfo: z.string().optional(),
  emergencyContact: z.string().optional(),
  classId: z.string().min(1, 'Required'),
  sectionId: z.string().min(1, 'Required'),
  programId: z.string().min(1, 'Required'),
  sessionId: z.string().min(1, 'Required'),
  rollNumber: z.string().optional(),
  feePlanId: z.string().min(1, 'Required'),
  discountAmount: z.coerce.number().min(0).default(0),
  scholarship: z.string().optional(),
  paymentMethod: z.enum(['cash', 'card', 'upi', 'cheque', 'bank_transfer']),
  paymentAmount: z.coerce.number().min(0).default(0),
});

type FormData = z.infer<typeof schema>;

const STEPS = [
  { id: 0, label: 'Student Type', icon: GraduationCap },
  { id: 1, label: 'Personal', icon: User },
  { id: 2, label: 'Guardian', icon: Users },
  { id: 3, label: 'Address', icon: MapPin },
  { id: 4, label: 'Academic', icon: BookOpen },
  { id: 5, label: 'Fee Plan', icon: Wallet },
  { id: 6, label: 'Discount', icon: Percent },
  { id: 7, label: 'Review', icon: CheckCircle2 },
  { id: 8, label: 'Payment', icon: Wallet },
  { id: 9, label: 'Success', icon: PartyPopper },
];

export function AdmissionWizard({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [createdAdm, setCreatedAdm] = useState('');
  const { profile } = useAuth();

  const { data: classes } = useQuery({ queryKey: ['classes'], queryFn: classesApi.list });
  const { data: sections } = useQuery({ queryKey: ['sections'], queryFn: () => sectionsApi.list() });
  const { data: programs } = useQuery({ queryKey: ['programs'], queryFn: programsApi.list });
  const { data: feePlans } = useQuery({ queryKey: ['fee-plans'], queryFn: feePlansApi.list });
  const { data: sessions } = useQuery({ queryKey: ['sessions'], queryFn: sessionsApi.list });

  const methods = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      studentType: 'new',
      gender: 'male',
      bloodGroup: '',
      country: 'India',
      discountAmount: 0,
      paymentAmount: 0,
      paymentMethod: 'cash',
    },
    mode: 'onChange',
  });

  const { watch, handleSubmit, trigger } = methods;
  const formValues = watch();
  const selectedFeePlan = feePlans?.find((f) => f.id === formValues.feePlanId);
  const netPayable = (selectedFeePlan?.total_amount || 0) - (formValues.discountAmount || 0);

  const stepFields: Record<number, (keyof FormData)[]> = {
    0: ['studentType'],
    1: ['firstName', 'lastName', 'email', 'phone', 'gender', 'dateOfBirth'],
    2: ['guardianName', 'guardianRelation', 'guardianPhone'],
    3: ['addressLine', 'city', 'state', 'country', 'pincode'],
    4: ['classId', 'sectionId', 'programId', 'sessionId'],
    5: ['feePlanId'],
    6: ['discountAmount'],
    7: [],
    8: ['paymentAmount', 'paymentMethod'],
  };

  const next = async () => {
    const fields = (stepFields[step] || []) as string[];
    if (fields.length) {
      const valid = await trigger(fields as never[]);
      if (!valid) return;
    }
    if (step === 8) {
      await submit();
    } else {
      setStep((s) => Math.min(s + 1, 9));
    }
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const v = methods.getValues();
      const admNo = generateAdmissionNumber();

      // 1. Create student
      const student = await studentsApi.create({
        admission_number: admNo,
        first_name: v.firstName,
        last_name: v.lastName,
        email: v.email,
        phone: v.phone,
        gender: v.gender,
        date_of_birth: v.dateOfBirth,
        blood_group: v.bloodGroup === NONE_VAL ? null : v.bloodGroup,
        student_type: v.studentType,
        guardian_name: v.guardianName,
        guardian_relation: v.guardianRelation,
        guardian_phone: v.guardianPhone,
        guardian_email: v.guardianEmail || null,
        guardian_occupation: v.guardianOccupation || null,
        address_line: v.addressLine,
        city: v.city,
        state: v.state,
        country: v.country,
        pincode: v.pincode,
        medical_info: v.medicalInfo || null,
        emergency_contact: v.emergencyContact || null,
        class_id: v.classId,
        section_id: v.sectionId,
        program_id: v.programId,
        session_id: v.sessionId,
        roll_number: v.rollNumber || null,
        fee_plan_id: v.feePlanId,
        discount_amount: v.discountAmount,
        scholarship: v.scholarship || null,
        status: 'active',
      });

      // 2. Create initial payment if amount > 0
      if (v.paymentAmount > 0) {
        await paymentsApi.create({
          student_id: student.id,
          receipt_number: generateReceiptNumber(),
          amount: v.paymentAmount,
          payment_method: v.paymentMethod,
          payment_date: new Date().toISOString().slice(0, 10),
          status: 'completed',
          remarks: 'Admission payment',
        });
      }

      // 3. Create activity log + notification
      await activitiesApi.create({
        action: 'created',
        module: 'students',
        description: `${v.firstName} ${v.lastName} admitted (${admNo})`,
        user_id: profile?.id,
        user_name: profile?.full_name,
      });
      await notificationsApi.create({
        user_id: null,
        title: 'New Student Admitted',
        message: `${v.firstName} ${v.lastName} has been admitted (${admNo})`,
        type: 'admission',
      }).catch(() => {});

      setCreatedAdm(admNo);
      setStep(9);
      onCreated();
      toast.success('Admission successful!');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <h2 className="text-lg font-bold">New Admission</h2>
            <p className="text-xs text-muted-foreground">Step {step + 1} of {STEPS.length}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8"><X className="h-4 w-4" /></Button>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full bg-muted">
          <motion.div className="h-full gradient-primary" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
        </div>

        {/* Step indicator */}
        <div className="flex gap-1 overflow-x-auto border-b border-border p-3 scrollbar-thin">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1">
              <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${i === step ? 'bg-primary text-primary-foreground' : i < step ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}`}>
                <s.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
          <FormProvider {...methods}>
            <form onSubmit={handleSubmit(submit)} className="space-y-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  {step === 0 && (
                    <div>
                      <h3 className="mb-4 text-base font-semibold">Select Student Type</h3>
                      <RadioGroup value={formValues.studentType} onValueChange={(v) => methods.setValue('studentType', v as FormData['studentType'])} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {STUDENT_TYPES.map((t) => (
                          <label key={t.value} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-4 transition-colors hover:border-primary hover:bg-accent">
                            <RadioGroupItem value={t.value} />
                            <div>
                              <p className="text-sm font-medium">{t.label}</p>
                            </div>
                          </label>
                        ))}
                      </RadioGroup>
                    </div>
                  )}

                  {step === 1 && (
                    <div>
                      <h3 className="mb-4 text-base font-semibold">Personal Details</h3>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="First Name" name="firstName" methods={methods} />
                        <Field label="Last Name" name="lastName" methods={methods} />
                        <Field label="Email" name="email" type="email" methods={methods} />
                        <Field label="Phone" name="phone" methods={methods} />
                        <SelectField label="Gender" name="gender" methods={methods} options={GENDERS} />
                        <Field label="Date of Birth" name="dateOfBirth" type="date" methods={methods} />
                        <SelectField label="Blood Group" name="bloodGroup" methods={methods} options={BLOOD_GROUPS.map((b) => ({ value: b, label: b }))} allowEmpty />
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div>
                      <h3 className="mb-4 text-base font-semibold">Guardian Details</h3>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Guardian Name" name="guardianName" methods={methods} />
                        <Field label="Relation" name="guardianRelation" methods={methods} />
                        <Field label="Guardian Phone" name="guardianPhone" methods={methods} />
                        <Field label="Guardian Email" name="guardianEmail" type="email" methods={methods} />
                        <Field label="Occupation" name="guardianOccupation" methods={methods} />
                      </div>
                    </div>
                  )}

                  {step === 3 && (
                    <div>
                      <h3 className="mb-4 text-base font-semibold">Address</h3>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <Label>Address Line</Label>
                          <Textarea {...methods.register('addressLine')} className="mt-1.5" />
                          {methods.formState.errors.addressLine && <p className="text-xs text-destructive">{methods.formState.errors.addressLine.message}</p>}
                        </div>
                        <Field label="City" name="city" methods={methods} />
                        <Field label="State" name="state" methods={methods} />
                        <Field label="Country" name="country" methods={methods} />
                        <Field label="Pincode" name="pincode" methods={methods} />
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <Label>Medical Information</Label>
                          <Textarea {...methods.register('medicalInfo')} className="mt-1.5" placeholder="Allergies, conditions..." />
                        </div>
                        <Field label="Emergency Contact" name="emergencyContact" methods={methods} />
                      </div>
                    </div>
                  )}

                  {step === 4 && (
                    <div>
                      <h3 className="mb-4 text-base font-semibold">Academic Details</h3>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <SelectField label="Class" name="classId" methods={methods} options={(classes || []).map((c) => ({ value: c.id, label: c.name }))} />
                        <SelectField label="Section" name="sectionId" methods={methods} options={(sections || []).filter((s) => !formValues.classId || s.class_id === formValues.classId).map((s) => ({ value: s.id, label: s.name }))} />
                        <SelectField label="Program" name="programId" methods={methods} options={(programs || []).map((p) => ({ value: p.id, label: p.name }))} />
                        <SelectField label="Session" name="sessionId" methods={methods} options={(sessions || []).map((s) => ({ value: s.id, label: s.name }))} />
                        <Field label="Roll Number" name="rollNumber" methods={methods} />
                      </div>
                    </div>
                  )}

                  {step === 5 && (
                    <div>
                      <h3 className="mb-4 text-base font-semibold">Fee Plan</h3>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {(feePlans || []).map((fp) => (
                          <label key={fp.id} className={`cursor-pointer rounded-xl border p-4 transition-colors ${formValues.feePlanId === fp.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                            <input type="radio" className="sr-only" checked={formValues.feePlanId === fp.id} onChange={() => methods.setValue('feePlanId', fp.id)} />
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold">{fp.name}</p>
                                <p className="text-xs text-muted-foreground">{fp.code} · {fp.installments} installments</p>
                              </div>
                              <span className="text-sm font-bold text-primary">{formatCurrency(fp.total_amount)}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {step === 6 && (
                    <div>
                      <h3 className="mb-4 text-base font-semibold">Discount & Scholarship</h3>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Discount Amount" name="discountAmount" type="number" methods={methods} />
                        <Field label="Scholarship" name="scholarship" methods={methods} />
                      </div>
                      {selectedFeePlan && (
                        <Card className="mt-4 p-4">
                          <div className="flex justify-between text-sm"><span>Fee Total</span><span>{formatCurrency(selectedFeePlan.total_amount)}</span></div>
                          <div className="flex justify-between text-sm text-destructive"><span>Discount</span><span>-{formatCurrency(formValues.discountAmount || 0)}</span></div>
                          <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-bold"><span>Net Payable</span><span className="text-primary">{formatCurrency(netPayable)}</span></div>
                        </Card>
                      )}
                    </div>
                  )}

                  {step === 7 && (
                    <div>
                      <h3 className="mb-4 text-base font-semibold">Review & Confirm</h3>
                      <div className="space-y-4">
                        <ReviewSection title="Personal" data={{
                          Name: `${formValues.firstName} ${formValues.lastName}`,
                          Email: formValues.email, Phone: formValues.phone, Gender: formValues.gender, DOB: formValues.dateOfBirth,
                        }} />
                        <ReviewSection title="Guardian" data={{
                          Name: formValues.guardianName, Relation: formValues.guardianRelation, Phone: formValues.guardianPhone,
                        }} />
                        <ReviewSection title="Academic" data={{
                          Class: classes?.find((c) => c.id === formValues.classId)?.name,
                          Section: sections?.find((s) => s.id === formValues.sectionId)?.name,
                          Program: programs?.find((p) => p.id === formValues.programId)?.name,
                        }} />
                        <ReviewSection title="Fee" data={{
                          Plan: feePlans?.find((f) => f.id === formValues.feePlanId)?.name,
                          Total: formatCurrency(selectedFeePlan?.total_amount || 0),
                          Discount: formatCurrency(formValues.discountAmount || 0),
                          'Net Payable': formatCurrency(netPayable),
                        }} />
                      </div>
                    </div>
                  )}

                  {step === 8 && (
                    <div>
                      <h3 className="mb-4 text-base font-semibold">Payment</h3>
                      <Card className="mb-4 p-4">
                        <div className="flex justify-between text-sm"><span>Net Payable</span><span className="font-bold">{formatCurrency(netPayable)}</span></div>
                      </Card>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Payment Amount" name="paymentAmount" type="number" methods={methods} />
                        <SelectField label="Payment Method" name="paymentMethod" methods={methods} options={PAYMENT_METHODS} />
                      </div>
                      <p className="mt-4 text-xs text-muted-foreground">You can record a partial payment now and collect the balance later from the Fees module.</p>
                    </div>
                  )}

                  {step === 9 && (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.1 }} className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-success/15">
                        <PartyPopper className="h-10 w-10 text-success" />
                      </motion.div>
                      <h3 className="text-xl font-bold">Admission Successful!</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Student has been admitted successfully.</p>
                      <div className="mt-4 rounded-lg bg-muted px-4 py-2">
                        <p className="text-xs text-muted-foreground">Admission Number</p>
                        <p className="font-mono text-lg font-bold text-primary">{createdAdm}</p>
                      </div>
                      <Button className="mt-6" onClick={onClose}>Done</Button>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </form>
          </FormProvider>
        </div>

        {/* Footer */}
        {step < 9 && (
          <div className="flex items-center justify-between border-t border-border p-4">
            <Button variant="outline" disabled={step === 0 || submitting} onClick={() => setStep((s) => Math.max(0, s - 1))}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <Button onClick={next} disabled={submitting}>
              {step === 8 ? (submitting ? 'Processing...' : 'Complete Admission') : 'Next'}
              {step !== 8 && <ChevronRight className="ml-1 h-4 w-4" />}
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function Field({ label, name, type = 'text', methods }: { label: string; name: keyof FormData; type?: string; methods: ReturnType<typeof useForm<FormData>> }) {
  const error = methods.formState.errors[name];
  return (
    <div>
      <Label>{label}</Label>
      <Input type={type} className="mt-1.5" {...methods.register(name)} />
      {error && <p className="mt-1 text-xs text-destructive">{(error as { message?: string }).message}</p>}
    </div>
  );
}

function SelectField({ label, name, methods, options, allowEmpty }: { label: string; name: keyof FormData; methods: ReturnType<typeof useForm<FormData>>; options: { value: string; label: string }[]; allowEmpty?: boolean }) {
  const rawValue = methods.watch(name) as string;
  const value = rawValue || undefined;
  const error = methods.formState.errors[name];
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value} onValueChange={(v) => methods.setValue(name, (v === NONE_VAL ? '' : v) as unknown as string, { shouldValidate: true })}>
        <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select..." /></SelectTrigger>
        <SelectContent>
          {allowEmpty && <SelectItem value={NONE_VAL}>None</SelectItem>}
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
      {error && <p className="mt-1 text-xs text-destructive">{(error as { message?: string }).message}</p>}
    </div>
  );
}

function ReviewSection({ title, data }: { title: string; data: Record<string, unknown> }) {
  return (
    <Card className="p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Object.entries(data).map(([k, v]) => (
          <div key={k}>
            <p className="text-[11px] text-muted-foreground">{k}</p>
            <p className="text-sm font-medium">{String(v || '-')}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
