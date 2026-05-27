import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, sectionsTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireRoles, ROLES } from "../middlewares/requireRoles";

const router: IRouter = Router();
router.use(authenticate);

router.get("/sections", async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const classId = req.query.classId ? parseInt(String(req.query.classId), 10) : null;
  const where = classId
    ? and(eq(sectionsTable.tenantId, tenantId), eq(sectionsTable.classId, classId))
    : eq(sectionsTable.tenantId, tenantId);
  const data = await db.select().from(sectionsTable).where(where).orderBy(sectionsTable.name);
  res.json({ data });
});

router.post("/sections", requireRoles(ROLES.SUPER_ADMIN, ROLES.TENANT_ADMIN, ROLES.PRINCIPAL), async (req, res): Promise<void> => {
  const { branchId, classId, name } = req.body;
  if (!branchId || !classId || !name) {
    res.status(400).json({ error: "branchId, classId, and name required" });
    return;
  }
  const tenantId = req.user!.tenantId;
  const [section] = await db.insert(sectionsTable).values({ tenantId, branchId, classId, name }).returning();
  res.status(201).json(section);
});

router.patch("/sections/:id", requireRoles(ROLES.SUPER_ADMIN, ROLES.TENANT_ADMIN, ROLES.PRINCIPAL), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const tenantId = req.user!.tenantId;
  const { name, isActive } = req.body;

  const [existing] = await db.select().from(sectionsTable).where(and(eq(sectionsTable.id, id), eq(sectionsTable.tenantId, tenantId))).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Section not found" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (isActive !== undefined) updates.isActive = isActive;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [updated] = await db.update(sectionsTable).set(updates as any).where(eq(sectionsTable.id, id)).returning();
  res.json(updated);
});

export default router;
