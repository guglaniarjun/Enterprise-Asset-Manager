import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, subjectsTable, classesTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireRoles, ROLES } from "../middlewares/requireRoles";

const router: IRouter = Router();
router.use(authenticate);

router.get("/subjects", async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const classId = req.query.classId ? parseInt(String(req.query.classId), 10) : null;

  let subjects = await db.select().from(subjectsTable).where(eq(subjectsTable.tenantId, tenantId)).orderBy(subjectsTable.name);

  if (classId) {
    const cls = await db.select().from(classesTable).where(eq(classesTable.id, classId)).limit(1);
    if (cls.length > 0) {
      subjects = subjects.filter((s) => s.applicableClasses.length === 0 || s.applicableClasses.includes(cls[0].name));
    }
  }

  res.json({ data: subjects });
});

router.post("/subjects", requireRoles(ROLES.SUPER_ADMIN, ROLES.TENANT_ADMIN, ROLES.PRINCIPAL), async (req, res): Promise<void> => {
  const { branchId, name, code, applicableClasses } = req.body;
  if (!branchId || !name) {
    res.status(400).json({ error: "branchId and name required" });
    return;
  }
  const tenantId = req.user!.tenantId;
  const [subject] = await db.insert(subjectsTable).values({ tenantId, branchId, name, code: code ?? null, applicableClasses: applicableClasses ?? [] }).returning();
  res.status(201).json(subject);
});

router.patch("/subjects/:id", requireRoles(ROLES.SUPER_ADMIN, ROLES.TENANT_ADMIN, ROLES.PRINCIPAL), async (req, res): Promise<void> => {
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
  const [updated] = await db.update(subjectsTable).set(updates as any).where(eq(subjectsTable.id, id)).returning();
  res.json(updated);
});

export default router;
