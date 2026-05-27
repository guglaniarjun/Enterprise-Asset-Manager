import { Router, type IRouter } from "express";
import { eq, and, count, gte, lte } from "drizzle-orm";
import { db, dailyClassLogsTable, teacherAssignmentsTable, usersTable, classesTable, sectionsTable, subjectsTable, studentLogEventsTable, studentsTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireTenant } from "../middlewares/requireTenant";
import { requireRoles, ROLES } from "../middlewares/requireRoles";
import { RBAC } from "../lib/rbac";
import { writeAuditLog } from "../lib/audit";
import { sendInAppNotification } from "../lib/notify";

const router: IRouter = Router();
router.use(authenticate);
router.use(requireTenant);

async function enrichLog(l: typeof dailyClassLogsTable.$inferSelect) {
  const [teacher] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, l.teacherId)).limit(1);
  const [cls] = await db.select({ name: classesTable.name }).from(classesTable).where(eq(classesTable.id, l.classId)).limit(1);
  const [sec] = await db.select({ name: sectionsTable.name }).from(sectionsTable).where(eq(sectionsTable.id, l.sectionId)).limit(1);
  const [sub] = await db.select({ name: subjectsTable.name }).from(subjectsTable).where(eq(subjectsTable.id, l.subjectId)).limit(1);
  const verifier = l.verifiedBy
    ? (await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, l.verifiedBy)).limit(1))[0]
    : null;
  return {
    ...l,
    teacherName: teacher?.name ?? "",
    className: cls?.name ?? "",
    sectionName: sec?.name ?? "",
    subjectName: sub?.name ?? "",
    verifierName: verifier?.name ?? null,
  };
}

router.get("/logs/missing", requireRoles(...RBAC.LEADERSHIP_AND_COORDINATOR), async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const dateStr = String(req.query.date ?? new Date().toISOString().slice(0, 10));

  const assignments = await db.select().from(teacherAssignmentsTable).where(and(eq(teacherAssignmentsTable.tenantId, tenantId), eq(teacherAssignmentsTable.isActive, true)));
  const submitted = await db.select().from(dailyClassLogsTable).where(and(eq(dailyClassLogsTable.tenantId, tenantId), eq(dailyClassLogsTable.date, dateStr)));

  const submittedKeys = new Set(submitted.map((l) => `${l.teacherId}-${l.classId}-${l.sectionId}-${l.subjectId}`));

  const missing = [];
  for (const a of assignments) {
    const key = `${a.teacherId}-${a.classId}-${a.sectionId}-${a.subjectId}`;
    if (!submittedKeys.has(key)) {
      const [teacher] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, a.teacherId)).limit(1);
      const [cls] = await db.select({ name: classesTable.name }).from(classesTable).where(eq(classesTable.id, a.classId)).limit(1);
      const [sec] = await db.select({ name: sectionsTable.name }).from(sectionsTable).where(eq(sectionsTable.id, a.sectionId)).limit(1);
      const [sub] = await db.select({ name: subjectsTable.name }).from(subjectsTable).where(eq(subjectsTable.id, a.subjectId)).limit(1);
      missing.push({ teacherId: a.teacherId, teacherName: teacher?.name ?? "", classId: a.classId, className: cls?.name ?? "", sectionId: a.sectionId, sectionName: sec?.name ?? "", subjectId: a.subjectId, subjectName: sub?.name ?? "" });
    }
  }

  res.json({ date: dateStr, missing, totalMissing: missing.length });
});

