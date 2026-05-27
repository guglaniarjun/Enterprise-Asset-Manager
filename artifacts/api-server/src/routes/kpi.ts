import { Router, type IRouter, type Request } from "express";
import { eq, and, gte, lte, count, inArray, desc, sql } from "drizzle-orm";
import {
  db,
  dailyClassLogsTable,
  teacherAssignmentsTable,
  syllabusBreakupsTable,
  studentLogEventsTable,
  studentsTable,
  tasksTable,
  alertsTable,
  usersTable,
  classesTable,
  sectionsTable,
  subjectsTable,
} from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireTenant } from "../middlewares/requireTenant";
import { requireRoles } from "../middlewares/requireRoles";
import { RBAC } from "../lib/rbac";

const router: IRouter = Router();
router.use(authenticate);
router.use(requireTenant);

type Filters = {
  dateFrom?: string;
  dateTo?: string;
  classId?: number;
  sectionId?: number;
  subjectId?: number;
  teacherId?: number;
  status?: string;
  eventType?: string;
  severity?: string;
};

function parseFilters(req: Request): Filters {
  const q = req.query;
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  const str = (v: unknown) =>
    typeof v === "string" && v.length > 0 ? v : undefined;
  return {
    dateFrom: str(q["dateFrom"]),
    dateTo: str(q["dateTo"]),
    classId: num(q["classId"]),
    sectionId: num(q["sectionId"]),
    subjectId: num(q["subjectId"]),
    teacherId: num(q["teacherId"]),
    status: str(q["status"]),
    eventType: str(q["eventType"]),
    severity: str(q["severity"]),
  };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// KPI registry — title, description, and which roles may view it
// ---------------------------------------------------------------------------

const KPI_REGISTRY = {
  "expected-logs-today": { title: "Expected logs today", group: "Logs" },
  "submitted-logs-today": { title: "Submitted logs today", group: "Logs" },
  "missing-logs": { title: "Missing logs", group: "Logs" },
  "teacher-compliance": { title: "Teacher compliance", group: "Logs" },
  "syllabus-completion": { title: "Syllabus completion", group: "Syllabus" },
  "classes-behind-syllabus": {
    title: "Classes behind syllabus",
    group: "Syllabus",
  },
  "subjects-behind-syllabus": {
    title: "Subjects behind syllabus",
    group: "Syllabus",
  },
  "discipline-cases-today": {
    title: "Discipline cases today",
    group: "Discipline",
  },
  "repeated-discipline-students": {
    title: "Repeated discipline students",
    group: "Discipline",
  },
  "repeated-inattentive-students": {
    title: "Repeated inattentive students",
    group: "Discipline",
  },
  "achievements-recorded": {
    title: "Achievements recorded",
    group: "Discipline",
  },
  "coordinator-verification-pending": {
    title: "Coordinator verification pending",
    group: "Verification",
  },
  "rejected-logs-pending": {
    title: "Rejected logs pending resubmission",
    group: "Verification",
  },
  "open-tasks": { title: "Open tasks", group: "Workflow" },
  "critical-alerts": { title: "Critical alerts", group: "Workflow" },
} as const;

type KpiKey = keyof typeof KPI_REGISTRY;
const ALL_KPI_KEYS = Object.keys(KPI_REGISTRY) as KpiKey[];
function isKpiKey(k: string): k is KpiKey {
  return Object.prototype.hasOwnProperty.call(KPI_REGISTRY, k);
}

// ---------------------------------------------------------------------------
// GET /kpi/summary — every KPI in one call (Director landing)
// ---------------------------------------------------------------------------

router.get(
  "/kpi/summary",
  requireRoles(...RBAC.LEADERSHIP_AND_COORDINATOR),
  async (req, res): Promise<void> => {
    const tenantId = req.user!.tenantId;
    const date = String(req.query["date"] ?? today());

    const [assignments, logs, syllabus, events, openTasksRes, critAlertsRes] =
      await Promise.all([
        db
          .select()
          .from(teacherAssignmentsTable)
          .where(
            and(
              eq(teacherAssignmentsTable.tenantId, tenantId),
              eq(teacherAssignmentsTable.isActive, true),
            ),
          ),
        db
          .select()
          .from(dailyClassLogsTable)
          .where(
            and(
              eq(dailyClassLogsTable.tenantId, tenantId),
              eq(dailyClassLogsTable.date, date),
            ),
          ),
        db
          .select()
          .from(syllabusBreakupsTable)
          .where(eq(syllabusBreakupsTable.tenantId, tenantId)),
        db
          .select()
          .from(studentLogEventsTable)
          .where(eq(studentLogEventsTable.tenantId, tenantId)),
        db
          .select({ total: count() })
          .from(tasksTable)
          .where(
            and(
              eq(tasksTable.tenantId, tenantId),
              eq(tasksTable.status, "Open"),
            ),
          ),
        db
          .select({ total: count() })
          .from(alertsTable)
          .where(
            and(
              eq(alertsTable.tenantId, tenantId),
              eq(alertsTable.status, "Open"),
              eq(alertsTable.severity, "High"),
            ),
          ),
      ]);

    const expected = assignments.length;
    const submitted = logs.length;
    const missing = Math.max(0, expected - submitted);

    const teacherIds = [...new Set(assignments.map((a) => a.teacherId))];
    let complianceSum = 0;
    for (const tid of teacherIds) {
      const exp = assignments.filter((a) => a.teacherId === tid).length;
      const sub = logs.filter((l) => l.teacherId === tid).length;
      complianceSum += exp > 0 ? sub / exp : 1;
    }
    const compliancePercent =
      teacherIds.length > 0
        ? Math.round((complianceSum / teacherIds.length) * 100)
        : 100;

    const completedSyllabus = syllabus.filter(
      (s) => s.status === "Completed",
    ).length;
    const syllabusPercent =
      syllabus.length > 0
        ? Math.round((completedSyllabus / syllabus.length) * 100)
        : 0;
    const delayed = syllabus.filter((s) => s.status === "Delayed");
    const classesBehind = new Set(delayed.map((s) => s.classId)).size;
    const subjectsBehind = new Set(delayed.map((s) => s.subjectId)).size;

    const todayLogIds = new Set(logs.map((l) => l.id));
    const todayEvents = events.filter((e) => todayLogIds.has(e.dailyLogId));
    const discToday = todayEvents.filter(
      (e) => e.eventType === "Discipline Issue",
    ).length;

    const discCount: Record<number, number> = {};
    for (const e of events.filter((e) => e.eventType === "Discipline Issue")) {
      discCount[e.studentId] = (discCount[e.studentId] ?? 0) + 1;
    }
    const repeatedDisc = Object.values(discCount).filter((c) => c > 1).length;

    const inattCount: Record<number, number> = {};
    for (const e of events.filter((e) => e.eventType === "Inattentive")) {
      inattCount[e.studentId] = (inattCount[e.studentId] ?? 0) + 1;
    }
    const repeatedInatt = Object.values(inattCount).filter((c) => c > 1).length;

    const achievements = events.filter(
      (e) => e.eventType === "Achievement",
    ).length;
    const coordPending = logs.filter(
      (l) => l.verificationStatus === "Pending" && l.submittedAt !== null,
    ).length;
    const rejected = logs.filter(
      (l) => l.verificationStatus === "Rejected",
    ).length;

    res.json({
      date,
      kpis: {
        "expected-logs-today": { value: expected, label: "expected" },
        "submitted-logs-today": { value: submitted, label: "submitted" },
        "missing-logs": {
          value: missing,
          label: "missing",
          trend: missing > 0 ? "warning" : "ok",
        },
        "teacher-compliance": {
          value: compliancePercent,
          suffix: "%",
          trend: compliancePercent >= 90 ? "ok" : "warning",
        },
        "syllabus-completion": {
          value: syllabusPercent,
          suffix: "%",
          trend: syllabusPercent >= 80 ? "ok" : "warning",
        },
        "classes-behind-syllabus": { value: classesBehind, label: "classes" },
        "subjects-behind-syllabus": {
          value: subjectsBehind,
          label: "subjects",
        },
        "discipline-cases-today": { value: discToday, label: "cases" },
        "repeated-discipline-students": {
          value: repeatedDisc,
          label: "students",
        },
        "repeated-inattentive-students": {
          value: repeatedInatt,
          label: "students",
        },
        "achievements-recorded": { value: achievements, label: "events" },
        "coordinator-verification-pending": {
          value: coordPending,
          label: "logs",
          trend: coordPending > 0 ? "warning" : "ok",
        },
        "rejected-logs-pending": {
          value: rejected,
          label: "logs",
          trend: rejected > 0 ? "warning" : "ok",
        },
        "open-tasks": {
          value: Number(openTasksRes[0]?.total ?? 0),
          label: "tasks",
        },
        "critical-alerts": {
          value: Number(critAlertsRes[0]?.total ?? 0),
          label: "alerts",
          trend: "danger",
        },
      },
    });
  },
);

// ---------------------------------------------------------------------------
// GET /kpi/:kpiKey/detail — drill-down rows with filters
// ---------------------------------------------------------------------------

router.get(
  "/kpi/:kpiKey/detail",
  requireRoles(...RBAC.LEADERSHIP_AND_COORDINATOR),
  async (req, res): Promise<void> => {
    const tenantId = req.user!.tenantId;
    const kpiKey = String(req.params["kpiKey"] ?? "");
    if (!isKpiKey(kpiKey)) {
      res.status(404).json({ error: `Unknown KPI key: ${kpiKey}` });
      return;
    }
    const meta = KPI_REGISTRY[kpiKey];
    const f = parseFilters(req);
    const date = f.dateFrom ?? today();
    const dateTo = f.dateTo ?? date;

    const logWhere = [eq(dailyClassLogsTable.tenantId, tenantId)];
    if (f.dateFrom || !f.dateTo)
      logWhere.push(gte(dailyClassLogsTable.date, date));
    if (f.dateTo || !f.dateFrom)
      logWhere.push(lte(dailyClassLogsTable.date, dateTo));
    if (f.classId) logWhere.push(eq(dailyClassLogsTable.classId, f.classId));
    if (f.sectionId)
      logWhere.push(eq(dailyClassLogsTable.sectionId, f.sectionId));
    if (f.subjectId)
      logWhere.push(eq(dailyClassLogsTable.subjectId, f.subjectId));
    if (f.teacherId)
      logWhere.push(eq(dailyClassLogsTable.teacherId, f.teacherId));

    const aWhere = [
      eq(teacherAssignmentsTable.tenantId, tenantId),
      eq(teacherAssignmentsTable.isActive, true),
    ];
    if (f.classId) aWhere.push(eq(teacherAssignmentsTable.classId, f.classId));
    if (f.sectionId)
      aWhere.push(eq(teacherAssignmentsTable.sectionId, f.sectionId));
    if (f.subjectId)
      aWhere.push(eq(teacherAssignmentsTable.subjectId, f.subjectId));
    if (f.teacherId)
      aWhere.push(eq(teacherAssignmentsTable.teacherId, f.teacherId));

    // Helper to enrich logs with names + URLs
    const enrichLogs = async (
      logs: (typeof dailyClassLogsTable.$inferSelect)[],
    ) => {
      if (logs.length === 0) return [];
      const classIds = [...new Set(logs.map((l) => l.classId))];
      const secIds = [...new Set(logs.map((l) => l.sectionId))];
      const subIds = [...new Set(logs.map((l) => l.subjectId))];
      const tIds = [...new Set(logs.map((l) => l.teacherId))];
      const [cls, secs, subs, teachers] = await Promise.all([
        classIds.length
          ? db
              .select()
              .from(classesTable)
              .where(
                and(
                  eq(classesTable.tenantId, tenantId),
                  inArray(classesTable.id, classIds),
                ),
              )
          : [],
        secIds.length
          ? db
              .select()
              .from(sectionsTable)
              .where(
                and(
                  eq(sectionsTable.tenantId, tenantId),
                  inArray(sectionsTable.id, secIds),
                ),
              )
          : [],
        subIds.length
          ? db
              .select()
              .from(subjectsTable)
              .where(
                and(
                  eq(subjectsTable.tenantId, tenantId),
                  inArray(subjectsTable.id, subIds),
                ),
              )
          : [],
        tIds.length
          ? db
              .select()
              .from(usersTable)
              .where(
                and(
                  eq(usersTable.tenantId, tenantId),
                  inArray(usersTable.id, tIds),
                ),
              )
          : [],
      ]);
      const cMap = new Map(cls.map((c) => [c.id, c.name]));
      const sMap = new Map(secs.map((s) => [s.id, s.name]));
      const subMap = new Map(subs.map((s) => [s.id, s.name]));
      const tMap = new Map(teachers.map((t) => [t.id, t.name]));
      return logs.map((l) => ({
        id: l.id,
        date: l.date,
        periodNumber: l.periodNumber,
        classId: l.classId,
        className: cMap.get(l.classId) ?? "",
        sectionId: l.sectionId,
        sectionName: sMap.get(l.sectionId) ?? "",
        subjectId: l.subjectId,
        subjectName: subMap.get(l.subjectId) ?? "",
        teacherId: l.teacherId,
        teacherName: tMap.get(l.teacherId) ?? "",
        verificationStatus: l.verificationStatus,
        submittedAt: l.submittedAt,
        disciplineIssue: l.disciplineIssue,
        href: `/logs/${l.id}`,
      }));
    };

    switch (kpiKey) {
      case "expected-logs-today": {
        const assignments = await db
          .select()
          .from(teacherAssignmentsTable)
          .where(and(...aWhere));
        const logs = await db
          .select()
          .from(dailyClassLogsTable)
          .where(and(...logWhere));
        const submittedKeys = new Set(
          logs.map(
            (l) => `${l.teacherId}|${l.classId}|${l.sectionId}|${l.subjectId}`,
          ),
        );
        const tIds = [...new Set(assignments.map((a) => a.teacherId))];
        const classIds = [...new Set(assignments.map((a) => a.classId))];
        const secIds = [...new Set(assignments.map((a) => a.sectionId))];
        const subIds = [...new Set(assignments.map((a) => a.subjectId))];
        const [teachers, cls, secs, subs] = await Promise.all([
          tIds.length
            ? db
                .select()
                .from(usersTable)
                .where(
                  and(
                    eq(usersTable.tenantId, tenantId),
                    inArray(usersTable.id, tIds),
                  ),
                )
            : [],
          classIds.length
            ? db
                .select()
                .from(classesTable)
                .where(
                  and(
                    eq(classesTable.tenantId, tenantId),
                    inArray(classesTable.id, classIds),
                  ),
                )
            : [],
          secIds.length
            ? db
                .select()
                .from(sectionsTable)
                .where(
                  and(
                    eq(sectionsTable.tenantId, tenantId),
                    inArray(sectionsTable.id, secIds),
                  ),
                )
            : [],
          subIds.length
            ? db
                .select()
                .from(subjectsTable)
                .where(
                  and(
                    eq(subjectsTable.tenantId, tenantId),
                    inArray(subjectsTable.id, subIds),
                  ),
                )
            : [],
        ]);
        const tMap = new Map(teachers.map((t) => [t.id, t.name]));
        const cMap = new Map(cls.map((c) => [c.id, c.name]));
        const sMap = new Map(secs.map((s) => [s.id, s.name]));
        const subMap = new Map(subs.map((s) => [s.id, s.name]));
        const rows = assignments.map((a) => {
          const k = `${a.teacherId}|${a.classId}|${a.sectionId}|${a.subjectId}`;
          const isSubmitted = submittedKeys.has(k);
          return {
            assignmentId: a.id,
            teacherId: a.teacherId,
            teacherName: tMap.get(a.teacherId) ?? "",
            classId: a.classId,
            className: cMap.get(a.classId) ?? "",
            sectionId: a.sectionId,
            sectionName: sMap.get(a.sectionId) ?? "",
            subjectId: a.subjectId,
            subjectName: subMap.get(a.subjectId) ?? "",
            status: isSubmitted ? "Submitted" : "Missing",
            href: `/teachers/${a.teacherId}`,
          };
        });
        res.json({
          kpiKey,
          title: meta.title,
          summary: {
            total: rows.length,
            submitted: rows.filter((r) => r.status === "Submitted").length,
            missing: rows.filter((r) => r.status === "Missing").length,
          },
          rows,
        });
        return;
      }
      case "submitted-logs-today": {
        const logs = await db
          .select()
          .from(dailyClassLogsTable)
          .where(and(...logWhere));
        const rows = await enrichLogs(logs);
        res.json({
          kpiKey,
          title: meta.title,
          summary: { total: rows.length },
          rows,
        });
        return;
      }
      case "missing-logs": {
        const assignments = await db
          .select()
          .from(teacherAssignmentsTable)
          .where(and(...aWhere));
        const logs = await db
          .select()
          .from(dailyClassLogsTable)
          .where(and(...logWhere));
        const submittedKeys = new Set(
          logs.map(
            (l) => `${l.teacherId}|${l.classId}|${l.sectionId}|${l.subjectId}`,
          ),
        );
        const missing = assignments.filter(
          (a) =>
            !submittedKeys.has(
              `${a.teacherId}|${a.classId}|${a.sectionId}|${a.subjectId}`,
            ),
        );
        const tIds = [...new Set(missing.map((a) => a.teacherId))];
        const classIds = [...new Set(missing.map((a) => a.classId))];
        const secIds = [...new Set(missing.map((a) => a.sectionId))];
        const subIds = [...new Set(missing.map((a) => a.subjectId))];
        const [teachers, cls, secs, subs] = await Promise.all([
          tIds.length
            ? db
                .select()
                .from(usersTable)
                .where(
                  and(
                    eq(usersTable.tenantId, tenantId),
                    inArray(usersTable.id, tIds),
                  ),
                )
            : [],
          classIds.length
            ? db
                .select()
                .from(classesTable)
                .where(
                  and(
                    eq(classesTable.tenantId, tenantId),
                    inArray(classesTable.id, classIds),
                  ),
                )
            : [],
          secIds.length
            ? db
                .select()
                .from(sectionsTable)
                .where(
                  and(
                    eq(sectionsTable.tenantId, tenantId),
                    inArray(sectionsTable.id, secIds),
                  ),
                )
            : [],
          subIds.length
            ? db
                .select()
                .from(subjectsTable)
                .where(
                  and(
                    eq(subjectsTable.tenantId, tenantId),
                    inArray(subjectsTable.id, subIds),
                  ),
                )
            : [],
        ]);
        const tMap = new Map(teachers.map((t) => [t.id, t.name]));
        const cMap = new Map(cls.map((c) => [c.id, c.name]));
        const sMap = new Map(secs.map((s) => [s.id, s.name]));
        const subMap = new Map(subs.map((s) => [s.id, s.name]));
        const rows = missing.map((a) => ({
          teacherId: a.teacherId,
          teacherName: tMap.get(a.teacherId) ?? "",
          classId: a.classId,
          className: cMap.get(a.classId) ?? "",
          sectionId: a.sectionId,
          sectionName: sMap.get(a.sectionId) ?? "",
          subjectId: a.subjectId,
          subjectName: subMap.get(a.subjectId) ?? "",
          date,
          href: `/teachers/${a.teacherId}`,
        }));
        res.json({
          kpiKey,
          title: meta.title,
          summary: { total: rows.length },
          rows,
        });
        return;
      }
      case "teacher-compliance": {
        const assignments = await db
          .select()
          .from(teacherAssignmentsTable)
          .where(and(...aWhere));
        const logs = await db
          .select()
          .from(dailyClassLogsTable)
          .where(and(...logWhere));
        const tMap: Record<number, { expected: number; submitted: number }> =
          {};
        for (const a of assignments) {
          tMap[a.teacherId] = tMap[a.teacherId] ?? {
            expected: 0,
            submitted: 0,
          };
          tMap[a.teacherId]!.expected++;
        }
        for (const l of logs) {
          if (tMap[l.teacherId]) tMap[l.teacherId]!.submitted++;
        }
        const tIds = Object.keys(tMap).map(Number);
        const teachers = tIds.length
          ? await db
              .select()
              .from(usersTable)
              .where(
                and(
                  eq(usersTable.tenantId, tenantId),
                  inArray(usersTable.id, tIds),
                ),
              )
          : [];
        const nameMap = new Map(teachers.map((t) => [t.id, t.name]));
        const rows = Object.entries(tMap)
          .map(([tid, v]) => ({
            teacherId: Number(tid),
            teacherName: nameMap.get(Number(tid)) ?? "",
            expected: v.expected,
            submitted: v.submitted,
            missing: Math.max(0, v.expected - v.submitted),
            compliancePercent:
              v.expected > 0
                ? Math.round((v.submitted / v.expected) * 100)
                : 100,
            href: `/teachers/${tid}`,
          }))
          .sort((a, b) => a.compliancePercent - b.compliancePercent);
        const avg =
          rows.length > 0
            ? Math.round(
                rows.reduce((s, r) => s + r.compliancePercent, 0) / rows.length,
              )
            : 100;
        res.json({
          kpiKey,
          title: meta.title,
          summary: { teachers: rows.length, avgCompliancePercent: avg },
          rows,
        });
        return;
      }
      case "syllabus-completion":
      case "classes-behind-syllabus":
      case "subjects-behind-syllabus": {
        const sWhere = [eq(syllabusBreakupsTable.tenantId, tenantId)];
        if (f.classId)
          sWhere.push(eq(syllabusBreakupsTable.classId, f.classId));
        if (f.subjectId)
          sWhere.push(eq(syllabusBreakupsTable.subjectId, f.subjectId));
        if (f.status) sWhere.push(eq(syllabusBreakupsTable.status, f.status));
        else if (kpiKey !== "syllabus-completion")
          sWhere.push(eq(syllabusBreakupsTable.status, "Delayed"));
        const items = await db
          .select()
          .from(syllabusBreakupsTable)
          .where(and(...sWhere));
        const classIds = [...new Set(items.map((s) => s.classId))];
        const subIds = [...new Set(items.map((s) => s.subjectId))];
        const [cls, subs] = await Promise.all([
          classIds.length
            ? db
                .select()
                .from(classesTable)
                .where(
                  and(
                    eq(classesTable.tenantId, tenantId),
                    inArray(classesTable.id, classIds),
                  ),
                )
            : [],
          subIds.length
            ? db
                .select()
                .from(subjectsTable)
                .where(
                  and(
                    eq(subjectsTable.tenantId, tenantId),
                    inArray(subjectsTable.id, subIds),
                  ),
                )
            : [],
        ]);
        const cMap = new Map(cls.map((c) => [c.id, c.name]));
        const subMap = new Map(subs.map((s) => [s.id, s.name]));
        const rows = items.map((s) => ({
          id: s.id,
          classId: s.classId,
          className: cMap.get(s.classId) ?? "",
          subjectId: s.subjectId,
          subjectName: subMap.get(s.subjectId) ?? "",
          chapter: s.chapter,
          plannedEndDate: s.plannedEndDate,
          status: s.status,
          href: `/syllabus`,
        }));
        const completed = rows.filter((r) => r.status === "Completed").length;
        const delayed = rows.filter((r) => r.status === "Delayed").length;
        res.json({
          kpiKey,
          title: meta.title,
          summary: {
            total: rows.length,
            completed,
            delayed,
            percent:
              rows.length > 0 ? Math.round((completed / rows.length) * 100) : 0,
          },
          rows,
        });
        return;
      }
      case "discipline-cases-today":
      case "achievements-recorded": {
        const eWhere = [eq(studentLogEventsTable.tenantId, tenantId)];
        const evType =
          kpiKey === "discipline-cases-today"
            ? "Discipline Issue"
            : "Achievement";
        eWhere.push(eq(studentLogEventsTable.eventType, f.eventType ?? evType));
        if (f.severity)
          eWhere.push(eq(studentLogEventsTable.severity, f.severity));
        if (f.status) eWhere.push(eq(studentLogEventsTable.status, f.status));
        const events = await db
          .select()
          .from(studentLogEventsTable)
          .where(and(...eWhere))
          .orderBy(desc(studentLogEventsTable.createdAt));
        // restrict to logs matching date/class filters
        const logIds = [...new Set(events.map((e) => e.dailyLogId))];
        const logs = logIds.length
          ? await db
              .select()
              .from(dailyClassLogsTable)
              .where(and(inArray(dailyClassLogsTable.id, logIds), ...logWhere))
          : [];
        const logMap = new Map(logs.map((l) => [l.id, l]));
        const matched = events.filter((e) => logMap.has(e.dailyLogId));
        const stuIds = [...new Set(matched.map((e) => e.studentId))];
        const students = stuIds.length
          ? await db
              .select()
              .from(studentsTable)
              .where(
                and(
                  eq(studentsTable.tenantId, tenantId),
                  inArray(studentsTable.id, stuIds),
                ),
              )
          : [];
        const sMap = new Map(students.map((s) => [s.id, s]));
        const rows = matched.map((e) => {
          const l = logMap.get(e.dailyLogId)!;
          const stu = sMap.get(e.studentId);
          return {
            id: e.id,
            date: l.date,
            studentId: e.studentId,
            studentName: stu?.name ?? "",
            admissionNo: stu?.admissionNo ?? "",
            classId: l.classId,
            sectionId: l.sectionId,
            eventType: e.eventType,
            severity: e.severity,
            remarks: e.remarks,
            status: e.status,
            dailyLogId: e.dailyLogId,
            href: `/students/${e.studentId}`,
          };
        });
        res.json({
          kpiKey,
          title: meta.title,
          summary: {
            total: rows.length,
            high: rows.filter((r) => r.severity === "High").length,
            open: rows.filter((r) => r.status === "Open").length,
          },
          rows,
        });
        return;
      }
      case "repeated-discipline-students":
      case "repeated-inattentive-students": {
        const evType =
          kpiKey === "repeated-discipline-students"
            ? "Discipline Issue"
            : "Inattentive";
        const events = await db
          .select()
          .from(studentLogEventsTable)
          .where(
            and(
              eq(studentLogEventsTable.tenantId, tenantId),
              eq(studentLogEventsTable.eventType, evType),
            ),
          );
        const counts: Record<number, number> = {};
        for (const e of events)
          counts[e.studentId] = (counts[e.studentId] ?? 0) + 1;
        const repeated = Object.entries(counts).filter(([, c]) => c > 1);
        const stuIds = repeated.map(([id]) => Number(id));
        const students = stuIds.length
          ? await db
              .select()
              .from(studentsTable)
              .where(
                and(
                  eq(studentsTable.tenantId, tenantId),
                  inArray(studentsTable.id, stuIds),
                ),
              )
          : [];
        const sMap = new Map(students.map((s) => [s.id, s]));
        const rows = repeated
          .map(([id, c]) => {
            const stu = sMap.get(Number(id));
            return {
              studentId: Number(id),
              studentName: stu?.name ?? "",
              admissionNo: stu?.admissionNo ?? "",
              classId: stu?.classId ?? null,
              sectionId: stu?.sectionId ?? null,
              eventCount: c,
              href: `/students/${id}`,
            };
          })
          .sort((a, b) => b.eventCount - a.eventCount);
        res.json({
          kpiKey,
          title: meta.title,
          summary: { total: rows.length },
          rows,
        });
        return;
      }
      case "coordinator-verification-pending": {
        const where = [
          ...logWhere,
          eq(dailyClassLogsTable.verificationStatus, "Pending"),
        ];
        const logs = await db
          .select()
          .from(dailyClassLogsTable)
          .where(and(...where));
        const pending = logs.filter((l) => l.submittedAt !== null);
        const rows = await enrichLogs(pending);
        res.json({
          kpiKey,
          title: meta.title,
          summary: { total: rows.length },
          rows,
        });
        return;
      }
      case "rejected-logs-pending": {
        const where = [
          ...logWhere,
          eq(dailyClassLogsTable.verificationStatus, "Rejected"),
        ];
        const logs = await db
          .select()
          .from(dailyClassLogsTable)
          .where(and(...where));
        const rows = await enrichLogs(logs);
        res.json({
          kpiKey,
          title: meta.title,
          summary: { total: rows.length },
          rows,
        });
        return;
      }
      case "open-tasks": {
        const where = [eq(tasksTable.tenantId, tenantId)];
        where.push(eq(tasksTable.status, f.status ?? "Open"));
        const tasks = await db
          .select()
          .from(tasksTable)
          .where(and(...where))
          .orderBy(desc(tasksTable.createdAt));
        const rows = tasks.map((t) => ({
          id: t.id,
          title: t.title,
          priority: t.priority,
          status: t.status,
          assignedTo: t.assignedTo,
          relatedEntityType: t.relatedEntityType,
          relatedEntityId: t.relatedEntityId,
          dueDate: t.dueDate,
          href:
            resolveSourceHref(t.relatedEntityType, t.relatedEntityId) ??
            `/tasks`,
        }));
        res.json({
          kpiKey,
          title: meta.title,
          summary: { total: rows.length },
          rows,
        });
        return;
      }
      case "critical-alerts": {
        const where = [
          eq(alertsTable.tenantId, tenantId),
          eq(alertsTable.status, f.status ?? "Open"),
        ];
        if (f.severity) where.push(eq(alertsTable.severity, f.severity));
        else where.push(eq(alertsTable.severity, "High"));
        const alerts = await db
          .select()
          .from(alertsTable)
          .where(and(...where))
          .orderBy(desc(alertsTable.createdAt));
        const rows = alerts.map((a) => ({
          id: a.id,
          title: a.alertType,
          message: a.message,
          severity: a.severity,
          status: a.status,
          relatedEntityType: a.relatedEntityType,
          relatedEntityId: a.relatedEntityId,
          createdAt: a.createdAt,
          href:
            resolveSourceHref(a.relatedEntityType, a.relatedEntityId) ??
            `/alerts`,
        }));
        res.json({
          kpiKey,
          title: meta.title,
          summary: { total: rows.length },
          rows,
        });
        return;
      }
    }
  },
);

// ---------------------------------------------------------------------------
// Source resolver — map (entityType, entityId) → frontend route
// ---------------------------------------------------------------------------

function resolveSourceHref(
  entityType: string | null,
  entityId: string | number | null,
): string | null {
  if (!entityType || entityId === null || entityId === undefined) return null;
  switch (entityType.toLowerCase()) {
    case "daily_log":
    case "log":
      return `/logs/${entityId}`;
    case "student":
    case "student_event":
      return `/students/${entityId}`;
    case "syllabus":
    case "syllabus_breakup":
      return `/syllabus`;
    case "teacher":
    case "user":
      return `/teachers/${entityId}`;
    case "class":
      return `/admin/classes`;
    default:
      return null;
  }
}

router.get(
  "/alerts/:id/source",
  requireRoles(...RBAC.LEADERSHIP_AND_COORDINATOR),
  async (req, res): Promise<void> => {
    const tenantId = req.user!.tenantId;
    const id = Number(req.params["id"]);
    const [a] = await db
      .select()
      .from(alertsTable)
      .where(and(eq(alertsTable.id, id), eq(alertsTable.tenantId, tenantId)))
      .limit(1);
    if (!a) {
      res.status(404).json({ error: "Alert not found" });
      return;
    }
    res.json({
      id: a.id,
      title: a.alertType,
      message: a.message,
      severity: a.severity,
      relatedEntityType: a.relatedEntityType,
      relatedEntityId: a.relatedEntityId,
      href: resolveSourceHref(a.relatedEntityType, a.relatedEntityId),
    });
  },
);

router.get(
  "/tasks/:id/source",
  requireRoles(...RBAC.ALL_STAFF),
  async (req, res): Promise<void> => {
    const tenantId = req.user!.tenantId;
    const id = Number(req.params["id"]);
    const [t] = await db
      .select()
      .from(tasksTable)
      .where(and(eq(tasksTable.id, id), eq(tasksTable.tenantId, tenantId)))
      .limit(1);
    if (!t) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    res.json({
      id: t.id,
      title: t.title,
      relatedEntityType: t.relatedEntityType,
      relatedEntityId: t.relatedEntityId,
      href: resolveSourceHref(t.relatedEntityType, t.relatedEntityId),
    });
  },
);

// ---------------------------------------------------------------------------
// Profile endpoints
// ---------------------------------------------------------------------------

router.get(
  "/profiles/student/:id",
  requireRoles(...RBAC.ALL_STAFF),
  async (req, res): Promise<void> => {
    const tenantId = req.user!.tenantId;
    const id = Number(req.params["id"]);
    const [stu] = await db
      .select()
      .from(studentsTable)
      .where(
        and(eq(studentsTable.id, id), eq(studentsTable.tenantId, tenantId)),
      )
      .limit(1);
    if (!stu) {
      res.status(404).json({ error: "Student not found" });
      return;
    }
    const [cls] = stu.classId
      ? await db
          .select()
          .from(classesTable)
          .where(eq(classesTable.id, stu.classId))
          .limit(1)
      : [];
    const [sec] = stu.sectionId
      ? await db
          .select()
          .from(sectionsTable)
          .where(eq(sectionsTable.id, stu.sectionId))
          .limit(1)
      : [];

    const events = await db
      .select()
      .from(studentLogEventsTable)
      .where(
        and(
          eq(studentLogEventsTable.tenantId, tenantId),
          eq(studentLogEventsTable.studentId, id),
        ),
      )
      .orderBy(desc(studentLogEventsTable.createdAt));
    const logIds = [...new Set(events.map((e) => e.dailyLogId))];
    const logs = logIds.length
      ? await db
          .select()
          .from(dailyClassLogsTable)
          .where(
            and(
              eq(dailyClassLogsTable.tenantId, tenantId),
              inArray(dailyClassLogsTable.id, logIds),
            ),
          )
      : [];
    const logMap = new Map(logs.map((l) => [l.id, l]));
    const subjectIds = [...new Set(logs.map((l) => l.subjectId))];
    const teacherIds = [...new Set(logs.map((l) => l.teacherId))];
    const [subjects, teachers] = await Promise.all([
      subjectIds.length
        ? db
            .select()
            .from(subjectsTable)
            .where(
              and(
                eq(subjectsTable.tenantId, tenantId),
                inArray(subjectsTable.id, subjectIds),
              ),
            )
        : [],
      teacherIds.length
        ? db
            .select()
            .from(usersTable)
            .where(
              and(
                eq(usersTable.tenantId, tenantId),
                inArray(usersTable.id, teacherIds),
              ),
            )
        : [],
    ]);
    const subMap = new Map(subjects.map((s) => [s.id, s.name]));
    const tMap = new Map(teachers.map((t) => [t.id, t.name]));

    const enrichedEvents = events.map((e) => {
      const l = logMap.get(e.dailyLogId);
      return {
        id: e.id,
        eventType: e.eventType,
        severity: e.severity,
        status: e.status,
        remarks: e.remarks,
        followUpRequired: e.followUpRequired,
        createdAt: e.createdAt,
        dailyLogId: e.dailyLogId,
        date: l?.date ?? null,
        subjectName: l ? (subMap.get(l.subjectId) ?? "") : "",
        teacherName: l ? (tMap.get(l.teacherId) ?? "") : "",
        href: `/logs/${e.dailyLogId}`,
      };
    });

    const linkedAlerts = await db
      .select()
      .from(alertsTable)
      .where(
        and(
          eq(alertsTable.tenantId, tenantId),
          eq(alertsTable.relatedEntityType, "student"),
          eq(alertsTable.relatedEntityId, String(id)),
        ),
      );
    const linkedTasks = await db
      .select()
      .from(tasksTable)
      .where(
        and(
          eq(tasksTable.tenantId, tenantId),
          eq(tasksTable.relatedEntityType, "student"),
          eq(tasksTable.relatedEntityId, String(id)),
        ),
      );

    res.json({
      student: {
        id: stu.id,
        name: stu.name,
        admissionNo: stu.admissionNo,
        rollNo: stu.rollNo,
        status: stu.status,
        fatherName: stu.fatherName,
        motherName: stu.motherName,
        parentContact: stu.parentContact,
        classId: stu.classId,
        sectionId: stu.sectionId,
        className: cls?.name ?? "",
        sectionName: sec?.name ?? "",
      },
      counts: {
        total: events.length,
        discipline: events.filter((e) => e.eventType === "Discipline Issue")
          .length,
        inattentive: events.filter((e) => e.eventType === "Inattentive").length,
        achievement: events.filter((e) => e.eventType === "Achievement").length,
        improvement: events.filter((e) => e.eventType === "Improvement").length,
        followUpRequired: events.filter((e) => e.followUpRequired).length,
      },
      events: enrichedEvents,
      alerts: linkedAlerts.map((a) => ({
        id: a.id,
        title: a.alertType,
        message: a.message,
        severity: a.severity,
        status: a.status,
      })),
      tasks: linkedTasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
      })),
    });
  },
);

