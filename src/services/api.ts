import { supabase } from '@/lib/supabase';
import type {
  Student, Staff, Payment, FeePlan, ClassRow, Section, Subject,
  Program, AcademicSession, Activity, Settings, Attendance, TimetableEntry,
  LeaveRequest, TeacherClassAssignment, Notification,
} from '@/types';

export interface Paginated<T> {
  data: T[];
  total: number;
}



// ===== Students =====
export const studentsApi = {
  async list(params: { page?: number; pageSize?: number; search?: string; classId?: string; status?: string } = {}) {
    const { page = 1, pageSize = 10, search, classId, status } = params;
    let query = supabase.from('students').select('*', { count: 'exact' }).eq('is_deleted', false);
    if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,admission_number.ilike.%${search}%`);
    if (classId) query = query.eq('class_id', classId);
    if (status) query = query.eq('status', status);
    query = query.order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
    const { data, count, error } = await query;
    if (error) throw error;
    return { data: (data || []) as Student[], total: count || 0 };
  },
  async get(id: string) {
    const { data, error } = await supabase.from('students').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data as Student | null;
  },
  async create(payload: Partial<Student>) {
    const { data, error } = await supabase.from('students').insert(payload).select().single();
    if (error) throw error;
    return data as Student;
  },
  async update(id: string, payload: Partial<Student>) {
    const { data, error } = await supabase.from('students').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data as Student;
  },
  async remove(id: string) {
    const { error } = await supabase.from('students').update({ is_deleted: true }).eq('id', id);
    if (error) throw error;
  },
  async count() {
    const { count, error } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('is_deleted', false);
    if (error) throw error;
    return count || 0;
  },
  async todayAdmissions() {
    const today = new Date().toISOString().slice(0, 10);
    const { count, error } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('is_deleted', false).eq('admission_date', today);
    if (error) throw error;
    return count || 0;
  },
};

// ===== Staff =====
export const staffApi = {
  async list(params: { page?: number; pageSize?: number; search?: string; role?: string } = {}) {
    const { page = 1, pageSize = 10, search, role } = params;
    let query = supabase.from('staff').select('*', { count: 'exact' }).eq('is_deleted', false);
    if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,employee_number.ilike.%${search}%`);
    if (role) query = query.eq('role', role);
    query = query.order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
    const { data, count, error } = await query;
    if (error) throw error;
    return { data: (data || []) as Staff[], total: count || 0 };
  },
  async get(id: string) {
    const { data, error } = await supabase.from('staff').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data as Staff | null;
  },
  async create(payload: Partial<Staff>) {
    const { data, error } = await supabase.from('staff').insert(payload).select().single();
    if (error) throw error;
    return data as Staff;
  },
  async update(id: string, payload: Partial<Staff>) {
    const { data, error } = await supabase.from('staff').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data as Staff;
  },
  async remove(id: string) {
    const { error } = await supabase.from('staff').update({ is_deleted: true }).eq('id', id);
    if (error) throw error;
  },
  async count() {
    const { count, error } = await supabase.from('staff').select('*', { count: 'exact', head: true }).eq('is_deleted', false);
    if (error) throw error;
    return count || 0;
  },
  async teacherCount() {
    const { count, error } = await supabase.from('staff').select('*', { count: 'exact', head: true }).eq('is_deleted', false).eq('role', 'teacher');
    if (error) throw error;
    return count || 0;
  },
};

