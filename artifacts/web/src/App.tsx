import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppShell } from "./components/AppShell";
import { setAuthTokenGetter } from "@workspace/api-client-react";

import NotFound from "@/pages/not-found";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";

import DirectorDashboard from "./pages/dashboards/DirectorDashboard";
import PrincipalDashboard from "./pages/dashboards/PrincipalDashboard";
import CoordinatorDashboard from "./pages/dashboards/CoordinatorDashboard";
import TeacherDashboard from "./pages/dashboards/TeacherDashboard";

import LogsList from "./pages/LogsList";
import LogDetail from "./pages/LogDetail";
import SubmitLog from "./pages/SubmitLog";
import MissingLogs from "./pages/MissingLogs";
import Compliance from "./pages/Compliance";
import StudentsList from "./pages/StudentsList";
import StudentDetail from "./pages/StudentDetail";
import TasksList from "./pages/TasksList";
import AlertsList from "./pages/AlertsList";
import Syllabus from "./pages/Syllabus";
import SyllabusForm from "./pages/SyllabusForm";
import SyllabusSummary from "./pages/SyllabusSummary";
import EventsList from "./pages/EventsList";
import NotificationsList from "./pages/NotificationsList";
import UsersList from "./pages/admin/UsersList";
import StudentImport from "./pages/admin/StudentImport";
import ClassesList from "./pages/admin/ClassesList";
import SubjectsList from "./pages/admin/SubjectsList";
import TeacherAssignments from "./pages/admin/TeacherAssignments";
import HousesList from "./pages/admin/HousesList";
import AuditLogs from "./pages/AuditLogs";

const queryClient = new QueryClient();

// Configure the axios interceptor
setAuthTokenGetter(() => localStorage.getItem("springfield_token"));

function RootRedirect() {
  const { user } = useAuth();
  if (!user) return <Redirect to="/login" />;
  const role = user.roles[0]?.roleName?.toLowerCase().replace(" ", "-") || "director";
  
  if (role === "super-admin" || role === "director") return <Redirect to={`/dashboard/director`} />;
  return <Redirect to={`/dashboard/${role}`} />;
}

function AuthenticatedApp() {
  return (
    <AppShell>
      <Switch>
        <Route path="/" component={RootRedirect} />
        <Route path="/dashboard/director" component={DirectorDashboard} />
        <Route path="/dashboard/principal" component={PrincipalDashboard} />
        <Route path="/dashboard/coordinator" component={CoordinatorDashboard} />
        <Route path="/dashboard/teacher" component={TeacherDashboard} />
        
        <Route path="/logs/submit" component={SubmitLog} />
        <Route path="/logs/missing" component={MissingLogs} />
        <Route path="/logs/compliance" component={Compliance} />
        <Route path="/logs/:id/edit" component={SubmitLog} />
        <Route path="/logs/:id" component={LogDetail} />
        <Route path="/logs" component={LogsList} />
        
        <Route path="/students/:id" component={StudentDetail} />
        <Route path="/students" component={StudentsList} />
        
        <Route path="/tasks" component={TasksList} />
        <Route path="/alerts" component={AlertsList} />
        <Route path="/syllabus/new" component={SyllabusForm} />
        <Route path="/syllabus/summary" component={SyllabusSummary} />
        <Route path="/syllabus/:id/edit" component={SyllabusForm} />
        <Route path="/syllabus" component={Syllabus} />
        <Route path="/events" component={EventsList} />
        <Route path="/notifications" component={NotificationsList} />
        
        <Route path="/admin/students/import" component={StudentImport} />
        <Route path="/admin/users" component={UsersList} />
        <Route path="/admin/classes" component={ClassesList} />
        <Route path="/admin/subjects" component={SubjectsList} />
        <Route path="/admin/teachers" component={TeacherAssignments} />
        <Route path="/admin/houses" component={HousesList} />
        <Route path="/audit-logs" component={AuditLogs} />
        
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/change-password" component={ChangePassword} />
      <Route path="/.*">
        <ProtectedRoute>
          <AuthenticatedApp />
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
