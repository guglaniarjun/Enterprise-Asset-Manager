import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getOpsTask,
  getOpsTaskActivity,
  setOpsTaskStatus,
  commentOpsTask,
  escalateOpsTask,
  reassignOpsTask,
  formatHours,
} from "@/lib/operationsApi";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Clock, ArrowUpCircle, MessageSquare, UserPlus, CheckCircle2 } from "lucide-react";

export default function TaskDetail() {
  const [, params] = useRoute("/tasks/:id");
  const id = Number(params?.id);
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [comment, setComment] = useState("");
  const [resolveNotes, setResolveNotes] = useState("");
  const [reassignTo, setReassignTo] = useState("");
  const [escalateTo, setEscalateTo] = useState("");
  const [escalateNotes, setEscalateNotes] = useState("");

  const taskQ = useQuery({ queryKey: ["ops-task", id], queryFn: () => getOpsTask(id), enabled: !!id });
  const actQ = useQuery({ queryKey: ["ops-task-activity", id], queryFn: () => getOpsTaskActivity(id), enabled: !!id });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["ops-task", id] });
    qc.invalidateQueries({ queryKey: ["ops-task-activity", id] });
    qc.invalidateQueries({ queryKey: ["ops-tasks"] });
  };

  const statusMut = useMutation({
    mutationFn: ({ status, notes }: { status: string; notes?: string }) => setOpsTaskStatus(id, status, notes),
    onSuccess: () => { toast({ title: "Status updated" }); invalidate(); },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const commentMut = useMutation({
    mutationFn: (notes: string) => commentOpsTask(id, notes),
    onSuccess: () => { toast({ title: "Comment added" }); setComment(""); invalidate(); },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const reassignMut = useMutation({
    mutationFn: (uid: number) => reassignOpsTask(id, uid),
    onSuccess: () => { toast({ title: "Reassigned" }); setReassignTo(""); invalidate(); },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const escalateMut = useMutation({
    mutationFn: ({ to, notes }: { to?: number; notes?: string }) => escalateOpsTask(id, to, notes),
    onSuccess: () => { toast({ title: "Escalated" }); setEscalateTo(""); setEscalateNotes(""); invalidate(); },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  if (taskQ.isLoading) return <Skeleton className="h-96 w-full" />;
  if (taskQ.error || !taskQ.data) return <div className="text-destructive">Failed to load task.</div>;
  const t = taskQ.data;
  const terminal = ["Done", "Completed", "Cancelled"].includes(t.status);
  const allowed = t.allowedTransitions ?? [];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Tasks", href: "/tasks" }, { label: `#${t.id}` }]} />

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <div className="text-sm text-muted-foreground mt-1">
            {t.module && <span>Module: {t.module} · </span>}
            Created {new Date(t.createdAt).toLocaleString()} by {t.createdByName ?? "—"}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={t.status === "Open" || t.status === "Pending" ? "destructive" : t.status === "In Progress" ? "default" : "secondary"}>{t.status}</Badge>
          <Badge variant={t.priority === "High" ? "destructive" : t.priority === "Medium" ? "default" : "secondary"}>{t.priority}</Badge>
          {t.escalationLevel > 0 && <Badge variant="destructive">Escalated L{t.escalationLevel}</Badge>}
        </div>
      </div>

      {/* SLA banner */}
      {!terminal && (
        <Card className={t.sla.breached ? "border-destructive" : ""}>
          <CardContent className="py-3 flex items-center gap-3">
            {t.sla.breached ? (
              <><AlertTriangle className="h-5 w-5 text-destructive" /><div><div className="font-medium">SLA breached</div><div className="text-sm text-muted-foreground">{formatHours(t.sla.hoursOver)} over · Due {t.sla.dueAt ? new Date(t.sla.dueAt).toLocaleString() : "—"}</div></div></>
            ) : (
              <><Clock className="h-5 w-5 text-muted-foreground" /><div><div className="font-medium">On track</div><div className="text-sm text-muted-foreground">SLA {t.slaHours}h · Due {t.sla.dueAt ? new Date(t.sla.dueAt).toLocaleString() : "—"}</div></div></>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {/* Details */}
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><span className="text-muted-foreground">Description:</span> {t.description ?? <span className="italic">None</span>}</div>
            <div><span className="text-muted-foreground">Assigned to:</span> {t.assignedToName ?? <span className="italic">Unassigned</span>}</div>
            <div><span className="text-muted-foreground">Due date:</span> {t.dueDate ?? "—"}</div>
            <div><span className="text-muted-foreground">Started:</span> {t.startedAt ? new Date(t.startedAt).toLocaleString() : "—"}</div>
            <div><span className="text-muted-foreground">Completed:</span> {t.completedAt ? new Date(t.completedAt).toLocaleString() : "—"}</div>
            {t.relatedEntityType && (
              <div><span className="text-muted-foreground">Source:</span> {t.relatedEntityType} #{t.relatedEntityId}</div>
            )}
            {t.resolutionNotes && (
              <div className="pt-2 border-t">
                <div className="text-xs text-muted-foreground">Resolution notes</div>
                <div className="whitespace-pre-wrap">{t.resolutionNotes}</div>
              </div>
            )}
            {t.escalatedToName && (
              <div className="pt-2 border-t">
                <div className="text-xs text-muted-foreground">Escalated</div>
                <div>To {t.escalatedToName} on {t.escalatedAt ? new Date(t.escalatedAt).toLocaleString() : "—"}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!terminal && (
              <>
                <div className="flex flex-wrap gap-2">
                  {allowed.includes("In Progress") && (
                    <Button size="sm" variant="outline" onClick={() => statusMut.mutate({ status: "In Progress" })} disabled={statusMut.isPending}>Start</Button>
                  )}
                  {allowed.includes("Blocked") && (
                    <Button size="sm" variant="outline" onClick={() => statusMut.mutate({ status: "Blocked" })} disabled={statusMut.isPending}>Block</Button>
                  )}
                  {allowed.includes("Cancelled") && (
                    <Button size="sm" variant="ghost" onClick={() => statusMut.mutate({ status: "Cancelled" })} disabled={statusMut.isPending}>Cancel</Button>
                  )}
                </div>
                <Separator />
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Resolve with notes</div>
                  <Textarea value={resolveNotes} onChange={(e) => setResolveNotes(e.target.value)} placeholder="What was done?" rows={2} />
                  <Button size="sm" className="mt-2 w-full" disabled={statusMut.isPending || !allowed.includes("Done")} onClick={() => statusMut.mutate({ status: "Done", notes: resolveNotes || undefined })}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Mark Done
                  </Button>
                </div>
                <Separator />
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Reassign to user ID</div>
                  <div className="flex gap-2">
                    <Input value={reassignTo} onChange={(e) => setReassignTo(e.target.value)} placeholder="User ID" />
                    <Button size="sm" variant="outline" disabled={reassignMut.isPending || !reassignTo} onClick={() => reassignMut.mutate(Number(reassignTo))}>
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Separator />
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Escalate (optional target user ID)</div>
                  <Input value={escalateTo} onChange={(e) => setEscalateTo(e.target.value)} placeholder="User ID (optional)" />
                  <Textarea className="mt-2" value={escalateNotes} onChange={(e) => setEscalateNotes(e.target.value)} placeholder="Reason for escalation" rows={2} />
                  <Button size="sm" variant="destructive" className="mt-2 w-full" disabled={escalateMut.isPending}
                    onClick={() => escalateMut.mutate({ to: escalateTo ? Number(escalateTo) : undefined, notes: escalateNotes || undefined })}>
                    <ArrowUpCircle className="h-4 w-4 mr-1" /> Escalate
                  </Button>
                </div>
              </>
            )}
            {terminal && (
              <div className="text-sm text-muted-foreground">This task is in a terminal state. No further actions.</div>
            )}
            <Separator />
            <Button size="sm" variant="ghost" className="w-full" onClick={() => setLocation("/tasks")}>← Back to tasks</Button>
          </CardContent>
        </Card>
      </div>

      {/* Activity timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment…" onKeyDown={(e) => { if (e.key === "Enter" && comment.trim()) commentMut.mutate(comment.trim()); }} />
            <Button size="sm" disabled={!comment.trim() || commentMut.isPending} onClick={() => commentMut.mutate(comment.trim())}>Post</Button>
          </div>
          {actQ.isLoading ? <Skeleton className="h-20 w-full" /> : (
            <div className="space-y-3">
              {(actQ.data?.data ?? []).map((a) => (
                <div key={a.id} className="flex gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <div className="flex-1">
                    <div>
                      <span className="font-medium">{a.userName ?? "System"}</span>{" "}
                      <span className="text-muted-foreground">{a.action.replace(/_/g, " ")}</span>
                      {a.fromValue && a.toValue && <span> · <code className="text-xs">{a.fromValue} → {a.toValue}</code></span>}
                    </div>
                    {a.notes && <div className="text-muted-foreground italic">{a.notes}</div>}
                    <div className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))}
              {(actQ.data?.data ?? []).length === 0 && <div className="text-sm text-muted-foreground">No activity yet.</div>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
