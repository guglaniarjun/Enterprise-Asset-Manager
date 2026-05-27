import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listOpsAlerts, setOpsAlertStatus, escalateOpsAlert, formatHours, type OpsAlert } from "@/lib/operationsApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Clock, ArrowUpCircle, Info, ShieldCheck } from "lucide-react";

const STATUS_TABS = ["Open", "Acknowledged", "Resolved", "Dismissed"];

function SlaPill({ a }: { a: OpsAlert }) {
  if (a.status === "Resolved" || a.status === "Dismissed") return <span className="text-xs text-muted-foreground">—</span>;
  if (a.sla.breached) return <span className="text-xs font-medium text-destructive inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {formatHours(a.sla.hoursOver)} over</span>;
  if (!a.sla.dueAt) return <span className="text-xs text-muted-foreground">No SLA</span>;
  const left = (new Date(a.sla.dueAt).getTime() - Date.now()) / 36e5;
  return <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Clock className="h-3 w-3" />{formatHours(left)} left</span>;
}

export default function AlertsList() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState("Open");

  const query = useQuery({
    queryKey: ["ops-alerts", tab],
    queryFn: () => listOpsAlerts({ status: tab }),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => setOpsAlertStatus(id, status),
    onSuccess: () => { toast({ title: "Alert updated" }); qc.invalidateQueries({ queryKey: ["ops-alerts"] }); },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const escMut = useMutation({
    mutationFn: (id: number) => escalateOpsAlert(id),
    onSuccess: () => { toast({ title: "Escalated" }); qc.invalidateQueries({ queryKey: ["ops-alerts"] }); },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const rows = query.data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
        <p className="text-sm text-muted-foreground">Acknowledge, resolve, escalate. SLA timers run automatically.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 border-b">
        {STATUS_TABS.map((s) => (
          <button key={s} onClick={() => setTab(s)} className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === s ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            data-testid={`alerts-tab-${s.toLowerCase()}`}>
            {s}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>{tab} alerts ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          {query.isLoading ? (
            <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severity</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Esc.</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      {a.severity === "High" ? <AlertTriangle className="h-5 w-5 text-destructive" /> :
                       a.severity === "Medium" ? <AlertTriangle className="h-5 w-5 text-orange-500" /> :
                       <Info className="h-5 w-5 text-blue-500" />}
                    </TableCell>
                    <TableCell className="font-medium">{a.alertType}</TableCell>
                    <TableCell className="max-w-[280px] truncate" title={a.message}>{a.message}</TableCell>
                    <TableCell className="text-sm">{a.assignedToName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell><SlaPill a={a} /></TableCell>
                    <TableCell>{a.escalationLevel > 0 ? <Badge variant="destructive">L{a.escalationLevel}</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</TableCell>
                    <TableCell className="text-right space-x-1">
                      {a.status === "Open" && <Button size="sm" variant="outline" onClick={() => statusMut.mutate({ id: a.id, status: "Acknowledged" })} disabled={statusMut.isPending}>Acknowledge</Button>}
                      {(a.status === "Open" || a.status === "Acknowledged") && (
                        <>
                          <Button size="sm" variant="default" onClick={() => statusMut.mutate({ id: a.id, status: "Resolved" })} disabled={statusMut.isPending}><ShieldCheck className="h-3 w-3 mr-1" />Resolve</Button>
                          <Button size="sm" variant="destructive" onClick={() => escMut.mutate(a.id)} disabled={escMut.isPending}><ArrowUpCircle className="h-3 w-3" /></Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No alerts in this bucket.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
