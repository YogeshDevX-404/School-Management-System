import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Users, GraduationCap, Wallet, CalendarCheck,
  BookOpen, CalendarDays, FileBarChart, Settings, UserCircle,
  Building2, ShieldCheck, CalendarClock, Layers, MessageSquare, Megaphone, Bot, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppSelector, useAppDispatch } from '@/redux/store';
import { setMobileSidebar } from '@/redux/store';
import { useAuth } from '@/context/auth-context';
import { ROLE_LABELS } from '@/constants';
import { canAccess, type ModuleKey } from '@/lib/permissions';

interface NavItem {
  label: string;
  icon: LucideIcon;
  to: string;
  module: ModuleKey;
}

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Main',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, to: '/app/dashboard', module: 'dashboard' },
    ],
  },
  {
    title: 'Management',
    items: [
      { label: 'Students', icon: GraduationCap, to: '/app/students', module: 'students' },
      { label: 'Staff', icon: Users, to: '/app/staff', module: 'staff' },
      { label: 'Fees', icon: Wallet, to: '/app/fees', module: 'fees' },
      { label: 'Attendance', icon: CalendarCheck, to: '/app/attendance', module: 'attendance' },
      { label: 'Timetable', icon: CalendarDays, to: '/app/timetable', module: 'timetable' },
      { label: 'Leave Requests', icon: CalendarClock, to: '/app/leave-requests', module: 'leave_requests' },
      { label: 'Teacher Assignments', icon: Layers, to: '/app/teacher-assignments', module: 'staff' },
      { label: 'Communication', icon: MessageSquare, to: '/app/communication', module: 'communication' },
      { label: 'Notice Board', icon: Megaphone, to: '/app/notices', module: 'notices' },
      { label: 'AI Assistant', icon: Bot, to: '/app/ai-assistant', module: 'ai_assistant' },
    ],
  },
  {
    title: 'Academic',
    items: [
      { label: 'Academic', icon: BookOpen, to: '/app/academic', module: 'academic' },
      { label: 'Programs', icon: Building2, to: '/app/programs', module: 'programs' },
    ],
  },
  {
    title: 'Insights',
    items: [
      { label: 'Reports', icon: FileBarChart, to: '/app/reports', module: 'reports' },
      { label: 'Permissions', icon: ShieldCheck, to: '/app/permissions', module: 'permissions' },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Settings', icon: Settings, to: '/app/settings', module: 'settings' },
      { label: 'Profile', icon: UserCircle, to: '/app/profile', module: 'profile' },
    ],
  },
];

export function Sidebar() {
  const collapsed = useAppSelector((s) => s.ui.sidebarCollapsed);
  const mobileOpen = useAppSelector((s) => s.ui.mobileSidebarOpen);
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { profile } = useAuth();
  const role = profile?.role;

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => dispatch(setMobileSidebar(false))} />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-sidebar transition-all duration-300 lg:static lg:translate-x-0',
          collapsed ? 'w-[72px]' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-border px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl gradient-primary text-white shadow-lg">
            <GraduationCap className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="truncate text-sm font-bold leading-tight">Scholar ERP</p>
              <p className="truncate text-[10px] text-muted-foreground">School Management</p>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 py-4">
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter((i) => canAccess(role, i.module));
            if (!items.length) return null;
            return (
              <div key={group.title} className="mb-5">
                {!collapsed && (
                  <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{group.title}</p>
                )}
                <div className="space-y-1">
                  {items.map((item) => {
                    const active = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => dispatch(setMobileSidebar(false))}
                        className={cn(
                          'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                          active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                          collapsed && 'justify-center'
                        )}
                        title={collapsed ? item.label : undefined}
                      >
                        {active && <motion.div layoutId="sidebar-active" className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-primary" />}
                        <item.icon className={cn('h-[18px] w-[18px] shrink-0', active && 'text-primary')} />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {!collapsed && profile && (
          <div className="border-t border-border p-3">
            <div className="flex items-center gap-3 rounded-lg bg-accent/50 p-2.5">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {profile.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{profile.full_name}</p>
                <p className="truncate text-[10px] text-muted-foreground">{ROLE_LABELS[profile.role]}</p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
