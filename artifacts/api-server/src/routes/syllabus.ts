import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, syllabusBreakupsTable, usersTable, classesTable, sectionsTable, subjectsTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireTenant } from "../middlewares/requireTenant";
import { requireRoles } from "../middlewares/requireRoles";
import { RBAC } from "../lib/rbac";
import { writeAuditLog } from "../lib/audit";
import { sendInAppNotification, notifyRolesInBranch } from "../lib/notify";
import { ROLES } from "../middlewares/requireRoles";

const router: IRouter = Router();
router.use(authenticate);
router.use(requireTenant);

async function enrich(s: typeof syllabusBreakupsTable.$inferSelect) {
  const [teacher] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, s.teacherId)).limit(1);
  const [cls] = await db.select({ name: classesTable.name }).from(classesTable).where(eq(classesTable.id, s.classId)).limit(1);
  const sec = s.sectionId ? (await db.select({ name: sectionsTable.name }).from(sectionsTable).where(eq(sectionsTable.id, s.sectionId)).limit(1))[0] : null;
  const [sub] = await db.select({ name: subjectsTable.name }).from(subjectsTable).where(eq(subjectsTable.id, s.subjectId)).limit(1);
  return { ...s, teacherName: teacher?.name ?? "", className: cls?.name ?? "", sectionName: sec?.name ?? null, subjectName: sub?.name ?? "" };
}

router.get("/syllabus/summary", requireRoles(...RBAC.LEADERSHIP_AND_COORDINATOR), async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const academicYear = String(req.query.academicYear ?? "");

  const all = await db.select().from(syllabusBreakupsTable).where(eq(syllabusBreakupsTable.tenantId, tenantId));
  const filtered = academicYear ? all.filter((s) => s.academicYear === academicYear) : all;

  const byStatus: Record<string, number> = {};
  for (const s of filtered) byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;

  const completed = byStatus["Completed"] ?? 0;
  const total = filtered.length;
  const completionPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

  const byClassMap: Record<number, { classId: number; className: string; total: number; completed: number }> = {};
  for (const s of filtered) {
    if (!byClassMap[s.classId]) byClassMap[s.classId] = { classId: s.classId, className: "", total: 0, completed: 0 };
    byClassMap[s.classId].total++;
    if (s.status === "Completed") byClassMap[s.classId].completed++;
  }
  const byClass = Object.values(byClassMap);
  for (const c of byClass) {
    const [cls] = await db.select({ name: classesTable.name }).from(classesTable).where(eq(classesTable.id, c.classId)).limit(1);
    c.className = cls?.name ?? "";
  }

  res.json({ totalEntries: total, byStatus, completionPercent, byClass });
});

router.get("/syllabus", requireRoles(...RBAC.ALL_STAFF), async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const teacherId = req.query.teacherId ? parseInt(String(req.query.teacherId), 10) : null;
  const classId = req.query.classId ? parseInt(String(req.query.classId), 10) : null;
  const sectionId = req.query.sectionId ? parseInt(String(req.query.sectionId), 10) : null;
  const subjectId = req.query.subjectId ? parseInt(String(req.query.subjectId), 10) : null;
  const month = req.query.month ? parseInt(String(req.query.month), 10) : null;
  const status = String(req.query.status ?? "");
  const academicYear = String(req.query.academicYear ?? "");

  let rows = await db.select().from(syllabusBreakupsTable).where(eq(syllabusBreakupsTable.tenantId, tenantId)).orderBy(syllabusBreakupsTable.month);
  if (teacherId) rows = rows.filter((r) => r.teacherId === teacherId);
  if (classId) rows = rows.filter((r) => r.classId === classId);
  if (sectionId) rows = rows.filter((r) => r.sectionId === sectionId);
  if (subjectId) rows = rows.filter((r) => r.subjectId === subjectId);
  if (month) rows = rows.filter((r) => r.month === month);
  if (status) rows = rows.filter((r) => r.status === status);
  if (academicYear) rows = rows.filter((r) => r.academicYear === academicYear);

  const enriched = await Promise.all(rows.map(enrich));
  res.json({ data: enriched });
});

