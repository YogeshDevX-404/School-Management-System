import type { UserRole } from '@/types';

export type ModuleKey =
  | 'dashboard'
  | 'students'
  | 'staff'
  | 'fees'
  | 'attendance'
  | 'timetable'
  | 'academic'
  | 'programs'
  | 'reports'
  | 'permissions'
  | 'settings'
  | 'profile'
  | 'leave_requests'
  | 'notifications'
  | 'communication'
  | 'notices'
  | 'ai_assistant';

export type AccessLevel = 'full' | 'read' | 'none';

type PermissionMap = Record<ModuleKey, AccessLevel>;

const FULL: PermissionMap = {
  dashboard: 'full', students: 'full', staff: 'full', fees: 'full',
  attendance: 'full', timetable: 'full', academic: 'full', programs: 'full',
  reports: 'full', permissions: 'full', settings: 'full', profile: 'full',
  leave_requests: 'full', notifications: 'full', communication: 'full', notices: 'full', ai_assistant: 'full',
};

const NONE: PermissionMap = {
  dashboard: 'none', students: 'none', staff: 'none', fees: 'none',
  attendance: 'none', timetable: 'none', academic: 'none', programs: 'none',
  reports: 'none', permissions: 'none', settings: 'none', profile: 'none',
  leave_requests: 'none', notifications: 'none', communication: 'none', notices: 'none', ai_assistant: 'none',
};

function make(overrides: Partial<PermissionMap>): PermissionMap {
  return { ...NONE, ...overrides };
}

export const ROLE_PERMISSIONS: Record<UserRole, PermissionMap> = {
  super_admin: FULL,
  admin: { ...FULL, permissions: 'read' },
  principal: make({
    dashboard: 'full', students: 'full', staff: 'full', attendance: 'full',
    timetable: 'full', academic: 'full', programs: 'read', reports: 'full',
    profile: 'full', leave_requests: 'full', notifications: 'full', communication: 'full', notices: 'full', ai_assistant: 'full',
  }),
  accountant: make({
    dashboard: 'full', fees: 'full', reports: 'full', profile: 'full',
    notifications: 'read', communication: 'full', notices: 'read', ai_assistant: 'full',
  }),
  teacher: make({
    dashboard: 'full', students: 'read', attendance: 'full', timetable: 'read',
    profile: 'full', leave_requests: 'full', notifications: 'read', communication: 'full', notices: 'read', ai_assistant: 'full',
  }),
  student: make({
    dashboard: 'read', attendance: 'read', timetable: 'read', profile: 'full',
    notifications: 'read', notices: 'read',
  }),
};

export function canAccess(role: UserRole | null | undefined, module: ModuleKey): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.[module] !== 'none';
}

export function canWrite(role: UserRole | null | undefined, module: ModuleKey): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.[module] === 'full';
}

export function canRead(role: UserRole | null | undefined, module: ModuleKey): boolean {
  if (!role) return false;
  const level = ROLE_PERMISSIONS[role]?.[module];
  return level === 'full' || level === 'read';
}

export function accessLevel(role: UserRole | null | undefined, module: ModuleKey): AccessLevel {
  if (!role) return 'none';
  return ROLE_PERMISSIONS[role]?.[module] ?? 'none';
}

export const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: 'Dashboard', students: 'Students', staff: 'Staff', fees: 'Fees',
  attendance: 'Attendance', timetable: 'Timetable', academic: 'Academic',
  programs: 'Programs', reports: 'Reports', permissions: 'Permissions',
  settings: 'Settings', profile: 'Profile', leave_requests: 'Leave Requests',
  notifications: 'Notifications',
  communication: 'Communication',
  notices: 'Notice Board',
  ai_assistant: 'AI Assistant',
};

export const ALL_MODULES = Object.keys(MODULE_LABELS) as ModuleKey[];
