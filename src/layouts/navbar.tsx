import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Menu, Search, Bell, Sun, Moon, LogOut, ChevronDown, PanelLeftClose, PanelLeft, CheckCheck } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/redux/store';
import { toggleSidebar, setMobileSidebar, toggleTheme } from '@/redux/store';
import { useAuth } from '@/context/auth-context';
import { ROLE_LABELS } from '@/constants';
import { notificationsApi } from '@/services/api';
import { formatDate } from '@/lib/utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function Navbar() {
  const dispatch = useAppDispatch();
  const collapsed = useAppSelector((s) => s.ui.sidebarCollapsed);
  const theme = useAppSelector((s) => s.ui.theme);
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [notifOpen, setNotifOpen] = useState(false);

  const { data: notifications } = useQuery({
    queryKey: ['navbar-notifications', profile?.id],
    queryFn: () => notificationsApi.list(profile?.id),
    refetchInterval: 15_000,
  });

  const unreadCount = (notifications || []).filter((n) => !n.is_read).length;

  const markAllReadMut = useMutation({
    mutationFn: () => notificationsApi.markAllRead(profile!.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['navbar-notifications'] }),
  });

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => dispatch(setMobileSidebar(true))}
      >
        <Menu className="h-5 w-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="hidden lg:flex"
        onClick={() => dispatch(toggleSidebar())}
      >
        {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
      </Button>

      {/* Search */}
      <div className="relative hidden flex-1 max-w-md md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search students, staff, receipts..."
          className="h-9 border-border/60 bg-muted/50 pl-9"
        />
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Button variant="ghost" size="icon" onClick={() => dispatch(toggleTheme())} title="Toggle theme">
          {theme === 'light' ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
        </Button>

        {/* Notifications */}
        <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-[18px] w-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white ring-2 ring-background">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              Notifications
              {unreadCount > 0 && <Badge variant="secondary" className="text-[10px]">{unreadCount} new</Badge>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {unreadCount > 0 && (
              <DropdownMenuItem
                className="flex items-center gap-2 text-xs text-primary"
                onClick={() => markAllReadMut.mutate()}
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all as read
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {!notifications?.length ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No notifications</div>
            ) : (
              notifications.slice(0, 10).map((n) => (
                <DropdownMenuItem key={n.id} className={cn('flex flex-col items-start gap-0.5 py-2.5', !n.is_read && 'bg-primary/5')}>
                  <div className="flex w-full items-center justify-between">
                    <span className="text-sm font-medium">{n.title}</span>
                    <span className="text-[10px] text-muted-foreground">{formatDate(n.created_at, 'dd MMM, HH:mm')}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{n.message}</span>
                  {n.priority && n.priority !== 'low' && (
                    <Badge className={cn('mt-1 text-[9px]', n.priority === 'high' ? 'bg-destructive text-white' : 'bg-warning text-white')}>{n.priority}</Badge>
                  )}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-accent">
              <Avatar className="h-8 w-8 border border-border">
                {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.full_name} />}
                <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
                  {profile?.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('') || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left sm:block">
                <p className="text-xs font-semibold leading-tight">{profile?.full_name}</p>
                <p className="text-[10px] text-muted-foreground">{profile ? ROLE_LABELS[profile.role] : ''}</p>
              </div>
              <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div>
                <p className="text-sm font-semibold">{profile?.full_name}</p>
                <p className="text-xs text-muted-foreground">{profile?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/app/profile')}>
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/app/settings')}>
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => signOut()}
            >
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
