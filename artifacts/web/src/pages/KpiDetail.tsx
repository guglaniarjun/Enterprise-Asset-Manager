import { useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getKpiDetail, KPI_LABELS, type KpiDetailRow } from "@/lib/kpiApi";
import { format } from "date-fns";

function useUrlFilters() {
  const [location, setLocation] = useLocation();
  const params = useMemo(() => {
    const q = location.includes("?") ? location.split("?")[1] : "";
    return new URLSearchParams(q || window.location.search);
  }, [location]);
  function set(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    const base = window.location.pathname;
    const qs = next.toString();
    setLocation(
      qs
        ? `${base.replace(import.meta.env.BASE_URL.replace(/\/$/, ""), "")}?${qs}`
        : base.replace(import.meta.env.BASE_URL.replace(/\/$/, ""), ""),
    );
  }
  return { params, set };
}

// Columns we know how to render for each KPI; we still fall back to row keys.
const COLUMN_PRESETS: Record<
  string,
  {
    key: string;
    label: string;
    render?: (v: unknown, row: KpiDetailRow) => React.ReactNode;
  }[]
> = {
  "expected-logs-today": [
    { key: "teacherName", label: "Teacher" },
    { key: "className", label: "Class" },
    { key: "sectionName", label: "Section" },
    { key: "subjectName", label: "Subject" },
    {
      key: "status",
      label: "Status",
      render: (v) => (
        <Badge variant={v === "Submitted" ? "default" : "destructive"}>
          {String(v)}
        </Badge>
      ),
    },
  ],
  "submitted-logs-today": [
    { key: "date", label: "Date" },
    { key: "teacherName", label: "Teacher" },
    { key: "className", label: "Class" },
    { key: "sectionName", label: "Section" },
    { key: "subjectName", label: "Subject" },
    {
      key: "verificationStatus",
      label: "Status",
      render: (v) => (
        <Badge
          variant={
            v === "Verified"
              ? "default"
              : v === "Rejected"
                ? "destructive"
                : "secondary"
          }
        >
          {String(v)}
        </Badge>
      ),
    },
  ],
  "missing-logs": [
    { key: "teacherName", label: "Teacher" },
    { key: "className", label: "Class" },
    { key: "sectionName", label: "Section" },
    { key: "subjectName", label: "Subject" },
    { key: "date", label: "Date" },
  ],
  "teacher-compliance": [
    { key: "teacherName", label: "Teacher" },
    { key: "expected", label: "Expected" },
    { key: "submitted", label: "Submitted" },
    { key: "missing", label: "Missing" },
    {
      key: "compliancePercent",
      label: "Compliance",
      render: (v) => (
        <Badge variant={Number(v) >= 90 ? "default" : "destructive"}>
          {String(v)}%
        </Badge>
      ),
    },
  ],
  "syllabus-completion": [
    { key: "className", label: "Class" },
    { key: "subjectName", label: "Subject" },
    { key: "chapter", label: "Chapter" },
    { key: "plannedEndDate", label: "Planned end" },
    {
      key: "status",
      label: "Status",
      render: (v) => (
        <Badge
          variant={
            v === "Completed"
              ? "default"
              : v === "Delayed"
                ? "destructive"
                : "secondary"
          }
        >
          {String(v)}
        </Badge>
      ),
    },
  ],
  "classes-behind-syllabus": [
    { key: "className", label: "Class" },
    { key: "subjectName", label: "Subject" },
    { key: "chapter", label: "Chapter" },
    { key: "plannedEndDate", label: "Planned end" },
    {
      key: "status",
      label: "Status",
      render: (v) => <Badge variant="destructive">{String(v)}</Badge>,
    },
  ],
  "subjects-behind-syllabus": [
    { key: "subjectName", label: "Subject" },
    { key: "className", label: "Class" },
    { key: "chapter", label: "Chapter" },
    { key: "plannedEndDate", label: "Planned end" },
    {
      key: "status",
      label: "Status",
      render: () => <Badge variant="destructive">Delayed</Badge>,
    },
  ],
  "discipline-cases-today": [
    { key: "date", label: "Date" },
    { key: "studentName", label: "Student" },
    { key: "admissionNo", label: "Adm. No" },
    {
      key: "severity",
      label: "Severity",
      render: (v) => (
        <Badge variant={v === "High" ? "destructive" : "secondary"}>
          {String(v)}
        </Badge>
      ),
    },
    { key: "remarks", label: "Remarks" },
    { key: "status", label: "Status" },
  ],
  "repeated-discipline-students": [
    { key: "studentName", label: "Student" },
    { key: "admissionNo", label: "Adm. No" },
    {
      key: "eventCount",
      label: "Events",
      render: (v) => <Badge variant="destructive">{String(v)}</Badge>,
    },
  ],
  "repeated-inattentive-students": [
    { key: "studentName", label: "Student" },
    { key: "admissionNo", label: "Adm. No" },
    {
      key: "eventCount",
      label: "Events",
      render: (v) => <Badge variant="destructive">{String(v)}</Badge>,
    },
  ],
  "achievements-recorded": [
    { key: "date", label: "Date" },
    { key: "studentName", label: "Student" },
    { key: "admissionNo", label: "Adm. No" },
    { key: "remarks", label: "Remarks" },
    { key: "status", label: "Status" },
  ],
  "coordinator-verification-pending": [
    { key: "date", label: "Date" },
    { key: "teacherName", label: "Teacher" },
    { key: "className", label: "Class" },
    { key: "sectionName", label: "Section" },
    { key: "subjectName", label: "Subject" },
    {
      key: "verificationStatus",
      label: "Status",
      render: (v) => <Badge variant="secondary">{String(v)}</Badge>,
    },
  ],
  "rejected-logs-pending": [
    { key: "date", label: "Date" },
    { key: "teacherName", label: "Teacher" },
    { key: "className", label: "Class" },
    { key: "sectionName", label: "Section" },
    { key: "subjectName", label: "Subject" },
    {
      key: "verificationStatus",
      label: "Status",
      render: (v) => <Badge variant="destructive">{String(v)}</Badge>,
    },
  ],
  "open-tasks": [
    { key: "title", label: "Task" },
    {
      key: "priority",
      label: "Priority",
      render: (v) => (
        <Badge variant={v === "High" ? "destructive" : "secondary"}>
          {String(v)}
        </Badge>
      ),
    },
    { key: "status", label: "Status" },
    { key: "dueDate", label: "Due" },
  ],
  "critical-alerts": [
    { key: "title", label: "Alert" },
    { key: "message", label: "Message" },
    {
      key: "severity",
      label: "Severity",
      render: (v) => <Badge variant="destructive">{String(v)}</Badge>,
    },
    { key: "status", label: "Status" },
  ],
};