// ===== Payments =====
export const paymentsApi = {
  async list(params: { page?: number; pageSize?: number; search?: string; studentId?: string } = {}) {
    const { page = 1, pageSize = 10, search, studentId } = params;
    let query = supabase.from('payments').select('*', { count: 'exact' }).eq('is_deleted', false);
    if (studentId) query = query.eq('student_id', studentId);
    if (search) query = query.ilike('receipt_number', `%${search}%`);
    query = query.order('payment_date', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
    const { data, count, error } = await query;
    if (error) throw error;
    return { data: (data || []) as Payment[], total: count || 0 };
  },
  async create(payload: Partial<Payment>) {
    const { data, error } = await supabase.from('payments').insert(payload).select().single();
    if (error) throw error;
    return data as Payment;
  },
  async totalCollection() {
    const { data, error } = await supabase.from('payments').select('amount').eq('is_deleted', false).eq('status', 'completed');
    if (error) throw error;
    return (data || []).reduce((sum, p) => sum + Number(p.amount), 0);
  },
  async update(id: string, payload: Partial<Payment>) {
    const { data, error } = await supabase.from('payments').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data as Payment;
  },
  async remove(id: string) {
    const { error } = await supabase.from('payments').update({ is_deleted: true }).eq('id', id);
    if (error) throw error;
  },
  async monthlyCollection() {
    const { data, error } = await supabase.from('payments').select('amount,payment_date').eq('is_deleted', false).eq('status', 'completed');
    if (error) throw error;
    const months: Record<string, number> = {};
    (data || []).forEach((p) => {
      const m = new Date(p.payment_date).getMonth();
      months[m] = (months[m] || 0) + Number(p.amount);
    });
    return months;
  },
};

// ===== Fee Plans =====
export const feePlansApi = {
  async list() {
    const { data, error } = await supabase.from('fee_plans').select('*').eq('is_deleted', false).order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as FeePlan[];
  },
  async create(payload: Partial<FeePlan>) {
    const { data, error } = await supabase.from('fee_plans').insert(payload).select().single();
    if (error) throw error;
    return data as FeePlan;
  },
  async update(id: string, payload: Partial<FeePlan>) {
    const { data, error } = await supabase.from('fee_plans').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data as FeePlan;
  },
  async remove(id: string) {
    const { error } = await supabase.from('fee_plans').update({ is_deleted: true }).eq('id', id);
    if (error) throw error;
  },
};

// ===== Classes =====
export const classesApi = {
  async list() {
    const { data, error } = await supabase.from('classes').select('*').eq('is_deleted', false).order('class_numeric', { ascending: true });
    if (error) throw error;
    return (data || []) as ClassRow[];
  },
  async create(payload: Partial<ClassRow>) {
    const { data, error } = await supabase.from('classes').insert(payload).select().single();
    if (error) throw error;
    return data as ClassRow;
  },
  async update(id: string, payload: Partial<ClassRow>) {
    const { data, error } = await supabase.from('classes').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data as ClassRow;
  },
  async remove(id: string) {
    const { error } = await supabase.from('classes').update({ is_deleted: true }).eq('id', id);
    if (error) throw error;
  },
};

// ===== Sections =====
export const sectionsApi = {
  async list(classId?: string) {
    let query = supabase.from('sections').select('*').eq('is_deleted', false);
    if (classId) query = query.eq('class_id', classId);
    const { data, error } = await query.order('name');
    if (error) throw error;
    return (data || []) as Section[];
  },
  async create(payload: Partial<Section>) {
    const { data, error } = await supabase.from('sections').insert(payload).select().single();
    if (error) throw error;
    return data as Section;
  },
  async remove(id: string) {
    const { error } = await supabase.from('sections').update({ is_deleted: true }).eq('id', id);
    if (error) throw error;
  },
};

// ===== Subjects =====
export const subjectsApi = {
  async list() {
    const { data, error } = await supabase.from('subjects').select('*').eq('is_deleted', false).order('name');
    if (error) throw error;
    return (data || []) as Subject[];
  },
  async create(payload: Partial<Subject>) {
    const { data, error } = await supabase.from('subjects').insert(payload).select().single();
    if (error) throw error;
    return data as Subject;
  },
  async update(id: string, payload: Partial<Subject>) {
    const { data, error } = await supabase.from('subjects').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data as Subject;
  },
  async remove(id: string) {
    const { error } = await supabase.from('subjects').update({ is_deleted: true }).eq('id', id);
    if (error) throw error;
  },
};

// ===== Programs =====
export const programsApi = {
  async list() {
    const { data, error } = await supabase.from('programs').select('*').eq('is_deleted', false).order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as Program[];
  },
  async create(payload: Partial<Program>) {
    const { data, error } = await supabase.from('programs').insert(payload).select().single();
    if (error) throw error;
    return data as Program;
  },
  async update(id: string, payload: Partial<Program>) {
    const { data, error } = await supabase.from('programs').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data as Program;
  },
  async remove(id: string) {
    const { error } = await supabase.from('programs').update({ is_deleted: true }).eq('id', id);
    if (error) throw error;
  },
};

// ===== Academic Sessions =====
export const sessionsApi = {
  async list() {
    const { data, error } = await supabase.from('academic_sessions').select('*').eq('is_deleted', false).order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as AcademicSession[];
  },
  async create(payload: Partial<AcademicSession>) {
    const { data, error } = await supabase.from('academic_sessions').insert(payload).select().single();
    if (error) throw error;
    return data as AcademicSession;
  },
  async update(id: string, payload: Partial<AcademicSession>) {
    const { data, error } = await supabase.from('academic_sessions').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data as AcademicSession;
  },
  async remove(id: string) {
    const { error } = await supabase.from('academic_sessions').update({ is_deleted: true }).eq('id', id);
    if (error) throw error;
  },
};

// ===== Attendance =====
export const attendanceApi = {
  async listForDate(date: string, personType: 'student' | 'staff') {
    const { data, error } = await supabase.from('attendance').select('*').eq('date', date).eq('person_type', personType).eq('is_deleted', false);
    if (error) throw error;
    return (data || []) as Attendance[];
  },
  async upsertMany(records: Partial<Attendance>[]) {
    const { data, error } = await supabase.from('attendance').upsert(records, { onConflict: 'person_id,person_type,date' }).select();
    if (error) throw error;
    return (data || []) as Attendance[];
  },
};

// ===== Activities =====
export const activitiesApi = {
  async list(limit = 10) {
    const { data, error } = await supabase.from('activities').select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return (data || []) as Activity[];
  },
  async create(payload: Partial<Activity>) {
    const { error } = await supabase.from('activities').insert(payload);
    if (error) throw error;
  },
};

// ===== Settings =====
export const settingsApi = {
  async get() {
    const { data, error } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();
    if (error) throw error;
    return data as Settings | null;
  },
  async update(payload: Partial<Settings>) {
    const { data, error } = await supabase.from('settings').update(payload).eq('id', 1).select().single();
    if (error) throw error;
    return data as Settings;
  },
};

// ===== Dashboard stats =====
export const dashboardApi = {
  async stats() {
    const [students, staff, teachers, admissions, todayAdm, collection, pending] = await Promise.all([
      studentsApi.count(),
      staffApi.count(),
      staffApi.teacherCount(),
      studentsApi.count(),
      studentsApi.todayAdmissions(),
      paymentsApi.totalCollection(),
      0,
    ]);
    return {
      totalStudents: students,
      totalStaff: staff,
      totalTeachers: teachers,
      totalAdmissions: admissions,
      todayAdmissions: todayAdm,
      totalCollection: collection,
      pendingFees: pending,
    };
  },
  async admissionsTrend() {
    const { data, error } = await supabase.from('students').select('admission_date').eq('is_deleted', false);
    if (error) throw error;
    const months: Record<string, number> = {};
    (data || []).forEach((s) => {
      const m = new Date(s.admission_date).getMonth();
      months[m] = (months[m] || 0) + 1;
    });
    return months;
  },
  async recentAdmissions(limit = 5) {
    const { data, error } = await supabase.from('students').select('*').eq('is_deleted', false).order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return (data || []) as Student[];
  },
  async recentPayments(limit = 5) {
    const { data, error } = await supabase.from('payments').select('*').eq('is_deleted', false).order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return (data || []) as Payment[];
  },
  async recentActivities(limit = 6) {
    return activitiesApi.list(limit);
  },
};

export const timetableApi = {
  async list(classId?: string, sectionId?: string): Promise<TimetableEntry[]> {
    let q = supabase.from('timetable').select('*').eq('is_deleted', false).order('day_of_week').order('period_number');
    if (classId) q = q.eq('class_id', classId);
    if (sectionId) q = q.eq('section_id', sectionId);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as TimetableEntry[];
  },
  async create(entry: Omit<TimetableEntry, 'id' | 'created_at' | 'updated_at' | 'is_deleted' | 'status'>): Promise<TimetableEntry> {
    const { data, error } = await supabase.from('timetable').insert({ ...entry, status: 'active' }).select().single();
    if (error) throw error;
    return data as TimetableEntry;
  },
  async update(id: string, patch: Partial<TimetableEntry>): Promise<TimetableEntry> {
    const { data, error } = await supabase.from('timetable').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data as TimetableEntry;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('timetable').delete().eq('id', id);
    if (error) throw error;
  },
  async byTeacher(teacherId: string): Promise<TimetableEntry[]> {
    const { data, error } = await supabase.from('timetable').select('*').eq('is_deleted', false).eq('teacher_id', teacherId).order('day_of_week').order('period_number');
    if (error) throw error;
    return (data || []) as TimetableEntry[];
  },
};

export const leaveRequestsApi = {
  async list(teacherId?: string): Promise<LeaveRequest[]> {
    let q = supabase.from('leave_requests').select('*').eq('is_deleted', false).order('created_at', { ascending: false });
    if (teacherId) q = q.eq('teacher_id', teacherId);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as LeaveRequest[];
  },
  async create(payload: Omit<LeaveRequest, 'id' | 'created_at' | 'updated_at' | 'status' | 'reviewed_by' | 'reviewed_at' | 'review_notes' | 'user_id' | 'created_by'>): Promise<LeaveRequest> {
    const { data, error } = await supabase.from('leave_requests').insert(payload).select().single();
    if (error) throw error;
    return data as LeaveRequest;
  },
  async update(id: string, patch: Partial<LeaveRequest>): Promise<LeaveRequest> {
    const { data, error } = await supabase.from('leave_requests').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data as LeaveRequest;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('leave_requests').update({ is_deleted: true }).eq('id', id);
    if (error) throw error;
  },
};

export const teacherAssignmentsApi = {
  async list(teacherId?: string): Promise<TeacherClassAssignment[]> {
    let q = supabase.from('teacher_class_assignments').select('*').eq('is_deleted', false).eq('is_active', true);
    if (teacherId) q = q.eq('teacher_id', teacherId);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as TeacherClassAssignment[];
  },
  async listAll(): Promise<TeacherClassAssignment[]> {
    const { data, error } = await supabase.from('teacher_class_assignments').select('*').eq('is_deleted', false).order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as TeacherClassAssignment[];
  },
  async create(payload: Omit<TeacherClassAssignment, 'id' | 'created_at' | 'updated_at'>): Promise<TeacherClassAssignment> {
    const { data, error } = await supabase.from('teacher_class_assignments').insert(payload).select().single();
    if (error) throw error;
    return data as TeacherClassAssignment;
  },
  async update(id: string, patch: Partial<TeacherClassAssignment>): Promise<TeacherClassAssignment> {
    const { data, error } = await supabase.from('teacher_class_assignments').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data as TeacherClassAssignment;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('teacher_class_assignments').update({ is_deleted: true, is_active: false }).eq('id', id);
    if (error) throw error;
  },
};

export const notificationsApi = {
  async list(userId?: string): Promise<Notification[]> {
    if (userId) {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`user_id.eq.${userId},user_id.is.null`)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data || []) as Notification[];
    }
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    return (data || []) as Notification[];
  },
  async create(payload: { user_id?: string | null; title: string; message: string; type: string; priority?: 'low' | 'medium' | 'high'; status?: string }): Promise<void> {
    const { error } = await supabase.from('notifications').insert(payload);
    if (error) throw error;
  },
  async markRead(id: string): Promise<void> {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    if (error) throw error;
  },
  async markAllRead(userId: string): Promise<void> {
    const { error } = await supabase.from('notifications').update({ is_read: true }).or(`user_id.eq.${userId},user_id.is.null`);
    if (error) throw error;
  },
};
