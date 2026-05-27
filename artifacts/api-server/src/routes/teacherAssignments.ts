import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, teacherAssignmentsTable, usersTable, classesTable, sectionsTable, subjectsTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireTenant } from "../middlewares/requireTenant";
import { requireRoles } from "../middlewares/requireRoles";
import { RBAC } from "../lib/rbac";
import { writeAuditLog } from "../lib/audit";

const router: IRouter = Router();
router.use(authenticate);
router.use(requireTenant);

async function enrichAssignment(a: typeof teacherAssignmentsTable.$inferSelect) {
  const [teacher] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, a.teacherId)).limit(1);
  const [cls] = await db.select({ name: classesTable.name }).from(classesTable).where(eq(classesTable.id, a.classId)).limit(1);
  const [sec] = await db.select({ name: sectionsTable.name }).from(sectionsTable).where(eq(sectionsTable.id, a.sectionId)).limit(1);
  const [sub] = await db.select({ name: subjectsTable.name }).from(subjectsTable).where(eq(subjectsTable.id, a.subjectId)).limit(1);
  return {
    ...a,
    teacherName: teacher?.name ?? "",
    className: cls?.name ?? "",
    sectionName: sec?.name ?? "",
    subjectName: sub?.name ?? "",
  };
}

router.get("/teacher-assignments", requireRoles(...RBAC.ALL_STAFF), async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const teacherId = req.query.teacherId ? parseInt(String(req.query.teacherId), 10) : null;
  const classId = req.query.classId ? parseInt(String(req.query.classId), 10) : null;
  const sectionId = req.query.sectionId ? parseInt(String(req.query.sectionId), 10) : null;

  const assignments = await db.select().from(teacherAssignmentsTable).where(eq(teacherAssignmentsTable.tenantId, tenantId));
  const filtered = assignments.filter((a) => {
    if (teacherId && a.teacherId !== teacherId) return false;
    if (classId && a.classId !== classId) return false;
    if (sectionId && a.sectionId !== sectionId) return false;
    return true;
  });

  const enriched = await Promise.all(filtered.map(enrichAssignment));
  res.json({ data: enriched });
});

router.post("/teacher-assignments", requireRoles(...RBAC.ADMIN_AND_PRINCIPAL), async (req, res): Promise<void> => {
  const { branchId, teacherId, classId, sectionId, subjectId, academicYear } = req.body;
  if (!branchId || !teacherId || !classId || !sectionId || !subjectId || !academicYear) {
    res.status(400).json({ error: "All fields required" });
    return;
  }
  const tenantId = req.user!.tenantId;
  const [assignment] = await db.insert(teacherAssignmentsTable).values({ tenantId, branchId, teacherId, classId, sectionId, subjectId, academicYear }).returning();
  await writeAuditLog({ user: req.user, tenantId, action: "CREATE", entityType: "teacher_assignment", entityId: assignment.id, newValue: assignment, ipAddress: req.ip });
  const enriched = await enrichAssignment(assignment);
  res.status(201).json(enriched);
});

router.patch("/teacher-assignments/:id", requireRoles(...RBAC.ADMIN_AND_PRINCIPAL), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const tenantId = req.user!.tenantId;
  const [existing] = await db.select().from(teacherAssignmentsTable).where(and(eq(teacherAssignmentsTable.id, id), eq(teacherAssignmentsTable.tenantId, tenantId))).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Assignment not found" });
    return;
  }
  const { isActive } = req.body;
  const [updated] = await db.update(teacherAssignmentsTable).set({ isActive }).where(and(eq(teacherAssignmentsTable.id, id), eq(teacherAssignmentsTable.tenantId, tenantId))).returning();
  await writeAuditLog({ user: req.user, tenantId, action: "UPDATE", entityType: "teacher_assignment", entityId: id, oldValue: existing, newValue: { isActive }, ipAddress: req.ip });
  const enriched = await enrichAssignment(updated);
  res.json(enriched);
});

router.delete("/teacher-assignments/:id", requireRoles(...RBAC.ADMIN_AND_PRINCIPAL), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const tenantId = req.user!.tenantId;
  const [existing] = await db.select().from(teacherAssignmentsTable).where(and(eq(teacherAssignmentsTable.id, id), eq(teacherAssignmentsTable.tenantId, tenantId))).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Assignment not found" });
    return;
  }
  await db.delete(teacherAssignmentsTable).where(and(eq(teacherAssignmentsTable.id, id), eq(teacherAssignmentsTable.tenantId, tenantId)));
  await writeAuditLog({ user: req.user, tenantId, action: "DELETE", entityType: "teacher_assignment", entityId: id, oldValue: existing, ipAddress: req.ip });
  res.sendStatus(204);
});

export default router;
