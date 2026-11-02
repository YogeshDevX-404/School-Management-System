import type { UserRole } from '@/types';

export const ROLES: { value: UserRole; label: string; description: string }[] = [
  { value: 'super_admin', label: 'Super Admin', description: 'Full system access with all permissions' },
  { value: 'admin', label: 'Admin', description: 'Manage all modules and users' },
  { value: 'principal', label: 'Principal', description: 'Oversee academics, staff, and reports' },
  { value: 'accountant', label: 'Accountant', description: 'Manage fees, payments, and financial reports' },
  { value: 'teacher', label: 'Teacher', description: 'Manage attendance, timetable, and students' },
  { value: 'student', label: 'Student', description: 'View attendance, fees, and timetable' },
];

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  principal: 'Principal',
  accountant: 'Accountant',
  teacher: 'Teacher',
  student: 'Student',
};

export const STAFF_ROLES = [
  { value: 'principal', label: 'Principal' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'librarian', label: 'Librarian' },
  { value: 'driver', label: 'Driver' },
  { value: 'security', label: 'Security' },
  { value: 'admin', label: 'Admin' },
];

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

export const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

export const STUDENT_TYPES = [
  { value: 'new', label: 'New Admission' },
  { value: 'transfer', label: 'Transfer Student' },
  { value: 're_admission', label: 'Re-Admission' },
];

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const ATTENDANCE_STATUS = [
  { value: 'present', label: 'Present', color: 'success' },
  { value: 'absent', label: 'Absent', color: 'destructive' },
  { value: 'late', label: 'Late', color: 'warning' },
  { value: 'half_day', label: 'Half Day', color: 'secondary' },
];

export const PAGE_SIZE = 10;

export const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
