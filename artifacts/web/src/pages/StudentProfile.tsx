import { useParams, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getStudentProfile } from "@/lib/kpiApi";

export default function StudentProfile() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const id = Number(params.id);

  const { data, isLoading, error } = useQuery({
    queryKey: ["student-profile", id],
    queryFn: () => getStudentProfile(id),
    enabled: !!id,
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (error || !data)
    return <div className="text-destructive">Student not found.</div>;

  const s = data.student;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[{ label: "Students", href: "/students" }, { label: s.name }]}
      />

      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-bold">{s.name}</h1>
        <Badge variant={s.status === "Active" ? "default" : "secondary"}>
          {s.status}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Profile</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>
              <span className="text-muted-foreground">Adm. No:</span>{" "}
              {s.admissionNo}
            </div>
            <div>
              <span className="text-muted-foreground">Roll:</span>{" "}
              {s.rollNo ?? "-"}
            </div>
            <div>
              <span className="text-muted-foreground">Class:</span>{" "}
              {s.classId && s.sectionId ? (
                <Link
                  href={`/classes/${s.classId}/sections/${s.sectionId}`}
                  className="text-primary hover:underline"
                >
                  {s.className} {s.sectionName}
                </Link>
              ) : (
                `${s.className} ${s.sectionName}`
              )}
            </div>
            <div>
              <span className="text-muted-foreground">Father:</span>{" "}
              {s.fatherName ?? "-"}
            </div>
            <div>
              <span className="text-muted-foreground">Mother:</span>{" "}
              {s.motherName ?? "-"}
            </div>
            <div>
              <span className="text-muted-foreground">Contact:</span>{" "}
              {s.parentContact ?? "-"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Event counts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-muted-foreground text-xs">Total</div>
                <div className="text-xl font-bold">{data.counts.total}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Discipline</div>
                <div className="text-xl font-bold text-destructive">
                  {data.counts.discipline}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Inattentive</div>
                <div className="text-xl font-bold">
                  {data.counts.inattentive}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">
                  Achievements
                </div>
                <div className="text-xl font-bold">
                  {data.counts.achievement}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Improvement</div>
                <div className="text-xl font-bold">
                  {data.counts.improvement}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">
                  Follow-up needed
                </div>
                <div className="text-xl font-bold">
                  {data.counts.followUpRequired}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Linked items</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                Alerts ({data.alerts.length})
              </div>
              {data.alerts.length === 0 ? (
                <div className="text-muted-foreground">None</div>
              ) : (
                data.alerts.map((a) => (
                  <div key={a.id} className="text-xs">
                    • {a.title}{" "}
                    <Badge variant="outline" className="ml-1">
                      {a.severity}
                    </Badge>
                  </div>
                ))
              )}
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                Tasks ({data.tasks.length})
              </div>
              {data.tasks.length === 0 ? (
                <div className="text-muted-foreground">None</div>
              ) : (
                data.tasks.map((t) => (
                  <div key={t.id} className="text-xs">
                    • {t.title}{" "}
                    <Badge variant="outline" className="ml-1">
                      {t.status}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event history</CardTitle>
        </CardHeader>
        <CardContent>
          {data.events.length === 0 ? (
            <div className="text-muted-foreground text-center py-8">
              No events recorded.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.events.map((e) => (
                  <TableRow
                    key={e.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setLocation(e.href)}
                  >
                    <TableCell>{e.date ?? "-"}</TableCell>
                    <TableCell>{e.eventType}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          e.severity === "High" ? "destructive" : "secondary"
                        }
                      >
                        {e.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>{e.subjectName}</TableCell>
                    <TableCell>{e.teacherName}</TableCell>
                    <TableCell className="max-w-[260px] truncate">
                      {e.remarks ?? "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          e.status === "Resolved" ? "default" : "secondary"
                        }
                      >
                        {e.status}
                      </Badge>
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
