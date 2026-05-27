import { useGetTeacherDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function TeacherDashboard() {
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: dashboard, isLoading } = useGetTeacherDashboard(
    { date: today },
    {
      query: {
        queryKey: ["teacherDashboard", today],
      },
    },
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">My Dashboard</h1>
        <div className="text-sm text-muted-foreground">
          Today: {format(new Date(), "MMMM d, yyyy")}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">
              My Assignments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboard?.myAssignments || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Logs Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboard?.myLogsToday || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-orange-600">
              Pending Verification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboard?.myUnverifiedLogs || 0}
            </div>
          </CardContent>
        </Card>
        <Card className="border-destructive/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-destructive">
              Rejected Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {dashboard?.myRejectedLogs || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Classes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Academic Year</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dashboard?.assignments?.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell className="font-medium">
                    {assignment.className}
                  </TableCell>
                  <TableCell>{assignment.sectionName}</TableCell>
                  <TableCell>{assignment.subjectName}</TableCell>
                  <TableCell>{assignment.academicYear}</TableCell>
                </TableRow>
              ))}
              {(!dashboard?.assignments ||
                dashboard.assignments.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground py-4"
                  >
                    No classes assigned
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