router.get("/logs/compliance", requireRoles(...RBAC.LEADERSHIP_AND_COORDINATOR), async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const dateFrom = String(req.query.dateFrom ?? new Date().toISOString().slice(0, 10));
  const dateTo = String(req.query.dateTo ?? new Date().toISOString().slice(0, 10));

  const assignments = await db.select().from(teacherAssignmentsTable).where(and(eq(teacherAssignmentsTable.tenantId, tenantId), eq(teacherAssignmentsTable.isActive, true)));
  const logs = await db.select().from(dailyClassLogsTable).where(
    and(eq(dailyClassLogsTable.tenantId, tenantId), gte(dailyClassLogsTable.date, dateFrom), lte(dailyClassLogsTable.date, dateTo))
  );

  const teacherMap: Record<number, { teacherId: number; teacherName: string; expected: number; submitted: number }> = {};
  for (const a of assignments) {
    if (!teacherMap[a.teacherId]) teacherMap[a.teacherId] = { teacherId: a.teacherId, teacherName: "", expected: 0, submitted: 0 };
    teacherMap[a.teacherId].expected++;
  }

  for (const l of logs) {
    if (teacherMap[l.teacherId]) teacherMap[l.teacherId].submitted++;
  }

  const teachers = await Promise.all(
    Object.values(teacherMap).map(async (t) => {
      const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, t.teacherId)).limit(1);
      return { ...t, teacherName: u?.name ?? "", compliancePercent: t.expected > 0 ? Math.round((t.submitted / t.expected) * 100) : 100 };
    })
  );

  res.json({ dateFrom, dateTo, teachers });
});

router.get("/logs", requireRoles(...RBAC.ALL_STAFF), async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const page = parseInt(String(req.query.page ?? 1), 10);
  const limit = parseInt(String(req.query.limit ?? 50), 10);
  const offset = (page - 1) * limit;

  const teacherId = req.query.teacherId ? parseInt(String(req.query.teacherId), 10) : null;
  const classId = req.query.classId ? parseInt(String(req.query.classId), 10) : null;
  const sectionId = req.query.sectionId ? parseInt(String(req.query.sectionId), 10) : null;
  const subjectId = req.query.subjectId ? parseInt(String(req.query.subjectId), 10) : null;
  const date = String(req.query.date ?? "");
  const verificationStatus = String(req.query.verificationStatus ?? "");

  const userRoleNames = req.user!.roles.map((r) => r.roleName);
  const isTeacher = userRoleNames.includes(ROLES.TEACHER) && !userRoleNames.some((r) => [ROLES.SUPER_ADMIN, ROLES.TENANT_ADMIN, ROLES.DIRECTOR, ROLES.PRINCIPAL, ROLES.COORDINATOR].includes(r as typeof ROLES.SUPER_ADMIN));

  let rows = await db.select().from(dailyClassLogsTable).where(eq(dailyClassLogsTable.tenantId, tenantId)).orderBy(dailyClassLogsTable.date);

  if (isTeacher) rows = rows.filter((r) => r.teacherId === req.user!.userId);
  if (teacherId) rows = rows.filter((r) => r.teacherId === teacherId);
  if (classId) rows = rows.filter((r) => r.classId === classId);
  if (sectionId) rows = rows.filter((r) => r.sectionId === sectionId);
  if (subjectId) rows = rows.filter((r) => r.subjectId === subjectId);
  if (date) rows = rows.filter((r) => r.date === date);
  if (verificationStatus) rows = rows.filter((r) => r.verificationStatus === verificationStatus);

  const total = rows.length;
  const paginated = rows.slice(offset, offset + limit);
  const enriched = await Promise.all(paginated.map(enrichLog));

  res.json({ data: enriched, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

router.post("/logs", requireRoles(...RBAC.ALL_STAFF), async (req, res): Promise<void> => {
  const { branchId, classId, sectionId, subjectId, date, periodNumber, syllabusId, topicPlanned, topicTaught, syllabusStatus, teachingMethod, homeworkGiven, homeworkDetails, notebookWorkGiven, notebookWorkDetails, disciplineIssue, disciplineDetails, achievementDetails, improvementDetails, remarks } = req.body;
  if (!branchId || !classId || !sectionId || !subjectId || !date || !periodNumber) {
    res.status(400).json({ error: "branchId, classId, sectionId, subjectId, date, periodNumber required" });
    return;
  }
  const tenantId = req.user!.tenantId;
  const teacherId = req.user!.userId;

  const [log] = await db.insert(dailyClassLogsTable).values({
    tenantId, branchId, teacherId, classId, sectionId, subjectId, date, periodNumber,
    syllabusId: syllabusId ?? null, topicPlanned: topicPlanned ?? null, topicTaught: topicTaught ?? null,
    syllabusStatus: syllabusStatus ?? "On Track", teachingMethod: teachingMethod ?? "Lecture",
    homeworkGiven: homeworkGiven ?? false, homeworkDetails: homeworkDetails ?? null,
    notebookWorkGiven: notebookWorkGiven ?? false, notebookWorkDetails: notebookWorkDetails ?? null,
    disciplineIssue: disciplineIssue ?? false, disciplineDetails: disciplineDetails ?? null,
    achievementDetails: achievementDetails ?? null, improvementDetails: improvementDetails ?? null,
    remarks: remarks ?? null, verificationStatus: "Pending",
  }).returning();

  await writeAuditLog({ user: req.user, tenantId, action: "CREATE", entityType: "daily_log", entityId: log.id, newValue: log, ipAddress: req.ip });
  res.status(201).json(await enrichLog(log));
});

router.get("/logs/:id", requireRoles(...RBAC.ALL_STAFF), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const tenantId = req.user!.tenantId;
  const [log] = await db.select().from(dailyClassLogsTable).where(and(eq(dailyClassLogsTable.id, id), eq(dailyClassLogsTable.tenantId, tenantId))).limit(1);
  if (!log) {
    res.status(404).json({ error: "Log not found" });
    return;
  }
  const enriched = await enrichLog(log);
  const rawEvents = await db.select().from(studentLogEventsTable).where(and(eq(studentLogEventsTable.dailyLogId, id), eq(studentLogEventsTable.tenantId, tenantId)));
  const studentEvents = await Promise.all(rawEvents.map(async (e) => {
    const [stu] = await db.select({ name: studentsTable.name, admissionNo: studentsTable.admissionNo }).from(studentsTable).where(eq(studentsTable.id, e.studentId)).limit(1);
    const [teacher] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, e.teacherId)).limit(1);
    return { ...e, studentName: stu?.name ?? "", admissionNo: stu?.admissionNo ?? "", teacherName: teacher?.name ?? "", logDate: log.date };
  }));
  res.json({ ...enriched, studentEvents });
});

