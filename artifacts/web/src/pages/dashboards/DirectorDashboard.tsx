import { useQuery } from "@tanstack/react-query";
import { useGetComplianceAnalytics, useGetDisciplineAnalytics } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { KpiCard } from "@/components/KpiCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getKpiSummary, KPI_LABELS } from "@/lib/kpiApi";

const KPI_GROUPS: Array<{ title: string; keys: string[] }> = [
  { title: "Logs today", keys: ["expected-logs-today", "submitted-logs-today", "missing-logs", "teacher-compliance"] },
  { title: "Syllabus", keys: ["syllabus-completion", "classes-behind-syllabus", "subjects-behind-syllabus"] },
  { title: "Student events", keys: ["discipline-cases-today", "repeated-discipline-students", "repeated-inattentive-students", "achievements-recorded"] },
  { title: "Verification & workflow", keys: ["coordinator-verification-pending", "rejected-logs-pending", "open-tasks", "critical-alerts"] },
];

export default function DirectorDashboard() {
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: summary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ["kpi-summary", today],
    queryFn: () => getKpiSummary(today),
  });

  const { data: compliance, isLoading: isComplianceLoading } = useGetComplianceAnalytics({
    dateFrom: format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
    dateTo: today,
  }, { query: { queryKey: ["complianceAnalytics", today] } });

  const { data: discipline, isLoading: isDisciplineLoading } = useGetDisciplineAnalytics({
    dateFrom: format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
    dateTo: today,
  }, { query: { queryKey: ["disciplineAnalytics", today] } });

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Director" }]} />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Director Command Center</h1>
        <div className="text-sm text-muted-foreground">Today: {format(new Date(), "MMMM d, yyyy")}</div>
      </div>

      {isSummaryLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        KPI_GROUPS.map((group) => (
          <div key={group.title} className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{group.title}</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {group.keys.map((k) => {
                const v = summary?.kpis[k];
                const meta = KPI_LABELS[k];
                return (
                  <KpiCard
                    key={k}
                    title={meta?.title ?? k}
                    value={v?.value ?? 0}
                    suffix={v?.suffix}
                    hint={meta?.description ?? v?.label}
                    href={`/dashboard/kpi/${k}?dateFrom=${today}&dateTo=${today}`}
                    trend={v?.trend}
                  />
                );
              })}
            </div>
          </div>
        ))
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Compliance by Class (7-day)</CardTitle></CardHeader>
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
          <CardHeader><CardTitle>Discipline Issues by Class (30-day)</CardTitle></CardHeader>
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