router.get(
  "/profiles/teacher/:id",
  requireRoles(...RBAC.LEADERSHIP_AND_COORDINATOR),
  async (req, res): Promise<void> => {
    const tenantId = req.user!.tenantId;
    const id = Number(req.params["id"]);
    const [teacher] = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.id, id), eq(usersTable.tenantId, tenantId)))
      .limit(1);
    if (!teacher) {
      res.status(404).json({ error: "Teacher not found" });
      return;
    }

    const assignments = await db
      .select()
      .from(teacherAssignmentsTable)
      .where(
        and(
          eq(teacherAssignmentsTable.tenantId, tenantId),
          eq(teacherAssignmentsTable.teacherId, id),
          eq(teacherAssignmentsTable.isActive, true),
        ),
      );
    const classIds = [...new Set(assignments.map((a) => a.classId))];
    const secIds = [...new Set(assignments.map((a) => a.sectionId))];
    const subIds = [...new Set(assignments.map((a) => a.subjectId))];
    const [cls, secs, subs] = await Promise.all([
      classIds.length
        ? db
            .select()
            .from(classesTable)
            .where(
              and(
                eq(classesTable.tenantId, tenantId),
                inArray(classesTable.id, classIds),
              ),
            )
        : [],
      secIds.length
        ? db
            .select()
            .from(sectionsTable)
            .where(
              and(
                eq(sectionsTable.tenantId, tenantId),
                inArray(sectionsTable.id, secIds),
              ),
            )
        : [],
      subIds.length
        ? db
            .select()
            .from(subjectsTable)
            .where(
              and(
                eq(subjectsTable.tenantId, tenantId),
                inArray(subjectsTable.id, subIds),
              ),
            )
        : [],
    ]);
    const cMap = new Map(cls.map((c) => [c.id, c.name]));
    const sMap = new Map(secs.map((s) => [s.id, s.name]));
    const subMap = new Map(subs.map((s) => [s.id, s.name]));

    const enrichedAssignments = assignments.map((a) => ({
      id: a.id,
      classId: a.classId,
      sectionId: a.sectionId,
      subjectId: a.subjectId,
      className: cMap.get(a.classId) ?? "",
      sectionName: sMap.get(a.sectionId) ?? "",
      subjectName: subMap.get(a.subjectId) ?? "",
      href: `/classes/${a.classId}/sections/${a.sectionId}`,
    }));

    const allLogs = await db
      .select()
      .from(dailyClassLogsTable)
      .where(
        and(
          eq(dailyClassLogsTable.tenantId, tenantId),
          eq(dailyClassLogsTable.teacherId, id),
        ),
      )
      .orderBy(desc(dailyClassLogsTable.date));
    const last30Logs = allLogs.slice(0, 30);
    const recentLogs = last30Logs.map((l) => ({
      id: l.id,
      date: l.date,
      classId: l.classId,
      className: cMap.get(l.classId) ?? "",
      sectionId: l.sectionId,
      sectionName: sMap.get(l.sectionId) ?? "",
      subjectId: l.subjectId,
      subjectName: subMap.get(l.subjectId) ?? "",
      verificationStatus: l.verificationStatus,
      href: `/logs/${l.id}`,
    }));

    const events = await db
      .select({ total: count() })
      .from(studentLogEventsTable)
      .where(eq(studentLogEventsTable.tenantId, tenantId))
      .innerJoin(
        dailyClassLogsTable,
        and(
          eq(studentLogEventsTable.dailyLogId, dailyClassLogsTable.id),
          eq(dailyClassLogsTable.teacherId, id),
        ),
      );

    res.json({
      teacher: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
      },
      counts: {
        assignments: assignments.length,
        totalLogs: allLogs.length,
        draft: allLogs.filter((l) => l.verificationStatus === "Draft").length,
        pending: allLogs.filter((l) => l.verificationStatus === "Pending")
          .length,
        verified: allLogs.filter((l) => l.verificationStatus === "Verified")
          .length,
        rejected: allLogs.filter((l) => l.verificationStatus === "Rejected")
          .length,
        eventsRecorded: Number(events[0]?.total ?? 0),
      },
      assignments: enrichedAssignments,
      recentLogs,
    });
  },
);

