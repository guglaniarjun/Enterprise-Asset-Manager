import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getClassSectionProfile } from "@/lib/kpiApi";

export default function ClassSectionProfile() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const classId = Number(params.classId);
  const sectionId = Number(params.sectionId);

  const { data, isLoading, error } = useQuery({
    queryKey: ["class-section-profile", classId, sectionId],
    queryFn: () => getClassSectionProfile(classId, sectionId),
    enabled: !!classId && !!sectionId,
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (error || !data) return <div className="text-destructive">Class/section not found.</div>;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: "Classes", href: "/admin/classes" },
        { label: `${data.class.name} ${data.section.name}` },
      ]} />

      <h1 className="text-2xl font-bold">{data.class.name} — Section {data.section.name}</h1>

      <div className="grid gap-3 md:grid-cols-6">
        {[
          { label: "Students", value: data.counts.students },
          { label: "Teachers", value: data.counts.teachers },
          { label: "Logs", value: data.counts.logs },
          { label: "Events", value: data.counts.events },
          { label: "Discipline", value: data.counts.discipline, danger: true },
          { label: "Achievements", value: data.counts.achievements },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">{c.label}</div>
              <div className={`text-2xl font-bold ${c.danger && c.value > 0 ? "text-destructive" : ""}`}>{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Assigned teachers</CardTitle></CardHeader>
          <CardContent>
            {data.assignments.length === 0 ? <div className="text-muted-foreground text-center py-6">None.</div> : (
              <Table>
                <TableHeader><TableRow><TableHead>Teacher</TableHead><TableHead>Subject</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.assignments.map((a) => (
                    <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setLocation(a.href)}>
                      <TableCell>{a.teacherName}</TableCell>
                      <TableCell>{a.subjectName}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Syllabus progress</CardTitle></CardHeader>
          <CardContent>
            {data.syllabusProgress.length === 0 ? <div className="text-muted-foreground text-center py-6">No syllabus entries.</div> : (
              <Table>
                <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Total</TableHead><TableHead>Done</TableHead><TableHead>Delayed</TableHead><TableHead>%</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.syllabusProgress.map((s) => (
                    <TableRow key={s.subjectId}>
                      <TableCell>{s.subjectName}</TableCell>
                      <TableCell>{s.total}</TableCell>
                      <TableCell>{s.completed}</TableCell>
                      <TableCell className={s.delayed > 0 ? "text-destructive" : ""}>{s.delayed}</TableCell>
                      <TableCell><Badge variant={s.percent >= 80 ? "default" : "secondary"}>{s.percent}%</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Students ({data.students.length})</CardTitle></CardHeader>
        <CardContent>
          {data.students.length === 0 ? <div className="text-muted-foreground text-center py-6">No students in this section.</div> : (
            <Table>
              <TableHeader><TableRow><TableHead>Roll</TableHead><TableHead>Adm. No</TableHead><TableHead>Name</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.students.map((s) => (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setLocation(s.href)}>
                    <TableCell>{s.rollNo ?? "-"}</TableCell>
                    <TableCell>{s.admissionNo}</TableCell>
                    <TableCell>{s.name}</TableCell>
                    <TableCell><Badge variant={s.status === "Active" ? "default" : "secondary"}>{s.status}</Badge></TableCell>
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
          {data.recentLogs.length === 0 ? <div className="text-muted-foreground text-center py-6">No logs yet.</div> : (
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Subject</TableHead><TableHead>Teacher</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.recentLogs.map((l) => (
                  <TableRow key={l.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setLocation(l.href)}>
                    <TableCell>{l.date}</TableCell>
                    <TableCell>{l.subjectName}</TableCell>
                    <TableCell>{l.teacherName}</TableCell>
                    <TableCell><Badge variant={l.verificationStatus === "Verified" ? "default" : l.verificationStatus === "Rejected" ? "destructive" : "secondary"}>{l.verificationStatus}</Badge></TableCell>
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
