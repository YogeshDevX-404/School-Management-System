import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  GraduationCap, Users, Wallet, TrendingUp, CalendarPlus,
  UserPlus, AlertCircle, Bell, CalendarClock, Layers, BookOpen, CalendarDays,
  Megaphone,
  type LucideIcon,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { LoadingState } from '@/components/shared/loading-states';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  dashboardApi, paymentsApi, notificationsApi, leaveRequestsApi,
  teacherAssignmentsApi, staffApi, classesApi, sectionsApi, subjectsApi,
  timetableApi,
} from '@/services/api';
import { noticesApi } from '@/services/notices-api';
import { supabase } from '@/lib/supabase';
import { MONTH_NAMES } from '@/constants';
import { formatCurrency, formatDate, initials, cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { useEffect } from 'react';

const CHART_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function DashboardPage() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const { data: stats, isLoading: statsLoading } = useQuery({ queryKey: ['dash-stats'], queryFn: dashboardApi.stats });
  const { data: admissionsTrend } = useQuery({ queryKey: ['admissions-trend'], queryFn: dashboardApi.admissionsTrend });
  const { data: monthlyCollection } = useQuery({ queryKey: ['monthly-collection'], queryFn: paymentsApi.monthlyCollection });
  const { data: recentAdmissions } = useQuery({ queryKey: ['recent-admissions'], queryFn: () => dashboardApi.recentAdmissions(5) });
  const { data: recentPayments } = useQuery({ queryKey: ['recent-payments'], queryFn: () => dashboardApi.recentPayments(5) });
  const { data: activities } = useQuery({ queryKey: ['recent-activities'], queryFn: () => dashboardApi.recentActivities(6) });
  const { data: notifications } = useQuery({ queryKey: ['dashboard-notifications', profile?.id], queryFn: () => notificationsApi.list(profile?.id) });
  const { data: latestNotices } = useQuery({ queryKey: ['latest-notices'], queryFn: () => noticesApi.latest(5) });

  const isTeacher = profile?.role === 'teacher';
  const isAdminOrPrincipal = profile?.role === 'admin' || profile?.role === 'principal' || profile?.role === 'super_admin';

  const { data: pendingLeaves } = useQuery({
    queryKey: ['pending-leaves-count'],
    queryFn: async () => {
      const all = await leaveRequestsApi.list();
      return all.filter((r) => r.status === 'pending');
    },
    enabled: isAdminOrPrincipal,
  });

  const { data: myStaffForAssign } = useQuery({
    queryKey: ['my-staff-for-assign'],
    queryFn: async () => {
      const all = await staffApi.list({ pageSize: 200 });
      return all.data.find((s) => s.user_id === profile?.id || s.email === profile?.email) || null;
    },
    enabled: isTeacher,
  });

  const { data: myAssignments } = useQuery({
    queryKey: ['my-assignments-dashboard'],
    queryFn: async () => {
      if (!myStaffForAssign) return [];
      return teacherAssignmentsApi.list(myStaffForAssign.id);
    },
    enabled: isTeacher && !!myStaffForAssign,
  });

  const { data: classesData } = useQuery({ queryKey: ['classes-dash'], queryFn: classesApi.list, enabled: isTeacher });
  const { data: sectionsData } = useQuery({ queryKey: ['sections-dash'], queryFn: () => sectionsApi.list(), enabled: isTeacher });
  const { data: subjectsData } = useQuery({ queryKey: ['subjects-dash'], queryFn: subjectsApi.list, enabled: isTeacher });

  const { data: todaySchedule } = useQuery({
    queryKey: ['today-schedule-teacher'],
    queryFn: async () => {
      if (!myStaffForAssign) return [];
      return timetableApi.byTeacher(myStaffForAssign.id);
    },
    enabled: isTeacher && !!myStaffForAssign,
  });

  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const todaysClasses = (todaySchedule || []).filter((t) => t.day_of_week.toLowerCase() === todayName);

  // Realtime: refresh latest notices when a new notice is published
  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel('dashboard-notices-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notices' }, () => {
        qc.invalidateQueries({ queryKey: ['latest-notices'] });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notices' }, () => {
        qc.invalidateQueries({ queryKey: ['latest-notices'] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        qc.invalidateQueries({ queryKey: ['dashboard-notifications', profile.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile, qc]);

  if (statsLoading) return <LoadingState label="Loading dashboard..." />;

  const admissionsData = MONTH_NAMES.map((m, i) => ({ month: m, admissions: admissionsTrend?.[i] || 0 }));
  const collectionData = MONTH_NAMES.map((m, i) => ({ month: m, amount: monthlyCollection?.[i] || 0 }));
  const paymentMethodData = [
    { name: 'Cash', value: 45 },
    { name: 'UPI', value: 30 },
    { name: 'Card', value: 15 },
    { name: 'Bank', value: 10 },
  ];

  const statCards: { title: string; value: string | number; icon: LucideIcon; color: 'primary' | 'success' | 'warning' | 'destructive' | 'chart-4' | 'chart-5'; trend?: number; trendLabel?: string }[] = [
    { title: 'Total Students', value: stats?.totalStudents ?? 0, icon: GraduationCap, color: 'primary', trend: 12, trendLabel: 'vs last month' },
    { title: 'Total Staff', value: stats?.totalStaff ?? 0, icon: Users, color: 'chart-4', trend: 3, trendLabel: 'this year' },
    { title: 'Total Teachers', value: stats?.totalTeachers ?? 0, icon: UserPlus, color: 'success' },
    { title: 'Total Admissions', value: stats?.totalAdmissions ?? 0, icon: TrendingUp, color: 'warning', trend: 18, trendLabel: 'this year' },
    { title: "Today's Admission", value: stats?.todayAdmissions ?? 0, icon: CalendarPlus, color: 'chart-5' },
    { title: 'Fee Collection', value: formatCurrency(stats?.totalCollection ?? 0), icon: Wallet, color: 'success', trend: 8, trendLabel: 'this month' },
    { title: 'Pending Fees', value: formatCurrency(stats?.pendingFees ?? 0), icon: AlertCircle, color: 'destructive' },
    { title: 'Monthly Revenue', value: formatCurrency(Object.values(monthlyCollection || {}).reduce((a, b) => a + b, 0)), icon: TrendingUp, color: 'primary', trend: 15 },
  ];

  const assignedClassNames = (myAssignments || []).map((a) => classesData?.find((c) => c.id === a.class_id)?.name).filter(Boolean);
  const assignedSectionNames = (myAssignments || []).map((a) => a.section_id ? sectionsData?.find((s) => s.id === a.section_id)?.name : null).filter(Boolean);
  const assignedSubjectNames = (myAssignments || []).map((a) => a.subject_id ? subjectsData?.find((s) => s.id === a.subject_id)?.name : null).filter(Boolean);

  return (
    <div>
      <PageHeader title="Dashboard" description="Welcome back! Here's what's happening at your school today." />

      {/* Pending Leave Requests alert for admin/principal */}
      {isAdminOrPrincipal && (pendingLeaves?.length ?? 0) > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/15">
                <CalendarClock className="h-5 w-5 text-warning" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{pendingLeaves!.length} Pending Leave Request{pendingLeaves!.length > 1 ? 's' : ''}</p>
                <p className="text-xs text-muted-foreground">Review and approve/reject pending leave requests from teachers.</p>
              </div>
              <Badge className="bg-warning text-white">{pendingLeaves!.length} Pending</Badge>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Teacher assignment summary */}
      {isTeacher && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10"><Layers className="h-5 w-5 text-primary" /></div>
              <div><p className="text-xs text-muted-foreground">Assigned Classes</p><p className="text-lg font-bold">{assignedClassNames.length}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10"><Users className="h-5 w-5 text-success" /></div>
              <div><p className="text-xs text-muted-foreground">Sections</p><p className="text-lg font-bold">{assignedSectionNames.length}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10"><BookOpen className="h-5 w-5 text-warning" /></div>
              <div><p className="text-xs text-muted-foreground">Subjects</p><p className="text-lg font-bold">{assignedSubjectNames.length}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-chart-4/10"><CalendarDays className="h-5 w-5 text-chart-4" /></div>
              <div><p className="text-xs text-muted-foreground">Today's Classes</p><p className="text-lg font-bold">{todaysClasses.length}</p></div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Teacher today's schedule */}
      {isTeacher && (
        <Card className="mb-6">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4" /> Today's Schedule</CardTitle></CardHeader>
          <CardContent>
            {!todaysClasses.length ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No classes scheduled for today.</p>
            ) : (
              <div className="space-y-2">
                {todaysClasses.map((t) => {
                  const cls = classesData?.find((c) => c.id === t.class_id)?.name || '-';
                  const sec = sectionsData?.find((s) => s.id === t.section_id)?.name || '-';
                  const subj = subjectsData?.find((s) => s.id === t.subject_id)?.name || '-';
                  return (
                    <div key={t.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{t.period_number}</div>
                        <div>
                          <p className="text-sm font-medium">{subj}</p>
                          <p className="text-xs text-muted-foreground">{cls} - {sec} {t.room ? `· Room ${t.room}` : ''}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">{t.start_time?.slice(0, 5)} - {t.end_time?.slice(0, 5)}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s, i) => (
          <StatCard key={s.title} {...s} delay={i * 0.05} />
        ))}
      </div>

      {/* Charts */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Admissions Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={admissionsData}>
                <defs>
                  <linearGradient id="admissionsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="admissions" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#admissionsGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fee Collection</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={collectionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="amount" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Student Growth & Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={admissionsData.map((d, i) => ({ ...d, revenue: collectionData[i].amount }))}>
                <defs>
                  <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-4))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--chart-4))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="admissions" name="Admissions" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#admissionsGrad)" />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(var(--chart-4))" strokeWidth={2} fill="url(#growthGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={paymentMethodData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {paymentMethodData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent lists */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">Recent Admissions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(recentAdmissions || []).map((s) => (
              <div key={s.id} className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(`${s.first_name} ${s.last_name}`)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.first_name} {s.last_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.admission_number}</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">{formatDate(s.admission_date, 'dd MMM')}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">Recent Payments</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(recentPayments || []).map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-success/10">
                  <Wallet className="h-4 w-4 text-success" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.receipt_number}</p>
                  <p className="truncate text-xs text-muted-foreground">{formatDate(p.payment_date)}</p>
                </div>
                <span className="text-sm font-semibold text-success">{formatCurrency(p.amount)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4" /> Notifications</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(notifications || []).slice(0, 6).map((n) => (
              <motion.div key={n.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.message}</p>
                </div>
              </motion.div>
            ))}
            {!notifications?.length && <p className="py-4 text-center text-sm text-muted-foreground">No notifications</p>}
          </CardContent>
        </Card>

        {/* Latest Notices widget */}
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Megaphone className="h-4 w-4" /> Latest Notices</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(latestNotices || []).map((n) => (
              <motion.div key={n.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                <div className={cn('mt-0.5 h-2 w-2 shrink-0 rounded-full', n.priority === 'urgent' ? 'bg-destructive' : n.priority === 'high' ? 'bg-orange-500' : n.priority === 'medium' ? 'bg-warning' : 'bg-success')} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight">{n.title}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{n.description}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{n.author_name} · {formatDate(n.publish_date, 'dd MMM')}</p>
                </div>
              </motion.div>
            ))}
            {!latestNotices?.length && <p className="py-4 text-center text-sm text-muted-foreground">No notices yet</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">Recent Activities</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(activities || []).map((a) => (
              <motion.div key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight">{a.description}</p>
                  <p className="text-xs text-muted-foreground">{a.user_name} · {formatDate(a.created_at, 'dd MMM, HH:mm')}</p>
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
