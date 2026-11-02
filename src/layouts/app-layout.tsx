import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/layouts/sidebar';
import { Navbar } from '@/layouts/navbar';
import { useTheme } from '@/hooks/use-theme-sync';

export function AppLayout() {
  useTheme();
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto max-w-7xl p-4 lg:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
