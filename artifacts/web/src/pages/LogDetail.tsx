import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetLog, useVerifyLog, useRejectLog, useSubmitLog } from "@workspace/api-client-react";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle2, Clock, XCircle, AlertTriangle, Pencil, Send } from "lucide-react";

export default function LogDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const id = parseInt(params.id || "0", 10);

  const { data: log, isLoading } = useGetLog(id, {
    query: { enabled: !!id, queryKey: ["getLog", id] },
  });

  const verify = useVerifyLog();
  const reject = useRejectLog();
  const submit = useSubmitLog();

  const [verifyOpen, setVerifyOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [remarks, setRemarks] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["getLog", id] });
    qc.invalidateQueries({ queryKey: ["logsList"] });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!log) return <div>Log not found.</div>;

  const roles = user?.roles.map((r) => r.roleName) ?? [];
  const canVerify = roles.some((r) => ["Coordinator", "Principal", "Director", "Super Admin"].includes(r));
  const isOwner = user?.id === log.teacherId;
  const isPending = log.verificationStatus === "Pending";
  const isRejected = log.verificationStatus === "Rejected";
  const notSubmitted = !log.submittedAt;

  const handleVerify = () => {
    verify.mutate({ id, data: { coordinatorRemarks: remarks || undefined } }, {
      onSuccess: () => {
        toast({ title: "Log verified" });
        setVerifyOpen(false); setRemarks(""); invalidate();
      },
      onError: (err: unknown) => toast({ title: "Verify failed", description: (err as Error).message, variant: "destructive" }),
    });
  };

  const handleReject = () => {
    if (!remarks.trim()) { toast({ title: "Remarks required to reject", variant: "destructive" }); return; }
    reject.mutate({ id, data: { coordinatorRemarks: remarks } }, {
      onSuccess: () => {
        toast({ title: "Log rejected" });
        setRejectOpen(false); setRemarks(""); invalidate();
      },
      onError: (err: unknown) => toast({ title: "Reject failed", description: (err as Error).message, variant: "destructive" }),
    });
  };

  const handleSubmit = () => {
    submit.mutate({ id }, {
      onSuccess: () => { toast({ title: "Log submitted for verification" }); invalidate(); },
      onError: (err: unknown) => toast({ title: "Submit failed", description: (err as Error).message, variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/logs")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Log details</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            className="px-3 py-1 text-sm"
            variant={log.verificationStatus === "Verified" ? "default" : log.verificationStatus === "Rejected" ? "destructive" : "secondary"}
          >
            {log.verificationStatus === "Verified" && <CheckCircle2 className="w-4 h-4 mr-2" />}
            {log.verificationStatus === "Pending" && <Clock className="w-4 h-4 mr-2" />}
            {log.verificationStatus === "Rejected" && <XCircle className="w-4 h-4 mr-2" />}
            {log.verificationStatus}
          </Badge>

          {isOwner && (isRejected || notSubmitted) && (
            <Button variant="outline" size="sm" onClick={() => setLocation(`/logs/${id}/edit`)}>
              <Pencil className="w-4 h-4 mr-2" /> Edit
            </Button>
          )}
          {isOwner && notSubmitted && (
            <Button size="sm" onClick={handleSubmit} disabled={submit.isPending}>
              <Send className="w-4 h-4 mr-2" /> Submit for verification
            </Button>
          )}
          {canVerify && isPending && (
            <>
              <Button size="sm" onClick={() => { setRemarks(""); setVerifyOpen(true); }}>
                <CheckCircle2 className="w-4 h-4 mr-2" /> Verify
              </Button>
              <Button size="sm" variant="destructive" onClick={() => { setRemarks(""); setRejectOpen(true); }}>
                <XCircle className="w-4 h-4 mr-2" /> Reject
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Class information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><div className="text-sm font-medium text-muted-foreground">Date</div><div className="text-base font-semibold">{log.date}</div></div>
              <div><div className="text-sm font-medium text-muted-foreground">Period</div><div className="text-base font-semibold">{log.periodNumber}</div></div>
              <div><div className="text-sm font-medium text-muted-foreground">Teacher</div><div className="text-base font-semibold">{log.teacherName}</div></div>
              <div><div className="text-sm font-medium text-muted-foreground">Class & Section</div><div className="text-base font-semibold">{log.className} {log.sectionName}</div></div>
              <div className="col-span-2"><div className="text-sm font-medium text-muted-foreground">Subject</div><div className="text-base font-semibold">{log.subjectName}</div></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Academic progress</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><div className="text-sm font-medium text-muted-foreground">Syllabus status</div><Badge variant="outline" className="mt-1">{log.syllabusStatus || "N/A"}</Badge></div>
            <div><div className="text-sm font-medium text-muted-foreground">Topic planned</div><div className="text-base">{log.topicPlanned || "-"}</div></div>
            <div><div className="text-sm font-medium text-muted-foreground">Topic taught</div><div className="text-base font-medium">{log.topicTaught || "-"}</div></div>
            <div><div className="text-sm font-medium text-muted-foreground">Teaching method</div><div className="text-base">{log.teachingMethod || "-"}</div></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Work assigned</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-muted-foreground">Homework given</div>
                <Badge variant={log.homeworkGiven ? "default" : "secondary"}>{log.homeworkGiven ? "Yes" : "No"}</Badge>
              </div>
              {log.homeworkGiven && <div className="mt-2 text-sm bg-muted/50 p-3 rounded-md">{log.homeworkDetails}</div>}
            </div>
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-muted-foreground">Notebook work</div>
                <Badge variant={log.notebookWorkGiven ? "default" : "secondary"}>{log.notebookWorkGiven ? "Yes" : "No"}</Badge>
              </div>
              {log.notebookWorkGiven && <div className="mt-2 text-sm bg-muted/50 p-3 rounded-md">{log.notebookWorkDetails}</div>}
            </div>
          </CardContent>
        </Card>

        <Card className={log.disciplineIssue ? "border-destructive/50" : ""}>
          <CardHeader><CardTitle className={log.disciplineIssue ? "text-destructive" : ""}>Observations</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-muted-foreground">Discipline issues</div>
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
                    <div className="text-sm font-medium text-muted-foreground">Needs improvement</div>
                    <div className="mt-1 text-sm bg-orange-500/10 text-orange-700 p-2 rounded-md">{log.improvementDetails}</div>
                  </div>
                )}
              </div>
            )}
            {log.remarks && (
              <div className="pt-2 border-t">
                <div className="text-sm font-medium text-muted-foreground">General remarks</div>
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
              Coordinator feedback
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-orange-800 dark:text-orange-200 font-medium">{log.coordinatorRemarks}</p>
          </CardContent>
        </Card>
      )}

      {log.studentEvents && log.studentEvents.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Student events</CardTitle></CardHeader>
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
                      <Badge variant={event.severity === "High" ? "destructive" : "secondary"}>{event.severity}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{event.remarks || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Verify log</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Optional remarks to send to the teacher.</p>
          <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Looks good…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyOpen(false)}>Cancel</Button>
            <Button onClick={handleVerify} disabled={verify.isPending}>Confirm verify</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject log</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Tell the teacher what needs to be corrected (required).</p>
          <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Please add the topic taught…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={reject.isPending}>Confirm reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
