import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listFollowUps, createFollowUp, updateFollowUp } from "@/lib/operationsApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, CalendarClock, AlertTriangle } from "lucide-react";

const TABS = ["Pending", "Overdue", "Done", "Skipped"];

export default function FollowUpsList() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState("Pending");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", notes: "", studentId: "", scheduledFor: "", assignedTo: "" });

  const query = useQuery({
    queryKey: ["follow-ups", tab],
    queryFn: () => listFollowUps(tab === "Overdue" ? { status: "Pending" } : { status: tab }),
  });

  const all = query.data?.data ?? [];
  const rows = tab === "Overdue" ? all.filter((r) => r.overdue) : all;

  const create = useMutation({
    mutationFn: () => createFollowUp({
      title: form.title,
      notes: form.notes || undefined,
      studentId: form.studentId ? Number(form.studentId) : undefined,
      scheduledFor: new Date(form.scheduledFor).toISOString(),
      assignedTo: form.assignedTo ? Number(form.assignedTo) : undefined,
    }),
    onSuccess: () => {
      toast({ title: "Follow-up scheduled" });
      setShowForm(false);
      setForm({ title: "", notes: "", studentId: "", scheduledFor: "", assignedTo: "" });
      qc.invalidateQueries({ queryKey: ["follow-ups"] });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const complete = useMutation({
    mutationFn: ({ id, status, outcome }: { id: number; status: string; outcome?: string }) =>
      updateFollowUp(id, { status, outcome }),
    onSuccess: () => { toast({ title: "Updated" }); qc.invalidateQueries({ queryKey: ["follow-ups"] }); },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Follow-ups</h1>
          <p className="text-sm text-muted-foreground">Scheduled action items tied to students, alerts and events.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}><CalendarClock className="h-4 w-4 mr-1" />New follow-up</Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Schedule a follow-up</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Title</label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Call parent / Counselling session" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Scheduled for</label>
                <Input type="datetime-local" value={form.scheduledFor} onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Student ID (optional)</label>
                <Input value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} placeholder="123" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Assigned to user ID (optional)</label>
                <Input value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} placeholder="45" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Notes</label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button disabled={!form.title || !form.scheduledFor || create.isPending} onClick={() => create.mutate()}>Create</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab bar */}
      <div className="flex gap-2 border-b">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>{tab} ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          {query.isLoading ? <Skeleton className="h-20 w-full" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className={r.status !== "Pending" ? "opacity-60" : ""}>
                    <TableCell className="font-medium">{r.title}{r.notes && <div className="text-xs text-muted-foreground">{r.notes}</div>}</TableCell>
                    <TableCell className="text-sm">{r.studentName ?? <span className="text-muted-foreground">—</span>}{r.studentAdmissionNo && <div className="text-xs text-muted-foreground">{r.studentAdmissionNo}</div>}</TableCell>
                    <TableCell className="text-sm">
                      <div>{new Date(r.scheduledFor).toLocaleString()}</div>
                      {r.overdue && <span className="text-xs text-destructive inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Overdue</span>}
                    </TableCell>
                    <TableCell className="text-sm">{r.assignedToName ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "Pending" ? (r.overdue ? "destructive" : "default") : "secondary"}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.outcome ?? "—"}</TableCell>
                    <TableCell className="text-right space-x-1">
                      {r.status === "Pending" && (
                        <>
                          <Button size="sm" variant="default" disabled={complete.isPending} onClick={() => complete.mutate({ id: r.id, status: "Done", outcome: "Completed" })}><CheckCircle2 className="h-3 w-3 mr-1" />Done</Button>
                          <Button size="sm" variant="ghost" disabled={complete.isPending} onClick={() => complete.mutate({ id: r.id, status: "Skipped" })}>Skip</Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No follow-ups.</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
