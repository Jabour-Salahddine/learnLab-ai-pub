import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, Outlet } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { NotificationProvider } from "@/context/NotificationContext";
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import RegisterTeacherPage from "@/pages/auth/RegisterTeacherPage";
import StudentDashboard from "@/pages/student/StudentDashboard";
import TPSelectionPage from "@/pages/student/TPSelectionPage";
import TPSessionPage from "@/pages/student/TPSessionPage";
import ResultPage from "@/pages/student/ResultPage";
import StudentProfile from "@/pages/student/StudentProfile";
import StudentHistory from "@/pages/student/StudentHistory";
import StudentSettings from "@/pages/student/StudentSettings";
import StudentResources from "@/pages/student/StudentResources";
import TeacherDashboard from "@/pages/teacher/TeacherDashboard";
import StudentManagement from "@/pages/teacher/StudentManagement";
import TPManagement from "@/pages/teacher/TPManagement";
import TPMonitor from "@/pages/teacher/TPMonitor";
import RAGManagement from "@/pages/teacher/RAGManagement";
import TeacherProfile from "@/pages/teacher/TeacherProfile";
import TeacherReports from "@/pages/teacher/TeacherReports";
import TeacherSettings from "@/pages/teacher/TeacherSettings";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

/** Redirect already-authenticated users away from public pages */
const PublicRoute = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (user) {
    return <Navigate to={user.role === "teacher" ? "/teacher/dashboard" : "/student/dashboard"} replace />;
  }
  return <Outlet />;
};

/** Allow only authenticated users with the correct role */
const ProtectedRoute = ({ allowedRole }: { allowedRole: "student" | "teacher" }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== allowedRole) {
    return <Navigate to={user.role === "teacher" ? "/teacher/dashboard" : "/student/dashboard"} replace />;
  }
  return <Outlet />;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Navigate to="/login" replace />} />

    {/* Public routes — redirect to dashboard if already logged in */}
    <Route element={<PublicRoute />}>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/register/teacher" element={<RegisterTeacherPage />} />
    </Route>

    {/* Student routes */}
    <Route element={<ProtectedRoute allowedRole="student" />}>
      <Route path="/student/dashboard" element={<StudentDashboard />} />
      <Route path="/student/tps" element={<TPSelectionPage />} />
      <Route path="/student/session/:id" element={<TPSessionPage />} />
      <Route path="/student/result/:id" element={<ResultPage />} />
      <Route path="/student/profile" element={<StudentProfile />} />
      <Route path="/student/history" element={<StudentHistory />} />
      <Route path="/student/settings" element={<StudentSettings />} />
      <Route path="/student/resources" element={<StudentResources />} />
    </Route>

    {/* Teacher routes */}
    <Route element={<ProtectedRoute allowedRole="teacher" />}>
      <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
      <Route path="/teacher/students" element={<StudentManagement />} />
      <Route path="/teacher/tps" element={<TPManagement />} />
      <Route path="/teacher/tp-monitor" element={<TPMonitor />} />
      <Route path="/teacher/rag" element={<RAGManagement />} />
      <Route path="/teacher/profile" element={<TeacherProfile />} />
      <Route path="/teacher/reports" element={<TeacherReports />} />
      <Route path="/teacher/settings" element={<TeacherSettings />} />
    </Route>

    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <NotificationProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </NotificationProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
