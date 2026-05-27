import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, subjectsTable, classesTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireTenant } from "../middlewares/requireTenant";
import { requireRoles } from "../middlewares/requireRoles";
import { RBAC } from "../lib/rbac";
import { writeAuditLog } from "../lib/audit";

const router: IRouter = Router();
router.use(authenticate);
router.use(requireTenant);

router.get("/subjects", requireRoles(...RBAC.ALL_STAFF), async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const classId = req.query.classId ? parseInt(String(req.query.classId), 10) : null;

  let subjects = await db.select().from(subjectsTable).where(eq(subjectsTable.tenantId, tenantId)).orderBy(subjectsTable.name);

  if (classId) {
    const cls = await db.select().from(classesTable).where(and(eq(classesTable.id, classId), eq(classesTable.tenantId, tenantId))).limit(1);
    if (cls.length > 0) {
      subjects = subjects.filter((s) => s.applicableClasses.length === 0 || s.applicableClasses.includes(cls[0].name));
    }
  }

  res.json({ data: subjects });
});

router.post("/subjects", requireRoles(...RBAC.ADMIN_AND_PRINCIPAL), async (req, res): Promise<void> => {
  const { branchId, name, code, applicableClasses } = req.body;
  if (!branchId || !name) {
    res.status(400).json({ error: "branchId and name required" });
    return;
  }
  const tenantId = req.user!.tenantId;
  const [subject] = await db.insert(subjectsTable).values({ tenantId, branchId, name, code: code ?? null, applicableClasses: applicableClasses ?? [] }).returning();
  await writeAuditLog({ user: req.user, tenantId, action: "CREATE", entityType: "subject", entityId: subject.id, newValue: subject, ipAddress: req.ip });
  res.status(201).json(subject);
});

router.patch("/subjects/:id", requireRoles(...RBAC.ADMIN_AND_PRINCIPAL), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const tenantId = req.user!.tenantId;
  const { name, code, applicableClasses, isActive } = req.body;

  const [existing] = await db.select().from(subjectsTable).where(and(eq(subjectsTable.id, id), eq(subjectsTable.tenantId, tenantId))).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Subject not found" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (code !== undefined) updates.code = code;
  if (applicableClasses !== undefined) updates.applicableClasses = applicableClasses;
  if (isActive !== undefined) updates.isActive = isActive;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [updated] = await db.update(subjectsTable).set(updates as any).where(and(eq(subjectsTable.id, id), eq(subjectsTable.tenantId, tenantId))).returning();
  await writeAuditLog({ user: req.user, tenantId, action: "UPDATE", entityType: "subject", entityId: id, oldValue: existing, newValue: updates, ipAddress: req.ip });
  res.json(updated);
});

export default router;
