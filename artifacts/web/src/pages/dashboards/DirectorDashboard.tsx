import { useGetDirectorDashboard, useGetComplianceAnalytics, useGetDisciplineAnalytics } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";

export default function DirectorDashboard() {
  const today = format(new Date(), "yyyy-MM-dd");
  
  const { data: dashboard, isLoading: isDashboardLoading } = useGetDirectorDashboard({ date: today }, {
    query: {
      queryKey: ["directorDashboard", today]
    }
  });

  const { data: compliance, isLoading: isComplianceLoading } = useGetComplianceAnalytics({
    dateFrom: format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
    dateTo: today
  }, {
    query: { queryKey: ["complianceAnalytics", today] }
  });

  const { data: discipline, isLoading: isDisciplineLoading } = useGetDisciplineAnalytics({
    dateFrom: format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
    dateTo: today
  }, {
    query: { queryKey: ["disciplineAnalytics", today] }
  });

  if (isDashboardLoading) {
    return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Director Command Center</h1>
        <div className="text-sm text-muted-foreground">Today: {format(new Date(), "MMMM d, yyyy")}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Compliance %</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.teacherCompliancePercent || 0}%</div>
            <p className="text-xs text-muted-foreground">{dashboard?.missingLogsToday || 0} missing logs today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Syllabus Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.syllabusCompletionPercent || 0}%</div>
            <p className="text-xs text-muted-foreground">{dashboard?.classesBehindSyllabus || 0} classes behind</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Discipline Cases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.disciplineCasesToday || 0}</div>
            <p className="text-xs text-muted-foreground">{dashboard?.repeatedDisciplineStudents || 0} repeated offenders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Action Required</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{dashboard?.criticalAlerts || 0} Alerts</div>
            <p className="text-xs text-muted-foreground">{dashboard?.openTasks || 0} open tasks</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Compliance by Class</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {isComplianceLoading ? <Skeleton className="w-full h-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={compliance?.byClass || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="className" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="compliancePercent" fill="hsl(var(--primary))" name="Compliance %" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Discipline Issues by Class</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {isDisciplineLoading ? <Skeleton className="w-full h-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={discipline?.byClass || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="className" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--destructive))" name="Cases" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
