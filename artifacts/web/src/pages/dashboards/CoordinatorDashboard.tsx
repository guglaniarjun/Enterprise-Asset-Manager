import { useGetCoordinatorDashboard, useVerifyLog, useRejectLog } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useState, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { getGetCoordinatorDashboardQueryKey } from "@workspace/api-client-react";

export default function CoordinatorDashboard() {
  const today = format(new Date(), "yyyy-MM-dd");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: dashboard, isLoading } = useGetCoordinatorDashboard({ date: today }, {
    query: {
      queryKey: ["coordinatorDashboard", today]
    }
  });

  const verifyLog = useVerifyLog();
  const rejectLog = useRejectLog();

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const [remarks, setRemarks] = useState("");

  const handleVerify = (id: number) => {
    verifyLog.mutate({ id, data: { coordinatorRemarks: "" } }, {
      onSuccess: () => {
        toast({ title: "Log verified" });
        queryClient.invalidateQueries({ queryKey: getGetCoordinatorDashboardQueryKey({ date: today }) });
      },
      onError: (err) => {
        toast({ title: "Failed to verify", variant: "destructive" });
      }
    });
  };

  const handleReject = () => {
    if (!selectedLogId || !remarks) return;
    rejectLog.mutate({ id: selectedLogId, data: { coordinatorRemarks: remarks } }, {
      onSuccess: () => {
        toast({ title: "Log rejected" });
        setRejectModalOpen(false);
        setRemarks("");
        queryClient.invalidateQueries({ queryKey: getGetCoordinatorDashboardQueryKey({ date: today }) });
      },
      onError: (err) => {
        toast({ title: "Failed to reject", variant: "destructive" });
      }
    });
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Verification Queue</h1>
        <div className="text-sm text-muted-foreground">Today: {format(new Date(), "MMMM d, yyyy")}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Pending Verifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.pendingVerifications || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-green-600">Verified Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{dashboard?.verifiedToday || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-destructive">Rejected Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{dashboard?.rejectedToday || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Logs Awaiting Verification</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Teacher</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Topic Taught</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dashboard?.pendingLogs?.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">{log.teacherName}</TableCell>
                  <TableCell>{log.className} {log.sectionName}</TableCell>
                  <TableCell>{log.subjectName}</TableCell>
                  <TableCell>{log.date}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={log.topicTaught || ""}>{log.topicTaught}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="default" size="sm" onClick={() => handleVerify(log.id)} disabled={verifyLog.isPending}>
                      Verify
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => { setSelectedLogId(log.id); setRejectModalOpen(true); }} disabled={rejectLog.isPending}>
                      Reject
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!dashboard?.pendingLogs || dashboard.pendingLogs.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                    No pending logs
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Log</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for Rejection *</label>
              <Textarea 
                value={remarks} 
                onChange={(e) => setRemarks(e.target.value)} 
                placeholder="Please provide details so the teacher can correct the log."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModalOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!remarks || rejectLog.isPending}>Confirm Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
