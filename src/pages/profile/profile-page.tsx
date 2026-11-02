import { useState, useRef } from 'react';
import { useAuth } from '@/context/auth-context';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { User, Mail, Phone, Lock, Save, Camera, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ROLE_LABELS } from '@/constants';
import { initials } from '@/lib/utils';
import { toast } from 'sonner';

const profileSchema = z.object({
  full_name: z.string().min(2, 'Required'),
  phone: z.string().optional(),
});
const pwdSchema = z.object({
  current: z.string().min(6, 'Min 6 characters'),
  next: z.string().min(6, 'Min 6 characters'),
  confirm: z.string().min(6, 'Min 6 characters'),
}).refine((d) => d.next === d.confirm, { message: 'Passwords do not match', path: ['confirm'] });

export function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const profileForm = useForm({ resolver: zodResolver(profileSchema), defaultValues: { full_name: profile?.full_name || '', phone: profile?.phone || '' } });
  const pwdForm = useForm({ resolver: zodResolver(pwdSchema), defaultValues: { current: '', next: '', confirm: '' } });

  const saveProfile = async (d: { full_name: string; phone?: string }) => {
    setSavingProfile(true);
    const { error } = await supabase.from('profiles').update({ full_name: d.full_name, phone: d.phone }).eq('id', profile!.id);
    setSavingProfile(false);
    if (error) return toast.error(error.message);
    await refreshProfile();
    toast.success('Profile updated');
  };

  const changePwd = async (d: { current: string; next: string }) => {
    setSavingPwd(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: profile!.email, password: d.current });
    if (signInError) { setSavingPwd(false); return toast.error('Current password is incorrect'); }
    const { error } = await supabase.auth.updateUser({ password: d.next });
    setSavingPwd(false);
    if (error) return toast.error(error.message);
    toast.success('Password changed');
    pwdForm.reset();
  };

  const uploadPhoto = async (file: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error('Image must be under 2MB');
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${profile!.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      const { error: dbErr } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profile!.id);
      if (dbErr) throw dbErr;
      await refreshProfile();
      toast.success('Photo updated');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async () => {
    setUploading(true);
    try {
      await supabase.from('profiles').update({ avatar_url: null }).eq('id', profile!.id);
      await refreshProfile();
      toast.success('Photo removed');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  if (!profile) return null;

  return (
    <div>
      <PageHeader title="My Profile" description="Manage your account and security" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="flex flex-col items-center p-6 text-center">
              <div className="relative">
                <Avatar className="h-24 w-24 border-4 border-primary/10">
                  {profile.avatar_url ? (
                    <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-2xl font-bold text-primary">{initials(profile.full_name)}</AvatarFallback>
                </Avatar>
                {uploading ? (
                  <div className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary shadow-lg">
                    <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110"
                    title="Upload photo"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); }} />
              </div>
              <h2 className="mt-4 text-lg font-bold">{profile.full_name}</h2>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
              <span className="mt-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{ROLE_LABELS[profile.role]}</span>
              {profile.avatar_url && (
                <Button variant="ghost" size="sm" className="mt-3 text-destructive" onClick={removePhoto} disabled={uploading}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />Remove Photo
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <div className="lg:col-span-2">
          <Tabs defaultValue="profile">
            <TabsList className="mb-4">
              <TabsTrigger value="profile"><User className="mr-2 h-4 w-4" />Profile</TabsTrigger>
              <TabsTrigger value="password"><Lock className="mr-2 h-4 w-4" />Password</TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <Card>
                <CardHeader><CardTitle className="text-base">Personal Information</CardTitle></CardHeader>
                <CardContent>
                  <form onSubmit={profileForm.handleSubmit(saveProfile)} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div><Label>Full Name</Label><div className="relative mt-1.5"><User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-10" {...profileForm.register('full_name')} /></div>{profileForm.formState.errors.full_name && <p className="text-xs text-destructive">{profileForm.formState.errors.full_name.message}</p>}</div>
                      <div><Label>Email</Label><div className="relative mt-1.5"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-10" value={profile.email} disabled /></div></div>
                      <div><Label>Phone</Label><div className="relative mt-1.5"><Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-10" {...profileForm.register('phone')} /></div></div>
                      <div><Label>Role</Label><Input className="mt-1.5" value={ROLE_LABELS[profile.role]} disabled /></div>
                    </div>
                    <Button type="submit" disabled={savingProfile}><Save className="mr-2 h-4 w-4" />{savingProfile ? 'Saving...' : 'Save Changes'}</Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="password">
              <Card>
                <CardHeader><CardTitle className="text-base">Change Password</CardTitle></CardHeader>
                <CardContent>
                  <form onSubmit={pwdForm.handleSubmit(changePwd)} className="space-y-4">
                    <div><Label>Current Password</Label><Input type="password" className="mt-1.5" {...pwdForm.register('current')} />{pwdForm.formState.errors.current && <p className="text-xs text-destructive">{pwdForm.formState.errors.current.message}</p>}</div>
                    <div><Label>New Password</Label><Input type="password" className="mt-1.5" {...pwdForm.register('next')} />{pwdForm.formState.errors.next && <p className="text-xs text-destructive">{pwdForm.formState.errors.next.message}</p>}</div>
                    <div><Label>Confirm Password</Label><Input type="password" className="mt-1.5" {...pwdForm.register('confirm')} />{pwdForm.formState.errors.confirm && <p className="text-xs text-destructive">{pwdForm.formState.errors.confirm.message}</p>}</div>
                    <Button type="submit" disabled={savingPwd}><Lock className="mr-2 h-4 w-4" />{savingPwd ? 'Updating...' : 'Update Password'}</Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
