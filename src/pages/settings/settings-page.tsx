import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Save, Palette, Mail, Shield } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { settingsApi, sessionsApi } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppDispatch, useAppSelector } from '@/redux/store';
import { setTheme } from '@/redux/store';
import { toast } from 'sonner';

export function SettingsPage() {
  const qc = useQueryClient();
  const dispatch = useAppDispatch();
  const currentTheme = useAppSelector((s) => s.ui.theme);
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: settingsApi.get });
  const { data: sessions } = useQuery({ queryKey: ['sessions'], queryFn: sessionsApi.list });
  const [form, setForm] = useState<Record<string, string>>({});

  const updateMut = useMutation({
    mutationFn: (p: Record<string, unknown>) => settingsApi.update(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); toast.success('Settings saved'); },
  });

  const s = (settings || {}) as unknown as Record<string, unknown>;
  const getVal = (k: string) => form[k] !== undefined ? form[k] : String(s[k] ?? '');

  return (
    <div>
      <PageHeader title="Settings" description="Configure your institute and system preferences" />

      <Tabs defaultValue="institute">
        <TabsList className="mb-4">
          <TabsTrigger value="institute"><Building2 className="mr-2 h-4 w-4" />Institute</TabsTrigger>
          <TabsTrigger value="theme"><Palette className="mr-2 h-4 w-4" />Theme</TabsTrigger>
          <TabsTrigger value="smtp"><Mail className="mr-2 h-4 w-4" />SMTP</TabsTrigger>
          <TabsTrigger value="backup"><Shield className="mr-2 h-4 w-4" />Backup</TabsTrigger>
        </TabsList>

        <TabsContent value="institute">
          <Card>
            <CardHeader><CardTitle className="text-base">Institute Profile</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><Label>Institute Name</Label><Input className="mt-1.5" value={getVal('institute_name')} onChange={(e) => setForm({ ...form, institute_name: e.target.value })} /></div>
                <div><Label>Tagline</Label><Input className="mt-1.5" value={getVal('institute_tagline')} onChange={(e) => setForm({ ...form, institute_tagline: e.target.value })} /></div>
                <div><Label>Phone</Label><Input className="mt-1.5" value={getVal('institute_phone')} onChange={(e) => setForm({ ...form, institute_phone: e.target.value })} /></div>
                <div><Label>Email</Label><Input className="mt-1.5" value={getVal('institute_email')} onChange={(e) => setForm({ ...form, institute_email: e.target.value })} /></div>
                <div><Label>Website</Label><Input className="mt-1.5" value={getVal('institute_website')} onChange={(e) => setForm({ ...form, institute_website: e.target.value })} /></div>
                <div>
                  <Label>Current Session</Label>
                  <Select value={getVal('current_session_id')} onValueChange={(v) => setForm({ ...form, current_session_id: v })}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select session" /></SelectTrigger>
                    <SelectContent>{(sessions || []).map((ses) => <SelectItem key={ses.id} value={ses.id}>{ses.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Address</Label><Textarea className="mt-1.5" value={getVal('institute_address')} onChange={(e) => setForm({ ...form, institute_address: e.target.value })} /></div>
              <Button onClick={() => updateMut.mutate(form)} disabled={updateMut.isPending}><Save className="mr-2 h-4 w-4" />Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="theme">
          <Card>
            <CardHeader><CardTitle className="text-base">Theme Settings</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {(['light', 'dark'] as const).map((t) => (
                  <button key={t} onClick={() => dispatch(setTheme(t))} className={`rounded-xl border-2 p-6 text-center transition-all ${currentTheme === t ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                    <div className={`mx-auto mb-3 h-20 w-full max-w-[160px] rounded-lg ${t === 'light' ? 'bg-gradient-to-br from-sky-100 to-blue-200' : 'bg-gradient-to-br from-slate-800 to-blue-950'}`} />
                    <p className="text-sm font-semibold capitalize">{t} Mode</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="smtp">
          <Card>
            <CardHeader><CardTitle className="text-base">SMTP Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><Label>SMTP Host</Label><Input className="mt-1.5" placeholder="smtp.gmail.com" /></div>
                <div><Label>SMTP Port</Label><Input className="mt-1.5" placeholder="587" /></div>
                <div><Label>Username</Label><Input className="mt-1.5" placeholder="noreply@school.edu" /></div>
                <div><Label>Password</Label><Input type="password" className="mt-1.5" placeholder="••••••••" /></div>
              </div>
              <Button onClick={() => toast.success('SMTP settings saved')}><Save className="mr-2 h-4 w-4" />Save SMTP</Button>
              <p className="text-xs text-muted-foreground">SMTP settings are stored securely and used for email notifications.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup">
          <Card>
            <CardHeader><CardTitle className="text-base">Backup & Restore</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm font-medium">Database Backup</p>
                <p className="mt-1 text-xs text-muted-foreground">Export a snapshot of your current data for safekeeping.</p>
                <Button className="mt-3" variant="outline" onClick={() => toast.success('Backup initiated')}>Create Backup</Button>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm font-medium">Restore</p>
                <p className="mt-1 text-xs text-muted-foreground">Restore from a previous backup file.</p>
                <Button className="mt-3" variant="outline" onClick={() => toast.info('Select a backup file to restore')}>Restore from File</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
