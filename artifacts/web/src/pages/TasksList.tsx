import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listOpsTasks,
  setOpsTaskStatus,
  formatHours,
  type OpsTask,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Clock, CheckCircle2, ChevronRight } from "lucide-react";

const STATUS_FILTERS = [
  "All",
  "Open",
  "Pending",
  "In Progress",
  "Blocked",
  "Done",
  "Completed",
  "Cancelled",
];

function isTerminal(s: string) {
  return s === "Done" || s === "Completed" || s === "Cancelled";
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<
    string,
    {
      variant: "default" | "secondary" | "destructive" | "outline";
      label: string;
    }
  > = {
    Open: { variant: "destructive", label: "Open" },
    Pending: { variant: "destructive", label: "Pending" },
    "In Progress": { variant: "default", label: "In Progress" },
    Blocked: { variant: "outline", label: "Blocked" },
    Done: { variant: "secondary", label: "Done" },
    Completed: { variant: "secondary", label: "Completed" },
    Cancelled: { variant: "outline", label: "Cancelled" },
  };
  const m = map[status] ?? { variant: "outline" as const, label: status };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

function SlaPill({ task }: { task: OpsTask }) {
  if (isTerminal(task.status))
    return <span className="text-xs text-muted-foreground">—</span>;
  if (task.sla.breached) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
        <AlertTriangle className="h-3 w-3" /> Breached ·{" "}
        {formatHours(task.sla.hoursOver)} over
      </span>
    );
  }
  if (!task.sla.dueAt)
    return <span className="text-xs text-muted-foreground">No SLA</span>;
  const hoursLeft = (new Date(task.sla.dueAt).getTime() - Date.now()) / 36e5;
  if (hoursLeft < 4) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600">
        <Clock className="h-3 w-3" /> Due in {formatHours(hoursLeft)}
      </span>
    );
  }
  return (
    <span className="text-xs text-muted-foreground">
      <Clock className="inline h-3 w-3 mr-1" />
      {formatHours(hoursLeft)} left
    </span>
  );
}

export default function TasksList() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [mineOnly, setMineOnly] = useState(false);

  const query = useQuery({
    queryKey: ["ops-tasks", statusFilter, mineOnly],
    queryFn: () =>
      listOpsTasks({
        status: statusFilter === "All" ? undefined : statusFilter,
        mine: mineOnly || undefined,
      }),
  });

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      setOpsTaskStatus(id, status),
    onSuccess: () => {
      toast({ title: "Status updated" });
      qc.invalidateQueries({ queryKey: ["ops-tasks"] });
    },
    onError: (e: Error) =>
      toast({
        title: "Failed",
        description: e.message,
        variant: "destructive",
      }),
  });

  const tasks = (query.data?.data ?? []).filter((t) =>
    !search ? true : t.title.toLowerCase().includes(search.toLowerCase()),
  );

  // Group counts for the status board summary
  const counts = (query.data?.data ?? []).reduce<Record<string, number>>(
    (acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Track and resolve operational tasks with SLAs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={mineOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setMineOnly((v) => !v)}
          >
            {mineOnly ? "Mine only" : "All"}
          </Button>
        </div>
      </div>

      {/* Status board summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {STATUS_FILTERS.slice(1).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-left p-3 rounded-lg border transition ${statusFilter === s ? "border-primary bg-primary/5" : "hover:bg-accent"}`}
            data-testid={`task-status-tile-${s.toLowerCase().replace(/\s/g, "-")}`}
          >
            <div className="text-xs text-muted-foreground">{s}</div>
            <div className="text-2xl font-semibold">{counts[s] ?? 0}</div>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <CardTitle>
              {statusFilter === "All" ? "All tasks" : `${statusFilter} tasks`} (
              {tasks.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search by title…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-60"
              />
              {statusFilter !== "All" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStatusFilter("All")}
                >
                  Clear filter
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Esc.</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => (
                  <TableRow
                    key={t.id}
                    className={isTerminal(t.status) ? "opacity-60" : ""}
                  >
                    <TableCell>
                      <Link href={`/tasks/${t.id}`}>
                        <span className="font-medium hover:underline cursor-pointer flex items-center gap-1">
                          {t.title} <ChevronRight className="h-3 w-3" />
                        </span>
                      </Link>
                      {t.module && (
                        <div className="text-xs text-muted-foreground">
                          {t.module}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={t.status} />
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          t.priority === "High"
                            ? "destructive"
                            : t.priority === "Medium"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {t.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {t.assignedToName ?? (
                        <span className="text-muted-foreground">
                          Unassigned
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <SlaPill task={t} />
                    </TableCell>
                    <TableCell>
                      {t.escalationLevel > 0 ? (
                        <Badge variant="destructive">
                          L{t.escalationLevel}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {!isTerminal(t.status) &&
                        t.status !== "In Progress" &&
                        (t.allowedTransitions ?? ["In Progress"]).includes(
                          "In Progress",
                        ) && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={mutation.isPending}
                            onClick={() =>
                              mutation.mutate({
                                id: t.id,
                                status: "In Progress",
                              })
                            }
                          >
                            Start
                          </Button>
                        )}
                      {!isTerminal(t.status) && (
                        <Button
                          size="sm"
                          variant="default"
                          disabled={mutation.isPending}
                          onClick={() =>
                            mutation.mutate({ id: t.id, status: "Done" })
                          }
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Done
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setLocation(`/tasks/${t.id}`)}
                      >
                        Open
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {tasks.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-muted-foreground py-8"
                    >
                      No tasks match.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
