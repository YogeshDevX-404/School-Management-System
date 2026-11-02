import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Download, Users, GraduationCap, Wallet, CalendarCheck } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { studentsApi, staffApi, paymentsApi } from '@/services/api';
import { MONTH_NAMES } from '@/constants';
import { formatCurrency, formatDate, toCSV, downloadFile } from '@/lib/utils';
import { toast } from 'sonner';

const CHART_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function ReportsPage() {
  const { data: students } = useQuery({ queryKey: ['students-all'], queryFn: () => studentsApi.list({ pageSize: 500 }) });
  const { data: staff } = useQuery({ queryKey: ['staff-all'], queryFn: () => staffApi.list({ pageSize: 500 }) });
  const { data: payments } = useQuery({ queryKey: ['payments-all'], queryFn: () => paymentsApi.list({ pageSize: 500 }) });
  const { data: monthlyCollection } = useQuery({ queryKey: ['monthly-collection'], queryFn: paymentsApi.monthlyCollection });

  const admissionsByMonth = MONTH_NAMES.map((m, i) => {
    const count = (students?.data || []).filter((s) => new Date(s.admission_date).getMonth() === i).length;
    return { month: m, admissions: count };
  });
  const collectionByMonth = MONTH_NAMES.map((m, i) => ({ month: m, amount: monthlyCollection?.[i] || 0 }));
  const staffByRole = (['teacher', 'principal', 'accountant', 'receptionist', 'librarian', 'driver', 'security'] as const).map((r) => ({
    name: r.charAt(0).toUpperCase() + r.slice(1),
    count: (staff?.data || []).filter((s) => s.role === r).length,
  }));
  const genderDist = ['male', 'female', 'other'].map((g) => ({
    name: g.charAt(0).toUpperCase() + g.slice(1),
    value: (students?.data || []).filter((s) => s.gender === g).length,
  }));

  const exportReport = (type: string) => {
    let rows: Record<string, unknown>[] = [];
    if (type === 'admission') rows = (students?.data || []).map((s) => ({ AdmissionNo: s.admission_number, Name: `${s.first_name} ${s.last_name}`, Date: formatDate(s.admission_date), Status: s.status }));
    else if (type === 'fee') rows = (payments?.data || []).map((p) => ({ Receipt: p.receipt_number, Date: formatDate(p.payment_date), Amount: p.amount, Method: p.payment_method }));
    else if (type === 'staff') rows = (staff?.data || []).map((s) => ({ EmpNo: s.employee_number, Name: `${s.first_name} ${s.last_name}`, Role: s.role, Salary: s.salary }));
    downloadFile(toCSV(rows), `${type}-report.csv`);
    toast.success('Report exported');
  };

  return (
    <div>
      <PageHeader title="Reports & Analytics" description="Comprehensive insights across all modules" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Students" value={students?.total ?? 0} icon={GraduationCap} color="primary" />
        <StatCard title="Total Staff" value={staff?.total ?? 0} icon={Users} color="chart-4" />
        <StatCard title="Total Revenue" value={formatCurrency((payments?.data || []).reduce((a, p) => a + Number(p.amount), 0))} icon={Wallet} color="success" />
        <StatCard title="Transactions" value={payments?.total ?? 0} icon={CalendarCheck} color="warning" />
      </div>

      <Tabs defaultValue="admission">
        <TabsList className="mb-4">
          <TabsTrigger value="admission">Admission</TabsTrigger>
          <TabsTrigger value="fee">Fee Collection</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="student">Student</TabsTrigger>
        </TabsList>

        <TabsContent value="admission">
          <Card className="mb-4">
            <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base">Admission Report</CardTitle><Button variant="outline" size="sm" onClick={() => exportReport('admission')}><Download className="mr-2 h-4 w-4" />Export CSV</Button></div></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={admissionsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="admissions" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fee">
          <Card className="mb-4">
            <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base">Fee Collection Report</CardTitle><Button variant="outline" size="sm" onClick={() => exportReport('fee')}><Download className="mr-2 h-4 w-4" />Export CSV</Button></div></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={collectionByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => formatCurrency(v)} />
                  <Line type="monotone" dataKey="amount" stroke="hsl(var(--chart-2))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base">Staff by Role</CardTitle><Button variant="outline" size="sm" onClick={() => exportReport('staff')}><Download className="mr-2 h-4 w-4" />Export</Button></div></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={staffByRole} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" width={80} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="count" fill="hsl(var(--chart-4))" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Staff Summary</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Role</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {staffByRole.map((r) => <TableRow key={r.name}><TableCell className="capitalize">{r.name}</TableCell><TableCell className="text-right font-semibold">{r.count}</TableCell></TableRow>)}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="student">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Gender Distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={genderDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                      {genderDist.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Student Growth</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={admissionsByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="admissions" stroke="hsl(var(--chart-5))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
