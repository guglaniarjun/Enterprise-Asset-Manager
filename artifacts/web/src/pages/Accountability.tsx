import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAccountability,
  getSlaStatus,
  listSlaPolicies,
  upsertSlaPolicy,
  formatHours,
} from "@/lib/operationsApi";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Users, Timer, ShieldAlert } from "lucide-react";

export default function Accountability() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const slaQ = useQuery({ queryKey: ["sla-status"], queryFn: getSlaStatus });
  const acctQ = useQuery({
    queryKey: ["accountability"],
    queryFn: getAccountability,
  });
  const polQ = useQuery({
    queryKey: ["sla-policies"],
    queryFn: listSlaPolicies,
  });

  const [pol, setPol] = useState({
    scope: "task" as "task" | "alert",
    matchKey: "High",
    hoursToResolve: "24",
    hoursToEscalate: "",
  });
  const upsert = useMutation({
    mutationFn: () =>
      upsertSlaPolicy({
        scope: pol.scope,
        matchKey: pol.matchKey,
        hoursToResolve: Number(pol.hoursToResolve),
        hoursToEscalate: pol.hoursToEscalate
          ? Number(pol.hoursToEscalate)
          : undefined,
      }),
    onSuccess: () => {
      toast({ title: "SLA policy saved" });
      qc.invalidateQueries({ queryKey: ["sla-policies"] });
      qc.invalidateQueries({ queryKey: ["sla-status"] });
    },
    onError: (e: Error) =>
      toast({
        title: "Failed",
        description: e.message,
        variant: "destructive",
      }),
  });

  const sla = slaQ.data;
  const acct = acctQ.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Accountability & SLA
        </h1>
        <p className="text-sm text-muted-foreground">
          Who owns what, what's breached, and how fast we resolve.
        </p>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Breached tasks
            </div>
            <div className="text-3xl font-semibold text-destructive">
              {sla?.summary.breachedTasks ?? "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Breached alerts
            </div>
            <div className="text-3xl font-semibold text-destructive">
              {sla?.summary.breachedAlerts ?? "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Timer className="h-3 w-3" />
              MTTR (hrs)
            </div>
            <div className="text-3xl font-semibold">
              {acct?.global.mttrHours ?? "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" />
              Unassigned
            </div>
            <div className="text-3xl font-semibold">
              {(acct?.global.unassignedTasks ?? 0) +
                (acct?.global.unassignedAlerts ?? 0)}
            </div>
            <div className="text-xs text-muted-foreground">
              {acct?.global.unassignedTasks ?? 0} tasks ·{" "}
              {acct?.global.unassignedAlerts ?? 0} alerts
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Breached items */}
      <Card>
        <CardHeader>
          <CardTitle>SLA breaches</CardTitle>
        </CardHeader>
        <CardContent>
          {slaQ.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scope</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Priority / Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Hours over</TableHead>
                  <TableHead>Due at</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(sla?.breached ?? []).map((b, i) => (
                  <TableRow key={`${b.scope}-${b.id}-${i}`}>
                    <TableCell>
                      <Badge variant="outline">{b.scope}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{b.title}</TableCell>
                    <TableCell>{b.priority ?? b.severity ?? "—"}</TableCell>
                    <TableCell>{b.status}</TableCell>
                    <TableCell className="text-destructive font-medium">
                      {formatHours(b.hoursOver)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {b.dueAt ? new Date(b.dueAt).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setLocation(
                            b.scope === "task" ? `/tasks/${b.id}` : `/alerts`,
                          )
                        }
                      >
                        Open
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(sla?.breached?.length ?? 0) === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-muted-foreground py-6"
                    >
                      No SLA breaches.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Owner accountability */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Per-owner accountability
          </CardTitle>
        </CardHeader>
        <CardContent>
          {acctQ.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Owner</TableHead>
                  <TableHead>Open tasks</TableHead>
                  <TableHead>Done tasks</TableHead>
                  <TableHead>Breached tasks</TableHead>
                  <TableHead>Open alerts</TableHead>
                  <TableHead>Resolved alerts</TableHead>
                  <TableHead>Breached alerts</TableHead>
                  <TableHead>Pending follow-ups</TableHead>
                  <TableHead>Avg resolution</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(acct?.owners ?? []).map((o) => (
                  <TableRow key={o.userId}>
                    <TableCell className="font-medium">{o.userName}</TableCell>
                    <TableCell>{o.openTasks}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {o.doneTasks}
                    </TableCell>
                    <TableCell
                      className={
                        o.breachedTasks > 0
                          ? "text-destructive font-medium"
                          : ""
                      }
                    >
                      {o.breachedTasks}
                    </TableCell>
                    <TableCell>{o.openAlerts}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {o.resolvedAlerts}
                    </TableCell>
                    <TableCell
                      className={
                        o.breachedAlerts > 0
                          ? "text-destructive font-medium"
                          : ""
                      }
                    >
                      {o.breachedAlerts}
                    </TableCell>
                    <TableCell>
                      {o.pendingFollowUps}
                      {o.overdueFollowUps > 0 && (
                        <span className="text-destructive text-xs ml-1">
                          ({o.overdueFollowUps} overdue)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {o.avgResolutionHours ? `${o.avgResolutionHours}h` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {(acct?.owners?.length ?? 0) === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center text-muted-foreground py-6"
                    >
                      No owners yet — assign tasks and alerts to see
                      accountability.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* SLA policies */}
      <Card>
        <CardHeader>
          <CardTitle>SLA policies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-xs text-muted-foreground">
            Defaults — Tasks: {JSON.stringify(polQ.data?.defaults.task ?? {})};
            Alerts: {JSON.stringify(polQ.data?.defaults.alert ?? {})}
          </div>
          {polQ.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scope</TableHead>
                  <TableHead>Match key</TableHead>
                  <TableHead>Hours to resolve</TableHead>
                  <TableHead>Escalate after</TableHead>
                  <TableHead>Escalate to role</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(polQ.data?.data ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Badge variant="outline">{p.scope}</Badge>
                    </TableCell>
                    <TableCell>{p.matchKey}</TableCell>
                    <TableCell>{p.hoursToResolve}h</TableCell>
                    <TableCell>
                      {p.hoursToEscalate ? `${p.hoursToEscalate}h` : "—"}
                    </TableCell>
                    <TableCell>{p.escalateToRole ?? "—"}</TableCell>
                    <TableCell>
                      {p.isActive ? (
                        <Badge variant="default">Yes</Badge>
                      ) : (
                        <Badge variant="secondary">No</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(polQ.data?.data?.length ?? 0) === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-4"
                    >
                      No custom policies — defaults in use.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          {/* Inline upsert form */}
          <div className="grid md:grid-cols-5 gap-2 items-end border-t pt-4">
            <div>
              <label className="text-xs text-muted-foreground">Scope</label>
              <select
                className="w-full h-9 px-2 border rounded-md"
                value={pol.scope}
                onChange={(e) =>
                  setPol({ ...pol, scope: e.target.value as "task" | "alert" })
                }
              >
                <option value="task">task (priority)</option>
                <option value="alert">alert (severity)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Match key</label>
              <select
                className="w-full h-9 px-2 border rounded-md"
                value={pol.matchKey}
                onChange={(e) => setPol({ ...pol, matchKey: e.target.value })}
              >
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                Hours to resolve
              </label>
              <Input
                type="number"
                value={pol.hoursToResolve}
                onChange={(e) =>
                  setPol({ ...pol, hoursToResolve: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                Escalate after (hrs)
              </label>
              <Input
                type="number"
                value={pol.hoursToEscalate}
                onChange={(e) =>
                  setPol({ ...pol, hoursToEscalate: e.target.value })
                }
                placeholder="optional"
              />
            </div>
            <Button onClick={() => upsert.mutate()} disabled={upsert.isPending}>
              Save policy
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