export default function KpiDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const kpiKey = params.kpiKey || "";
  const { params: filters, set: setFilter } = useUrlFilters();
  const label = KPI_LABELS[kpiKey];

  const dateFrom = filters.get("dateFrom") || format(new Date(), "yyyy-MM-dd");
  const dateTo = filters.get("dateTo") || dateFrom;
  const classId = filters.get("classId") || "";
  const sectionId = filters.get("sectionId") || "";
  const subjectId = filters.get("subjectId") || "";
  const teacherId = filters.get("teacherId") || "";
  const severity = filters.get("severity") || "";
  const status = filters.get("status") || "";
  const eventType = filters.get("eventType") || "";

  const queryParams = {
    dateFrom,
    dateTo,
    classId,
    sectionId,
    subjectId,
    teacherId,
    severity,
    status,
    eventType,
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["kpi-detail", kpiKey, queryParams],
    queryFn: () => getKpiDetail(kpiKey, queryParams),
    enabled: !!kpiKey,
  });

  const columns =
    COLUMN_PRESETS[kpiKey] ??
    (data?.rows[0]
      ? Object.keys(data.rows[0])
          .filter((k) => k !== "href" && typeof data.rows[0]![k] !== "object")
          .map((k) => ({ key: k, label: k }))
      : []);

  // Preserve filters when navigating into a row
  const preserveQs = (() => {
    const usp = new URLSearchParams();
    if (classId) usp.set("classId", classId);
    if (sectionId) usp.set("sectionId", sectionId);
    if (subjectId) usp.set("subjectId", subjectId);
    if (teacherId) usp.set("teacherId", teacherId);
    if (dateFrom) usp.set("dateFrom", dateFrom);
    if (dateTo) usp.set("dateTo", dateTo);
    if (severity) usp.set("severity", severity);
    if (status) usp.set("status", status);
    if (eventType) usp.set("eventType", eventType);
    const s = usp.toString();
    return s ? `?${s}` : "";
  })();

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Director", href: "/dashboard/director" },
          { label: label?.title ?? kpiKey },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {label?.title ?? data?.title ?? kpiKey}
        </h1>
        {label?.description && (
          <p className="text-sm text-muted-foreground mt-1">
            {label.description}
          </p>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <label className="text-xs text-muted-foreground">Date from</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setFilter({ dateFrom: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Date to</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setFilter({ dateTo: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Class ID</label>
              <Input
                value={classId}
                onChange={(e) => setFilter({ classId: e.target.value })}
                placeholder="optional"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                Teacher ID
              </label>
              <Input
                value={teacherId}
                onChange={(e) => setFilter({ teacherId: e.target.value })}
                placeholder="optional"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                Section ID
              </label>
              <Input
                value={sectionId}
                onChange={(e) => setFilter({ sectionId: e.target.value })}
                placeholder="optional"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                Subject ID
              </label>
              <Input
                value={subjectId}
                onChange={(e) => setFilter({ subjectId: e.target.value })}
                placeholder="optional"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Severity</label>
              <Input
                value={severity}
                onChange={(e) => setFilter({ severity: e.target.value })}
                placeholder="High/Medium/Low"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Input
                value={status}
                onChange={(e) => setFilter({ status: e.target.value })}
                placeholder="Open/Pending/..."
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                Event type
              </label>
              <Input
                value={eventType}
                onChange={(e) => setFilter({ eventType: e.target.value })}
                placeholder="Discipline Issue/Achievement/..."
              />
            </div>
          </div>
          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setFilter({
                  classId: undefined,
                  sectionId: undefined,
                  subjectId: undefined,
                  teacherId: undefined,
                  severity: undefined,
                  status: undefined,
                  eventType: undefined,
                })
              }
            >
              Clear filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {data?.summary && (
        <div className="grid gap-3 md:grid-cols-4">
          {Object.entries(data.summary).map(([k, v]) => (
            <Card key={k}>
              <CardContent className="pt-6">
                <div className="text-xs text-muted-foreground capitalize">
                  {k.replace(/([A-Z])/g, " $1").trim()}
                </div>
                <div className="text-2xl font-bold">{v}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Records</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : error ? (
            <div className="text-sm text-destructive">
              Failed to load: {String((error as Error).message)}
            </div>
          ) : !data || data.rows.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No records match these filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((c) => (
                    <TableHead key={c.key}>{c.label}</TableHead>
                  ))}
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row, i) => (
                  <TableRow
                    key={i}
                    className={
                      row.href ? "cursor-pointer hover:bg-muted/50" : ""
                    }
                    onClick={() =>
                      row.href && setLocation(`${row.href}${preserveQs}`)
                    }
                  >
                    {columns.map((c) => {
                      const val = row[c.key];
                      return (
                        <TableCell key={c.key}>
                          {c.render
                            ? c.render(val, row)
                            : val === null || val === undefined
                              ? "-"
                              : String(val)}
                        </TableCell>
                      );
                    })}
                    <TableCell>
                      {row.href && (
                        <Button variant="link" size="sm">
                          Open
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
