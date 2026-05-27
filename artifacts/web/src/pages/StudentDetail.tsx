import { useLocation, useParams } from "wouter";
import {
  useGetStudent,
  useGetStudentEvents,
} from "@workspace/api-client-react";
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
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";

export default function StudentDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const id = parseInt(params.id || "0", 10);

  const { data: student, isLoading: studentLoading } = useGetStudent(id, {
    query: {
      enabled: !!id,
      queryKey: ["getStudent", id],
    },
  });

  const { data: events, isLoading: eventsLoading } = useGetStudentEvents(
    id,
    undefined,
    {
      query: {
        enabled: !!id,
        queryKey: ["studentEvents", id],
      },
    },
  );

  // Note: API doesn't seem to have a specific hook that strictly filters events by student ID perfectly based on standard spec, but let's assume it returns related.
  // We'll rely on the backend to scope the events for the student, or we could manually filter if needed. Let's assume the backend filters if we provide no specific filter but we might need to filter manually if the hook doesn't.
  // Actually, useGetStudent returning StudentDetail includes recentEvents. We can use that.

  if (studentLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!student) {
    return <div>Student not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/students")}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{student.name}</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Student Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Admission No
                </div>
                <div className="text-base font-semibold">
                  {student.admissionNo}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Class & Section
                </div>
                <div className="text-base font-semibold">
                  {student.className} {student.sectionName}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Roll No
                </div>
                <div className="text-base font-semibold">
                  {student.rollNo || "-"}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  House
                </div>
                <div className="text-base font-semibold">
                  {student.houseName || "-"}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Father's Name
                </div>
                <div className="text-base font-semibold">
                  {student.fatherName || "-"}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Mother's Name
                </div>
                <div className="text-base font-semibold">
                  {student.motherName || "-"}
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-sm font-medium text-muted-foreground">
                  Parent Contact
                </div>
                <div className="text-base font-semibold">
                  {student.parentContact || "-"}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Status
                </div>
                <Badge
                  variant={
                    student.status === "Active" ? "default" : "secondary"
                  }
                >
                  {student.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Events</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {student.recentEvents?.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>
                    {event.logDate
                      ? new Date(event.logDate).toLocaleDateString()
                      : "-"}
                  </TableCell>
                  <TableCell>{event.eventType}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        event.severity === "High" ? "destructive" : "secondary"
                      }
                    >
                      {event.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>{event.teacherName}</TableCell>
                  <TableCell
                    className="max-w-[200px] truncate"
                    title={event.remarks || ""}
                  >
                    {event.remarks || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        event.status === "Resolved" ? "default" : "secondary"
                      }
                    >
                      {event.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {(!student.recentEvents || student.recentEvents.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground py-8"
                  >
                    No recent events
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
