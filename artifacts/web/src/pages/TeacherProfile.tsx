import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getTeacherProfile } from "@/lib/kpiApi";

export default function TeacherProfile() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const id = Number(params.id);

  const { data, isLoading, error } = useQuery({
    queryKey: ["teacher-profile", id],
    queryFn: () => getTeacherProfile(id),
    enabled: !!id,
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (error || !data) return <div className="text-destructive">Teacher not found.</div>;
  const t = data.teacher;
  const compliancePercent = data.counts.totalLogs > 0
    ? Math.round((data.counts.verified / data.counts.totalLogs) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Teachers", href: "/admin/teachers" }, { label: t.name }]} />

      <div>
        <h1 className="text-2xl font-bold">{t.name}</h1>
        <p className="text-sm text-muted-foreground">{t.email}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-6">
        {[
          { label: "Assignments", value: data.counts.assignments },
          { label: "Logs total", value: data.counts.totalLogs },
          { label: "Draft", value: data.counts.draft },
          { label: "Pending", value: data.counts.pending },
          { label: "Verified", value: data.counts.verified },
          { label: "Rejected", value: data.counts.rejected, danger: true },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">{c.label}</div>
              <div className={`text-2xl font-bold ${c.danger && c.value > 0 ? "text-destructive" : ""}`}>{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compliance: {compliancePercent}% verified · {data.counts.eventsRecorded} student events recorded</CardTitle>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader><CardTitle>Assignments</CardTitle></CardHeader>
        <CardContent>
          {data.assignments.length === 0 ? <div className="text-muted-foreground text-center py-8">No active assignments.</div> : (
            <Table>
              <TableHeader><TableRow><TableHead>Class</TableHead><TableHead>Section</TableHead><TableHead>Subject</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.assignments.map((a) => (
                  <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setLocation(a.href)}>
                    <TableCell>{a.className}</TableCell>
                    <TableCell>{a.sectionName}</TableCell>
                    <TableCell>{a.subjectName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent logs</CardTitle></CardHeader>
        <CardContent>
          {data.recentLogs.length === 0 ? <div className="text-muted-foreground text-center py-8">No logs submitted yet.</div> : (
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Class</TableHead><TableHead>Section</TableHead><TableHead>Subject</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.recentLogs.map((l) => (
                  <TableRow key={l.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setLocation(l.href)}>
                    <TableCell>{l.date}</TableCell>
                    <TableCell>{l.className}</TableCell>
                    <TableCell>{l.sectionName}</TableCell>
                    <TableCell>{l.subjectName}</TableCell>
                    <TableCell>
                      <Badge variant={l.verificationStatus === "Verified" ? "default" : l.verificationStatus === "Rejected" ? "destructive" : "secondary"}>{l.verificationStatus}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
