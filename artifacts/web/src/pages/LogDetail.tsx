import { useLocation, useParams } from "wouter";
import { useGetLog } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Clock, XCircle } from "lucide-react";

export default function LogDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const id = parseInt(params.id || "0", 10);
  
  const { data: log, isLoading } = useGetLog(id, {
    query: {
      enabled: !!id,
      queryKey: ["getLog", id]
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!log) {
    return <div>Log not found.</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/logs")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Log Details</h1>
        </div>
        <Badge 
          className="px-3 py-1 text-sm"
          variant={
            log.verificationStatus === 'Verified' ? 'default' : 
            log.verificationStatus === 'Rejected' ? 'destructive' : 'secondary'
          }
        >
          {log.verificationStatus === 'Verified' && <CheckCircle2 className="w-4 h-4 mr-2" />}
          {log.verificationStatus === 'Pending' && <Clock className="w-4 h-4 mr-2" />}
          {log.verificationStatus === 'Rejected' && <XCircle className="w-4 h-4 mr-2" />}
          {log.verificationStatus}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Class Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Date</div>
                <div className="text-base font-semibold">{log.date}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Period</div>
                <div className="text-base font-semibold">{log.periodNumber}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Teacher</div>
                <div className="text-base font-semibold">{log.teacherName}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Class & Section</div>
                <div className="text-base font-semibold">{log.className} {log.sectionName}</div>
              </div>
              <div className="col-span-2">
                <div className="text-sm font-medium text-muted-foreground">Subject</div>
                <div className="text-base font-semibold">{log.subjectName}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Academic Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Syllabus Status</div>
                <Badge variant="outline" className="mt-1">{log.syllabusStatus || 'N/A'}</Badge>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Topic Planned</div>
                <div className="text-base">{log.topicPlanned || '-'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Topic Taught</div>
                <div className="text-base font-medium">{log.topicTaught || '-'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Teaching Method</div>
                <div className="text-base">{log.teachingMethod || '-'}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Work Assigned</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-muted-foreground">Homework Given</div>
                <Badge variant={log.homeworkGiven ? "default" : "secondary"}>{log.homeworkGiven ? "Yes" : "No"}</Badge>
              </div>
              {log.homeworkGiven && <div className="mt-2 text-sm bg-muted/50 p-3 rounded-md">{log.homeworkDetails}</div>}
            </div>
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-muted-foreground">Notebook Work</div>
                <Badge variant={log.notebookWorkGiven ? "default" : "secondary"}>{log.notebookWorkGiven ? "Yes" : "No"}</Badge>
              </div>
              {log.notebookWorkGiven && <div className="mt-2 text-sm bg-muted/50 p-3 rounded-md">{log.notebookWorkDetails}</div>}
            </div>
          </CardContent>
        </Card>

        <Card className={log.disciplineIssue ? "border-destructive/50" : ""}>
          <CardHeader>
            <CardTitle className={log.disciplineIssue ? "text-destructive" : ""}>Observations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-muted-foreground">Discipline Issues</div>
                <Badge variant={log.disciplineIssue ? "destructive" : "secondary"}>{log.disciplineIssue ? "Yes" : "No"}</Badge>
              </div>
              {log.disciplineIssue && <div className="mt-2 text-sm bg-destructive/10 text-destructive p-3 rounded-md">{log.disciplineDetails}</div>}
            </div>
            {(log.achievementDetails || log.improvementDetails) && (
              <div className="pt-2 border-t space-y-3">
                {log.achievementDetails && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Achievements</div>
                    <div className="mt-1 text-sm bg-green-500/10 text-green-700 p-2 rounded-md">{log.achievementDetails}</div>
                  </div>
                )}
                {log.improvementDetails && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Needs Improvement</div>
                    <div className="mt-1 text-sm bg-orange-500/10 text-orange-700 p-2 rounded-md">{log.improvementDetails}</div>
                  </div>
                )}
              </div>
            )}
            {log.remarks && (
              <div className="pt-2 border-t">
                <div className="text-sm font-medium text-muted-foreground">General Remarks</div>
                <div className="mt-1 text-sm italic">"{log.remarks}"</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {log.coordinatorRemarks && (
        <Card className="border-orange-500/50 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-orange-700 dark:text-orange-500 text-sm flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Coordinator Feedback
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-orange-800 dark:text-orange-200 font-medium">{log.coordinatorRemarks}</p>
          </CardContent>
        </Card>
      )}

      {log.studentEvents && log.studentEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Student Events</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {log.studentEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">{event.studentName}</TableCell>
                    <TableCell>{event.eventType}</TableCell>
                    <TableCell>
                      <Badge variant={event.severity === 'High' ? 'destructive' : 'secondary'}>
                        {event.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{event.remarks || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Importing lucide icons locally
import { AlertTriangle } from "lucide-react";
