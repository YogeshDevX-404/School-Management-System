import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { Toaster } from 'sonner';
import { store } from '@/redux/store';
import { AuthProvider } from '@/context/auth-context';
import { ProtectedRoute } from '@/components/protected-route';
import { AppLayout } from '@/layouts/app-layout';
import { Loader2 } from 'lucide-react';

const LoginPage = lazy(() => import('@/pages/auth/login-page').then(m => ({ default: m.LoginPage })));
const SignupPage = lazy(() => import('@/pages/auth/signup-page').then(m => ({ default: m.SignupPage })));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/forgot-password-page').then(m => ({ default: m.ForgotPasswordPage })));
const DashboardPage = lazy(() => import('@/pages/dashboard/dashboard-page').then(m => ({ default: m.DashboardPage })));
const StudentsPage = lazy(() => import('@/pages/students/students-page').then(m => ({ default: m.StudentsPage })));
const StudentProfilePage = lazy(() => import('@/pages/students/student-profile-page').then(m => ({ default: m.StudentProfilePage })));
const StaffPage = lazy(() => import('@/pages/staff/staff-page').then(m => ({ default: m.StaffPage })));
const FeesPage = lazy(() => import('@/pages/fees/fees-page').then(m => ({ default: m.FeesPage })));
const AttendancePage = lazy(() => import('@/pages/attendance/attendance-page').then(m => ({ default: m.AttendancePage })));
const AcademicPage = lazy(() => import('@/pages/academic/academic-page').then(m => ({ default: m.AcademicPage })));
const ProgramsPage = lazy(() => import('@/pages/programs/programs-page').then(m => ({ default: m.ProgramsPage })));
const ReportsPage = lazy(() => import('@/pages/reports/reports-page').then(m => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import('@/pages/settings/settings-page').then(m => ({ default: m.SettingsPage })));
const ProfilePage = lazy(() => import('@/pages/profile/profile-page').then(m => ({ default: m.ProfilePage })));
const PermissionsPage = lazy(() => import('@/pages/permissions/permissions-page').then(m => ({ default: m.PermissionsPage })));
const TimetablePage = lazy(() => import('@/pages/timetable/timetable-page').then(m => ({ default: m.TimetablePage })));
const LeaveRequestsPage = lazy(() => import('@/pages/leave-requests/leave-requests-page').then(m => ({ default: m.LeaveRequestsPage })));
const TeacherAssignmentsPage = lazy(() => import('@/pages/teacher-assignments/teacher-assignments-page').then(m => ({ default: m.TeacherAssignmentsPage })));
const CommunicationPage = lazy(() => import('@/pages/communication/communication-page').then(m => ({ default: m.CommunicationPage })));
const NoticeBoardPage = lazy(() => import('@/pages/notices/notice-board-page').then(m => ({ default: m.NoticeBoardPage })));
const AIAssistantPage = lazy(() => import('@/pages/ai-assistant/ai-assistant-page').then(m => ({ default: m.AIAssistantPage })));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

function PageLoader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
    </div>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
                <Route path="/auth/login" element={<LoginPage />} />
                <Route path="/auth/signup" element={<SignupPage />} />
                <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />

                <Route element={<ProtectedRoute />}>
                  <Route path="/app" element={<AppLayout />}>
                    <Route path="dashboard" element={<ProtectedRoute module="dashboard"><DashboardPage /></ProtectedRoute>} />
                    <Route path="students" element={<ProtectedRoute module="students"><StudentsPage /></ProtectedRoute>} />
                    <Route path="students/:id" element={<ProtectedRoute module="students"><StudentProfilePage /></ProtectedRoute>} />
                    <Route path="staff" element={<ProtectedRoute module="staff"><StaffPage /></ProtectedRoute>} />
                    <Route path="fees" element={<ProtectedRoute module="fees"><FeesPage /></ProtectedRoute>} />
                    <Route path="attendance" element={<ProtectedRoute module="attendance"><AttendancePage /></ProtectedRoute>} />
                    <Route path="timetable" element={<ProtectedRoute module="timetable"><TimetablePage /></ProtectedRoute>} />
                    <Route path="leave-requests" element={<ProtectedRoute module="leave_requests"><LeaveRequestsPage /></ProtectedRoute>} />
                    <Route path="teacher-assignments" element={<ProtectedRoute module="staff"><TeacherAssignmentsPage /></ProtectedRoute>} />
                    <Route path="communication" element={<ProtectedRoute module="communication"><CommunicationPage /></ProtectedRoute>} />
                    <Route path="notices" element={<ProtectedRoute module="notices"><NoticeBoardPage /></ProtectedRoute>} />
                    <Route path="ai-assistant" element={<ProtectedRoute module="ai_assistant"><AIAssistantPage /></ProtectedRoute>} />
                    <Route path="academic" element={<ProtectedRoute module="academic"><AcademicPage /></ProtectedRoute>} />
                    <Route path="programs" element={<ProtectedRoute module="programs"><ProgramsPage /></ProtectedRoute>} />
                    <Route path="reports" element={<ProtectedRoute module="reports"><ReportsPage /></ProtectedRoute>} />
                    <Route path="permissions" element={<ProtectedRoute module="permissions"><PermissionsPage /></ProtectedRoute>} />
                    <Route path="settings" element={<ProtectedRoute module="settings"><SettingsPage /></ProtectedRoute>} />
                    <Route path="profile" element={<ProtectedRoute module="profile"><ProfilePage /></ProtectedRoute>} />
                  </Route>
                </Route>

                <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
              </Routes>
            </Suspense>
            <Toaster richColors position="top-right" />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </Provider>
  );
}