router.post("/syllabus", requireRoles(...RBAC.ALL_STAFF), async (req, res): Promise<void> => {
  const { branchId, classId, sectionId, subjectId, academicYear, month, week, chapter, topic, subtopic, expectedPeriods, plannedStartDate, plannedEndDate, learningOutcomes, teachingAids, activityPlan, assessmentPlan } = req.body;
  if (!branchId || !classId || !subjectId || !academicYear || !month || !chapter || !topic) {
    res.status(400).json({ error: "branchId, classId, subjectId, academicYear, month, chapter, topic required" });
    return;
  }
  const tenantId = req.user!.tenantId;
  const teacherId = req.user!.userId;

  const [entry] = await db.insert(syllabusBreakupsTable).values({
    tenantId, branchId, teacherId, classId, sectionId: sectionId ?? null, subjectId, academicYear, month, week: week ?? null,
    chapter, topic, subtopic: subtopic ?? null, expectedPeriods: expectedPeriods ?? null,
    plannedStartDate: plannedStartDate ?? null, plannedEndDate: plannedEndDate ?? null,
    learningOutcomes: learningOutcomes ?? null, teachingAids: teachingAids ?? null,
    activityPlan: activityPlan ?? null, assessmentPlan: assessmentPlan ?? null,
  }).returning();

  await writeAuditLog({ user: req.user, tenantId, action: "CREATE", entityType: "syllabus", entityId: entry.id, newValue: entry, ipAddress: req.ip });
  await notifyRolesInBranch({
    tenantId, branchId: entry.branchId, roleNames: [ROLES.COORDINATOR, ROLES.PRINCIPAL],
    title: "New syllabus to review",
    body: `${req.user!.email} submitted a syllabus breakup for ${chapter}.`,
    type: "info", relatedEntityType: "syllabus", relatedEntityId: entry.id,
  });
  const enriched = await enrich(entry);
  res.status(201).json(enriched);
});

router.get("/syllabus/:id", requireRoles(...RBAC.ALL_STAFF), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const tenantId = req.user!.tenantId;
  const [entry] = await db.select().from(syllabusBreakupsTable).where(and(eq(syllabusBreakupsTable.id, id), eq(syllabusBreakupsTable.tenantId, tenantId))).limit(1);
  if (!entry) {
    res.status(404).json({ error: "Syllabus entry not found" });
    return;
  }
  res.json(await enrich(entry));
});

router.patch("/syllabus/:id", requireRoles(...RBAC.ALL_STAFF), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const tenantId = req.user!.tenantId;
  const [existing] = await db.select().from(syllabusBreakupsTable).where(and(eq(syllabusBreakupsTable.id, id), eq(syllabusBreakupsTable.tenantId, tenantId))).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const updates: Record<string, unknown> = {};
  const fields = ["chapter", "topic", "subtopic", "expectedPeriods", "plannedStartDate", "plannedEndDate", "learningOutcomes", "teachingAids", "activityPlan", "assessmentPlan", "status"];
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [updated] = await db.update(syllabusBreakupsTable).set(updates as any).where(and(eq(syllabusBreakupsTable.id, id), eq(syllabusBreakupsTable.tenantId, tenantId))).returning();
  await writeAuditLog({ user: req.user, tenantId, action: "UPDATE", entityType: "syllabus", entityId: id, oldValue: existing, newValue: updates, ipAddress: req.ip });
  res.json(await enrich(updated));
});

router.patch("/syllabus/:id/verify", requireRoles(...RBAC.LEADERSHIP_AND_COORDINATOR), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const tenantId = req.user!.tenantId;
  const { approved } = req.body;
  const [existing] = await db.select().from(syllabusBreakupsTable).where(and(eq(syllabusBreakupsTable.id, id), eq(syllabusBreakupsTable.tenantId, tenantId))).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [updated] = await db.update(syllabusBreakupsTable).set({
    status: approved ? "Completed" : "Planned",
    verifiedBy: approved ? req.user!.userId : null,
    verifiedAt: approved ? new Date() : null,
  }).where(and(eq(syllabusBreakupsTable.id, id), eq(syllabusBreakupsTable.tenantId, tenantId))).returning();
  await writeAuditLog({ user: req.user, tenantId, action: approved ? "VERIFY" : "REJECT", entityType: "syllabus", entityId: id, oldValue: existing, newValue: { approved }, ipAddress: req.ip });
  await sendInAppNotification({
    tenantId, userId: existing.teacherId,
    title: approved ? "Syllabus approved" : "Syllabus rejected",
    body: approved
      ? `Your syllabus breakup for ${existing.chapter} has been approved.`
      : `Your syllabus breakup for ${existing.chapter} was rejected. Please revise and resubmit.`,
    type: approved ? "success" : "warning",
    relatedEntityType: "syllabus", relatedEntityId: id,
  });
  res.json(await enrich(updated));
});

export default router;
