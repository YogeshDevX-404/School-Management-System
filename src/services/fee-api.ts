import { supabase } from '@/lib/supabase';
import type { FeeInstallment, FeeDashboardStats, Payment } from '@/types';

export interface PendingFeeStudent {
  student_id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  class_name?: string;
  guardian_name?: string;
  guardian_phone?: string;
  phone?: string;
  total_fee: number;
  paid_amount: number;
  pending_amount: number;
}

export interface FeeReportRow {
  date: string;
  receipt_number: string;
  student_name: string;
  admission_number: string;
  class_name?: string;
  amount: number;
  payment_method: string;
  status: string;
}

export const feeApi = {
  async dashboardStats(): Promise<FeeDashboardStats> {
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

    const [todayP, monthP, allP, students, plans] = await Promise.all([
      supabase.from('payments').select('amount').eq('is_deleted', false).eq('status', 'completed').eq('payment_date', today),
      supabase.from('payments').select('amount').eq('is_deleted', false).eq('status', 'completed').gte('payment_date', monthStart),
      supabase.from('payments').select('amount, status, student_id').eq('is_deleted', false),
      supabase.from('students').select('id, fee_plan_id, discount_amount').eq('is_deleted', false),
      supabase.from('fee_plans').select('id, total_amount').eq('is_deleted', false).eq('status', 'active'),
    ]);

    const todayCollection = (todayP.data || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
    const monthCollection = (monthP.data || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
    const totalCollection = (allP.data || []).filter((p: any) => p.status === 'completed').reduce((s: number, p: any) => s + Number(p.amount), 0);

    const planMap = new Map((plans.data || []).map((p: any) => [p.id, Number(p.total_amount)]));
    const payMap: Record<string, number> = {};
    for (const p of (allP.data || [])) {
      if (p.status === 'completed') payMap[p.student_id] = (payMap[p.student_id] || 0) + Number(p.amount);
    }

    let expected = 0;
    let pending = 0;
    let partialCount = 0;
    for (const s of (students.data || [])) {
      const planAmt = planMap.get(s.fee_plan_id) || 0;
      const net = planAmt - (s.discount_amount || 0);
      expected += net;
      const paid = payMap[s.id] || 0;
      const pend = Math.max(0, net - paid);
      if (pend > 0) {
        pending += pend;
        if (paid > 0) partialCount++;
      }
    }

    return {
      todayCollection,
      monthCollection,
      pendingFees: pending,
      partiallyPaidCount: partialCount,
      totalCollection,
      expectedCollection: expected,
      collectionRate: expected > 0 ? Math.round((totalCollection / expected) * 100) : 0,
    };
  },

  async pendingFees(): Promise<PendingFeeStudent[]> {
    const [students, payments, plans, classes] = await Promise.all([
      supabase.from('students').select('id, first_name, last_name, admission_number, class_id, guardian_name, guardian_phone, phone, fee_plan_id, discount_amount').eq('is_deleted', false),
      supabase.from('payments').select('student_id, amount, status').eq('is_deleted', false).eq('status', 'completed'),
      supabase.from('fee_plans').select('id, total_amount').eq('is_deleted', false).eq('status', 'active'),
      supabase.from('classes').select('id, name').eq('is_deleted', false),
    ]);

    const planMap = new Map((plans.data || []).map((p: any) => [p.id, Number(p.total_amount)]));
    const classMap = new Map((classes.data || []).map((c: any) => [c.id, c.name]));
    const payMap: Record<string, number> = {};
    for (const p of (payments.data || [])) payMap[p.student_id] = (payMap[p.student_id] || 0) + Number(p.amount);

    const result: PendingFeeStudent[] = [];
    for (const s of (students.data || [])) {
      const planAmt = planMap.get(s.fee_plan_id) || 0;
      const net = planAmt - (s.discount_amount || 0);
      const paid = payMap[s.id] || 0;
      const pend = Math.max(0, net - paid);
      if (pend > 0) {
        result.push({
          student_id: s.id, first_name: s.first_name, last_name: s.last_name,
          admission_number: s.admission_number, class_name: classMap.get(s.class_id),
          guardian_name: s.guardian_name, guardian_phone: s.guardian_phone, phone: s.phone,
          total_fee: net, paid_amount: paid, pending_amount: pend,
        });
      }
    }
    return result.sort((a, b) => b.pending_amount - a.pending_amount);
  },

  async getInstallments(studentId: string): Promise<FeeInstallment[]> {
    const { data, error } = await supabase.from('fee_installments').select('*').eq('student_id', studentId).eq('is_deleted', false).order('installment_number');
    if (error) throw error;
    return (data || []) as FeeInstallment[];
  },

  async generateInstallments(studentId: string, feePlanId: string, totalAmount: number, installments: number): Promise<void> {
    const per = Math.round(totalAmount / installments);
    const remainder = totalAmount - per * installments;
    const records: any[] = [];
    for (let i = 1; i <= installments; i++) {
      const due = new Date();
      due.setMonth(due.getMonth() + i);
      records.push({
        student_id: studentId, fee_plan_id: feePlanId, installment_number: i,
        title: `Installment ${i}`, amount: i === installments ? per + remainder : per,
        due_date: due.toISOString().slice(0, 10), status: 'pending', paid_amount: 0,
      });
    }
    const { error } = await supabase.from('fee_installments').insert(records);
    if (error) throw error;
  },

  async collectFee(payload: {
    student_id: string; amount: number; payment_method: string; payment_type: string;
    remarks?: string; collected_by?: string; transaction_id?: string;
    late_fee?: number; discount_applied?: number; scholarship_applied?: number;
    previous_balance?: number; current_balance?: number; installment_number?: number;
  }): Promise<Payment> {
    const receipt_number = 'RCPT' + Date.now().toString().slice(-8);
    const { data, error } = await supabase.from('payments').insert({
      receipt_number, student_id: payload.student_id, amount: payload.amount,
      payment_method: payload.payment_method, payment_type: payload.payment_type,
      remarks: payload.remarks, collected_by: payload.collected_by,
      transaction_id: payload.transaction_id, late_fee: payload.late_fee || 0,
      discount_applied: payload.discount_applied || 0, scholarship_applied: payload.scholarship_applied || 0,
      previous_balance: payload.previous_balance || 0, current_balance: payload.current_balance || 0,
      installment_number: payload.installment_number, status: 'completed',
    }).select().single();
    if (error) throw error;
    return data as Payment;
  },

  async reportData(filters: { dateFrom?: string; dateTo?: string; paymentMethod?: string; status?: string }): Promise<FeeReportRow[]> {
    let q = supabase.from('payments').select('id, receipt_number, payment_date, amount, payment_method, status, student_id').eq('is_deleted', false);
    if (filters.dateFrom) q = q.gte('payment_date', filters.dateFrom);
    if (filters.dateTo) q = q.lte('payment_date', filters.dateTo);
    if (filters.paymentMethod && filters.paymentMethod !== 'all') q = q.eq('payment_method', filters.paymentMethod);
    if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status);
    q = q.order('payment_date', { ascending: false }).limit(500);
    const { data: payments, error } = await q;
    if (error) throw error;

    const studentIds = [...new Set((payments || []).map((p: any) => p.student_id))];
    if (!studentIds.length) return [];

    const { data: students } = await supabase.from('students').select('id, first_name, last_name, admission_number, class_id').in('id', studentIds);
    const sMap = new Map((students || []).map((s: any) => [s.id, s]));
    const classIds = [...new Set((students || []).map((s: any) => s.class_id).filter(Boolean))];
    const { data: classes } = classIds.length ? await supabase.from('classes').select('id, name').in('id', classIds) : { data: [] };
    const cMap = new Map((classes || []).map((c: any) => [c.id, c.name]));

    return (payments || []).map((p: any) => {
      const s = sMap.get(p.student_id);
      return {
        date: p.payment_date, receipt_number: p.receipt_number,
        student_name: s ? `${s.first_name} ${s.last_name}` : 'Unknown',
        admission_number: s?.admission_number || 'N/A',
        class_name: s?.class_id ? cMap.get(s.class_id) : undefined,
        amount: Number(p.amount), payment_method: p.payment_method, status: p.status,
      };
    });
  },
};
