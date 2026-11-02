export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'principal'
  | 'accountant'
  | 'teacher'
  | 'student';

export type StaffRole =
  | 'principal'
  | 'teacher'
  | 'accountant'
  | 'librarian'
  | 'driver'
  | 'security'
  | 'admin';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string | null;
  avatar_url?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AcademicSession {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ClassRow {
  id: string;
  name: string;
  class_numeric: number;
  session_id?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Section {
  id: string;
  name: string;
  class_id: string;
  capacity: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  class_id?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Program {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  duration: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface FeeComponent {
  name: string;
  amount: number;
}

export interface FeePlan {
  id: string;
  name: string;
  code: string;
  class_id?: string | null;
  total_amount: number;
  components: FeeComponent[];
  installments: number;
  description?: string | null;
  status: string;
  program_id?: string | null;
  session_id?: string | null;
  applicable_category?: string | null;
  effective_date?: string | null;
  expiry_date?: string | null;
  discount_rules?: Record<string, unknown>;
  scholarship_rules?: Record<string, unknown>;
  late_fee_rule_id?: string | null;
  tax_percent?: number;
  version?: number;
  created_at: string;
  updated_at: string;
}

export interface FeeInstallment {
  id: string;
  student_id: string;
  fee_plan_id?: string | null;
  installment_number: number;
  title: string;
  amount: number;
  due_date?: string | null;
  status: 'pending' | 'paid' | 'overdue' | 'partially_paid';
  paid_amount: number;
  paid_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LateFeeRule {
  id: string;
  name: string;
  grace_period_days: number;
  fee_type: 'fixed' | 'percentage';
  fee_value: number;
  frequency: 'one_time' | 'daily' | 'weekly' | 'monthly';
  max_amount?: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface FeeDashboardStats {
  todayCollection: number;
  monthCollection: number;
  pendingFees: number;
  partiallyPaidCount: number;
  totalCollection: number;
  expectedCollection: number;
  collectionRate: number;
}

export interface Student {
  id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  date_of_birth?: string | null;
  blood_group?: string | null;
  photo_url?: string | null;
  student_type: 'new' | 'transfer' | 're_admission';
  father_name?: string | null;
  mother_name?: string | null;
  guardian_name?: string | null;
  guardian_relation?: string | null;
  guardian_phone?: string | null;
  guardian_email?: string | null;
  guardian_occupation?: string | null;
  address_line?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
  medical_info?: string | null;
  emergency_contact?: string | null;
  class_id?: string | null;
  section_id?: string | null;
  program_id?: string | null;
  session_id?: string | null;
  admission_date: string;
  roll_number?: string | null;
  fee_plan_id?: string | null;
  discount_amount: number;
  scholarship?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Staff {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  date_of_birth?: string | null;
  photo_url?: string | null;
  role: StaffRole;
  department?: string | null;
  qualification?: string | null;
  salary: number;
  joining_date: string;
  address_line?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
  user_id?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  receipt_number: string;
  student_id: string;
  fee_plan_id?: string | null;
  amount: number;
  payment_type: 'full' | 'partial' | 'installment';
  payment_method: 'cash' | 'card' | 'upi' | 'cheque' | 'bank_transfer' | 'wallet';
  installment_number?: number | null;
  payment_date: string;
  remarks?: string | null;
  status: string;
  collected_by?: string | null;
  transaction_id?: string | null;
  previous_balance?: number;
  current_balance?: number;
  late_fee?: number;
  discount_applied?: number;
  scholarship_applied?: number;
  academic_session_id?: string | null;
  payment_proof_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  person_id: string;
  person_type: 'student' | 'staff';
  date: string;
  status: 'present' | 'absent' | 'late' | 'half_day';
  remarks?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  user_id?: string | null;
  user_name?: string | null;
  action: string;
  module: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id?: string | null;
  title: string;
  message: string;
  type: string;
  priority?: 'low' | 'medium' | 'high';
  status?: string;
  is_read: boolean;
  created_at: string;
}

export interface Settings {
  id: number;
  institute_name: string;
  institute_tagline?: string | null;
  institute_address?: string | null;
  institute_phone?: string | null;
  institute_email?: string | null;
  institute_website?: string | null;
  logo_url?: string | null;
  current_session_id?: string | null;
  smtp_config?: Record<string, unknown>;
  theme: string;
  created_at: string;
  updated_at: string;
}

export interface TimetableEntry {
  id: string;
  class_id: string;
  section_id: string;
  subject_id: string | null;
  teacher_id: string | null;
  day_of_week: string;
  period_number: number;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  status: string;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  teacher_id: string;
  leave_type: 'casual' | 'sick' | 'earned' | 'maternity' | 'other';
  reason: string;
  start_date: string;
  end_date: string;
  attachment_url?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TeacherClassAssignment {
  id: string;
  teacher_id: string;
  class_id: string;
  section_id?: string | null;
  subject_id?: string | null;
  session_id?: string | null;
  is_active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  created_by?: string | null;
  last_message_id?: string | null;
  last_message_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body?: string | null;
  message_type: 'text' | 'image' | 'pdf' | 'word' | 'excel' | 'file';
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_size?: number | null;
  created_at: string;
}

export interface MessageStatus {
  id: string;
  message_id: string;
  user_id: string;
  status: 'sent' | 'delivered' | 'read';
  read_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserPresence {
  user_id: string;
  is_online: boolean;
  last_seen: string;
}

export interface ChatContact {
  id: string;
  full_name: string;
  email: string;
  role: string;
  avatar_url?: string | null;
  department?: string | null;
}

export type NoticePriority = 'low' | 'medium' | 'high' | 'urgent';
export type NoticeAudienceRole = 'all' | 'super_admin' | 'admin' | 'principal' | 'teacher' | 'accountant' | 'student';
export type AttachmentType = 'image' | 'pdf' | 'word' | 'excel' | 'file';

export interface Notice {
  id: string;
  title: string;
  description: string;
  priority: NoticePriority;
  created_by?: string | null;
  author_name: string;
  author_role: string;
  author_avatar?: string | null;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_type?: AttachmentType | null;
  publish_date: string;
  expiry_date?: string | null;
  is_published: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface NoticeAudience {
  id: string;
  notice_id: string;
  role: NoticeAudienceRole;
}

export interface NoticeWithAudience extends Notice {
  audiences: NoticeAudienceRole[];
}

export interface AIChat {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AIMessage {
  id: string;
  chat_id: string;
  role: 'user' | 'assistant';
  content: string;
  intent?: string | null;
  created_at: string;
}
