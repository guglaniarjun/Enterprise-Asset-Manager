import { useGetPrincipalDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export default function PrincipalDashboard() {
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: dashboard, isLoading } = useGetPrincipalDashboard(
    { date: today },
    {
      query: {
        queryKey: ["principalDashboard", today],
      },
    },
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          Principal Exception Monitor
        </h1>
        <div className="text-sm text-muted-foreground">
          Today: {format(new Date(), "MMMM d, yyyy")}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-destructive/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-destructive">
              Rejected Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboard?.rejectedLogs || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Require teacher resubmission
            </p>
          </CardContent>
        </Card>

        <Card className="border-destructive/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-destructive">
              Missing Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboard?.missingLogs || 0}
            </div>
            <p className="text-xs text-muted-foreground">Not submitted today</p>
          </CardContent>
        </Card>

        <Card className="border-destructive/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-destructive">
              Non-Compliant Teachers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboard?.repeatedNonComplianceTeachers || 0}
            </div>
            <p className="text-xs text-muted-foreground">Repeated offenders</p>
          </CardContent>
        </Card>

        <Card className="border-orange-500/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-orange-600">
              Syllabus Delays
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboard?.syllabusDelayedSubjects || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Subjects falling behind
            </p>
          </CardContent>
        </Card>

        <Card className="border-destructive/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-destructive">
              Serious Discipline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboard?.seriousDisciplineIssues || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Issues reported today
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-primary">
              Pending Verifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboard?.coordinatorPendingVerifications || 0}
            </div>
            <p className="text-xs text-muted-foreground">With coordinators</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