router.patch("/logs/:id", requireRoles(...RBAC.ALL_STAFF), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const tenantId = req.user!.tenantId;
  const [existing] = await db.select().from(dailyClassLogsTable).where(and(eq(dailyClassLogsTable.id, id), eq(dailyClassLogsTable.tenantId, tenantId))).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Log not found" });
    return;
  }
  if (existing.verificationStatus === "Verified") {
    res.status(403).json({ error: "Cannot edit a verified log" });
    return;
  }
  const userRoleNames = req.user!.roles.map((r) => r.roleName);
  const isPrivileged = userRoleNames.some((r) => [ROLES.SUPER_ADMIN, ROLES.TENANT_ADMIN, ROLES.PRINCIPAL, ROLES.COORDINATOR].includes(r as typeof ROLES.SUPER_ADMIN));
  if (!isPrivileged && existing.teacherId !== req.user!.userId) {
    res.status(403).json({ error: "Cannot edit another teacher's log" });
    return;
  }
  const updates: Record<string, unknown> = {};
  const fields = ["topicPlanned", "topicTaught", "syllabusStatus", "teachingMethod", "homeworkGiven", "homeworkDetails", "notebookWorkGiven", "notebookWorkDetails", "disciplineIssue", "disciplineDetails", "achievementDetails", "improvementDetails", "remarks"];
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [updated] = await db.update(dailyClassLogsTable).set(updates as any).where(and(eq(dailyClassLogsTable.id, id), eq(dailyClassLogsTable.tenantId, tenantId))).returning();
  await writeAuditLog({ user: req.user, tenantId, action: "UPDATE", entityType: "daily_log", entityId: id, oldValue: existing, newValue: updates, ipAddress: req.ip });
  res.json(await enrichLog(updated));
});