router.get(
  "/profiles/class/:classId/section/:sectionId",
  requireRoles(...RBAC.LEADERSHIP_AND_COORDINATOR),
  async (req, res): Promise<void> => {
    const tenantId = req.user!.tenantId;
    const classId = Number(req.params["classId"]);
    const sectionId = Number(req.params["sectionId"]);

    const [cls] = await db
      .select()
      .from(classesTable)
      .where(
        and(eq(classesTable.id, classId), eq(classesTable.tenantId, tenantId)),
      )
      .limit(1);
    const [sec] = await db
      .select()
      .from(sectionsTable)
      .where(
        and(
          eq(sectionsTable.id, sectionId),
          eq(sectionsTable.tenantId, tenantId),
        ),
      )
      .limit(1);
    if (!cls || !sec) {
      res.status(404).json({ error: "Class/section not found" });
      return;
    }

    const [students, assignments, logs, syllabus] = await Promise.all([
      db
        .select()
        .from(studentsTable)
        .where(
          and(
            eq(studentsTable.tenantId, tenantId),
            eq(studentsTable.classId, classId),
            eq(studentsTable.sectionId, sectionId),
          ),
        ),
      db
        .select()
        .from(teacherAssignmentsTable)
        .where(
          and(
            eq(teacherAssignmentsTable.tenantId, tenantId),
            eq(teacherAssignmentsTable.classId, classId),
            eq(teacherAssignmentsTable.sectionId, sectionId),
            eq(teacherAssignmentsTable.isActive, true),
          ),
        ),
      db
        .select()
        .from(dailyClassLogsTable)
        .where(
          and(
            eq(dailyClassLogsTable.tenantId, tenantId),
            eq(dailyClassLogsTable.classId, classId),
            eq(dailyClassLogsTable.sectionId, sectionId),
          ),
        )
        .orderBy(desc(dailyClassLogsTable.date)),
      db
        .select()
        .from(syllabusBreakupsTable)
        .where(
          and(
            eq(syllabusBreakupsTable.tenantId, tenantId),
            eq(syllabusBreakupsTable.classId, classId),
          ),
        ),
    ]);

    const teacherIds = [...new Set(assignments.map((a) => a.teacherId))];
    const subjectIds = [
      ...new Set([
        ...assignments.map((a) => a.subjectId),
        ...syllabus.map((s) => s.subjectId),
      ]),
    ];
    const [teachers, subjects] = await Promise.all([
      teacherIds.length
        ? db
            .select()
            .from(usersTable)
            .where(
              and(
                eq(usersTable.tenantId, tenantId),
                inArray(usersTable.id, teacherIds),
              ),
            )
        : [],
      subjectIds.length
        ? db
            .select()
            .from(subjectsTable)
            .where(
              and(
                eq(subjectsTable.tenantId, tenantId),
                inArray(subjectsTable.id, subjectIds),
              ),
            )
        : [],
    ]);
    const tMap = new Map(teachers.map((t) => [t.id, t.name]));
    const subMap = new Map(subjects.map((s) => [s.id, s.name]));

    const recentLogs = logs.slice(0, 25).map((l) => ({
      id: l.id,
      date: l.date,
      subjectId: l.subjectId,
      subjectName: subMap.get(l.subjectId) ?? "",
      teacherId: l.teacherId,
      teacherName: tMap.get(l.teacherId) ?? "",
      verificationStatus: l.verificationStatus,
      href: `/logs/${l.id}`,
    }));

    const logIds = logs.map((l) => l.id);
    const events = logIds.length
      ? await db
          .select()
          .from(studentLogEventsTable)
          .where(
            and(
              eq(studentLogEventsTable.tenantId, tenantId),
              inArray(studentLogEventsTable.dailyLogId, logIds),
            ),
          )
      : [];

    const syllabusBySubject: Record<
      number,
      { total: number; completed: number; delayed: number }
    > = {};
    for (const s of syllabus) {
      syllabusBySubject[s.subjectId] = syllabusBySubject[s.subjectId] ?? {
        total: 0,
        completed: 0,
        delayed: 0,
      };
      syllabusBySubject[s.subjectId]!.total++;
      if (s.status === "Completed") syllabusBySubject[s.subjectId]!.completed++;
      if (s.status === "Delayed") syllabusBySubject[s.subjectId]!.delayed++;
    }
    const syllabusRows = Object.entries(syllabusBySubject).map(([sid, v]) => ({
      subjectId: Number(sid),
      subjectName: subMap.get(Number(sid)) ?? "",
      ...v,
      percent: v.total > 0 ? Math.round((v.completed / v.total) * 100) : 0,
    }));

    res.json({
      class: { id: cls.id, name: cls.name },
      section: { id: sec.id, name: sec.name },
      counts: {
        students: students.length,
        teachers: teacherIds.length,
        logs: logs.length,
        events: events.length,
        discipline: events.filter((e) => e.eventType === "Discipline Issue")
          .length,
        achievements: events.filter((e) => e.eventType === "Achievement")
          .length,
      },
      students: students.map((s) => ({
        id: s.id,
        name: s.name,
        admissionNo: s.admissionNo,
        rollNo: s.rollNo,
        status: s.status,
        href: `/students/${s.id}`,
      })),
      assignments: assignments.map((a) => ({
        id: a.id,
        teacherId: a.teacherId,
        teacherName: tMap.get(a.teacherId) ?? "",
        subjectId: a.subjectId,
        subjectName: subMap.get(a.subjectId) ?? "",
        href: `/teachers/${a.teacherId}`,
      })),
      recentLogs,
      syllabusProgress: syllabusRows,
    });
  },
);

// ---------------------------------------------------------------------------
// GET /kpi/keys — discovery
// ---------------------------------------------------------------------------

router.get("/kpi/keys", requireRoles(...RBAC.ALL_STAFF), (_req, res): void => {
  res.json({ keys: ALL_KPI_KEYS.map((k) => ({ key: k, ...KPI_REGISTRY[k] })) });
});

// ensure sql import isn't tree-shaken if unused above — used for typing safety
void sql;

export default router;
