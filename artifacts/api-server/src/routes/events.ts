import { Router, type IRouter } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { db, studentLogEventsTable, studentsTable, usersTable, dailyClassLogsTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireTenant } from "../middlewares/requireTenant";
import { requireRoles } from "../middlewares/requireRoles";
import { RBAC } from "../lib/rbac";
import { writeAuditLog } from "../lib/audit";
import { isPrivileged, isCoordinator } from "../lib/authzScope";

const router: IRouter = Router();
router.use(authenticate);
router.use(requireTenant);

async function enrich(e: typeof studentLogEventsTable.$inferSelect) {
  const [stu] = await db.select({ name: studentsTable.name, admissionNo: studentsTable.admissionNo }).from(studentsTable).where(eq(studentsTable.id, e.studentId)).limit(1);
  const [teacher] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, e.teacherId)).limit(1);
  const [log] = await db.select({ date: dailyClassLogsTable.date }).from(dailyClassLogsTable).where(eq(dailyClassLogsTable.id, e.dailyLogId)).limit(1);
  return { ...e, studentName: stu?.name ?? "", admissionNo: stu?.admissionNo ?? "", teacherName: teacher?.name ?? "", logDate: log?.date ?? null };
}

router.get("/events", requireRoles(...RBAC.ALL_STAFF), async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const studentId = req.query.studentId ? parseInt(String(req.query.studentId), 10) : null;
  const eventType = String(req.query.eventType ?? "");
  const status = String(req.query.status ?? "");
  const dateFrom = String(req.query.dateFrom ?? "");
  const dateTo = String(req.query.dateTo ?? "");

  let rows = await db.select().from(studentLogEventsTable).where(eq(studentLogEventsTable.tenantId, tenantId)).orderBy(studentLogEventsTable.createdAt);
  if (studentId) rows = rows.filter((r) => r.studentId === studentId);
  if (eventType) rows = rows.filter((r) => r.eventType === eventType);
  if (status) rows = rows.filter((r) => r.status === status);

  if (dateFrom || dateTo) {
    const logIds = new Set<number>();
    const logConditions = [eq(dailyClassLogsTable.tenantId, tenantId)];
    if (dateFrom) logConditions.push(gte(dailyClassLogsTable.date, dateFrom));
    if (dateTo) logConditions.push(lte(dailyClassLogsTable.date, dateTo));
    const logs = await db.select({ id: dailyClassLogsTable.id }).from(dailyClassLogsTable).where(and(...logConditions));
    logs.forEach((l) => logIds.add(l.id));
    rows = rows.filter((r) => logIds.has(r.dailyLogId));
  }

  const enriched = await Promise.all(rows.map(enrich));
  res.json({ data: enriched });
});

router.post("/events", requireRoles(...RBAC.ALL_STAFF), async (req, res): Promise<void> => {
  const { dailyLogId, studentId, eventType, severity, remarks, followUpRequired, followUpDate } = req.body;
  if (!dailyLogId || !studentId || !eventType) {
    res.status(400).json({ error: "dailyLogId, studentId, eventType required" });
    return;
  }
  const tenantId = req.user!.tenantId;
  const teacherId = req.user!.userId;

  const [log] = await db.select().from(dailyClassLogsTable).where(and(eq(dailyClassLogsTable.id, dailyLogId), eq(dailyClassLogsTable.tenantId, tenantId))).limit(1);
  if (!log) {
    res.status(404).json({ error: "Daily log not found" });
    return;
  }

  // Authorization: only privileged roles, coordinators, or the log's owner teacher may attach events.
  const privileged = isPrivileged(req) || isCoordinator(req);
  if (!privileged && log.teacherId !== teacherId) {
    res.status(403).json({ error: "Cannot add events to another teacher's log" });
    return;
  }
  // Teachers can only add events while the log is still being authored (Draft or Rejected).
  if (!privileged && log.verificationStatus !== "Draft" && log.verificationStatus !== "Rejected") {
    res.status(409).json({ error: `Cannot add events to a log in state '${log.verificationStatus}'` });
    return;
  }

  // Student must exist in same tenant AND same class+section as the log
  // (prevents cross-class / cross-section injection).
  const [student] = await db.select().from(studentsTable).where(and(eq(studentsTable.id, studentId), eq(studentsTable.tenantId, tenantId))).limit(1);
  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }
  if (student.classId !== log.classId || student.sectionId !== log.sectionId) {
    res.status(400).json({ error: "Student is not in the class/section of this log" });
    return;
  }

  const [event] = await db.insert(studentLogEventsTable).values({
    tenantId, dailyLogId, studentId, teacherId, eventType,
    severity: severity ?? "Low", remarks: remarks ?? null,
    followUpRequired: followUpRequired ?? false, followUpDate: followUpDate ?? null,
    status: "Open",
  }).returning();

  await writeAuditLog({ user: req.user, tenantId, action: "CREATE", entityType: "student_event", entityId: event.id, newValue: event, ipAddress: req.ip });
  res.status(201).json(await enrich(event));
});

router.patch("/events/:id/resolve", requireRoles(...RBAC.LEADERSHIP_AND_COORDINATOR), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const tenantId = req.user!.tenantId;
  const [existing] = await db.select().from(studentLogEventsTable).where(and(eq(studentLogEventsTable.id, id), eq(studentLogEventsTable.tenantId, tenantId))).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  const [updated] = await db.update(studentLogEventsTable).set({ status: "Resolved" }).where(and(eq(studentLogEventsTable.id, id), eq(studentLogEventsTable.tenantId, tenantId))).returning();
  await writeAuditLog({ user: req.user, tenantId, action: "RESOLVE", entityType: "student_event", entityId: id, oldValue: existing, newValue: { status: "Resolved" }, ipAddress: req.ip });
  res.json(await enrich(updated));
});

export default router;