router.post("/logs/:id/submit", requireRoles(...RBAC.ALL_STAFF), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const tenantId = req.user!.tenantId;
  const [existing] = await db.select().from(dailyClassLogsTable).where(and(eq(dailyClassLogsTable.id, id), eq(dailyClassLogsTable.tenantId, tenantId))).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Log not found" });
    return;
  }
  const userRoleNames = req.user!.roles.map((r) => r.roleName);
  const isPrivileged = userRoleNames.some((r) => [ROLES.SUPER_ADMIN, ROLES.TENANT_ADMIN, ROLES.PRINCIPAL, ROLES.COORDINATOR].includes(r as typeof ROLES.SUPER_ADMIN));
  if (!isPrivileged && existing.teacherId !== req.user!.userId) {
    res.status(403).json({ error: "Cannot submit another teacher's log" });
    return;
  }
  const [updated] = await db.update(dailyClassLogsTable).set({ submittedAt: new Date(), verificationStatus: "Pending" }).where(and(eq(dailyClassLogsTable.id, id), eq(dailyClassLogsTable.tenantId, tenantId))).returning();
  await writeAuditLog({ user: req.user, tenantId, action: "SUBMIT", entityType: "daily_log", entityId: id, ipAddress: req.ip });
  res.json(await enrichLog(updated));
});

router.post("/logs/:id/verify", requireRoles(...RBAC.LEADERSHIP_AND_COORDINATOR), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const tenantId = req.user!.tenantId;
  const { coordinatorRemarks } = req.body;
  const [existing] = await db.select().from(dailyClassLogsTable).where(and(eq(dailyClassLogsTable.id, id), eq(dailyClassLogsTable.tenantId, tenantId))).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Log not found" });
    return;
  }
  const [updated] = await db.update(dailyClassLogsTable).set({
    verificationStatus: "Verified", verifiedBy: req.user!.userId,
    verificationTime: new Date(), coordinatorRemarks: coordinatorRemarks ?? null,
  }).where(and(eq(dailyClassLogsTable.id, id), eq(dailyClassLogsTable.tenantId, tenantId))).returning();

  await writeAuditLog({ user: req.user, tenantId, action: "VERIFY", entityType: "daily_log", entityId: id, oldValue: existing, newValue: { coordinatorRemarks }, ipAddress: req.ip });
  await sendInAppNotification({ tenantId, userId: existing.teacherId, title: "Log Verified", body: `Your class log for Period ${existing.periodNumber} has been verified.`, type: "success", relatedEntityType: "daily_log", relatedEntityId: id });

  res.json(await enrichLog(updated));
});

router.post("/logs/:id/reject", requireRoles(...RBAC.LEADERSHIP_AND_COORDINATOR), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const tenantId = req.user!.tenantId;
  const { coordinatorRemarks } = req.body;
  if (!coordinatorRemarks) {
    res.status(400).json({ error: "coordinatorRemarks required when rejecting" });
    return;
  }
  const [existing] = await db.select().from(dailyClassLogsTable).where(and(eq(dailyClassLogsTable.id, id), eq(dailyClassLogsTable.tenantId, tenantId))).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Log not found" });
    return;
  }
  const [updated] = await db.update(dailyClassLogsTable).set({
    verificationStatus: "Rejected", verifiedBy: req.user!.userId,
    verificationTime: new Date(), coordinatorRemarks,
  }).where(and(eq(dailyClassLogsTable.id, id), eq(dailyClassLogsTable.tenantId, tenantId))).returning();

  await writeAuditLog({ user: req.user, tenantId, action: "REJECT", entityType: "daily_log", entityId: id, oldValue: existing, newValue: { coordinatorRemarks }, ipAddress: req.ip });
  await sendInAppNotification({ tenantId, userId: existing.teacherId, title: "Log Rejected", body: `Your log for Period ${existing.periodNumber} was rejected: ${coordinatorRemarks}`, type: "warning", relatedEntityType: "daily_log", relatedEntityId: id });

  res.json(await enrichLog(updated));
});

export default router;
