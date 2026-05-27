import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, classesTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireRoles, ROLES } from "../middlewares/requireRoles";

const router: IRouter = Router();
router.use(authenticate);

router.get("/classes", async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const data = await db.select().from(classesTable).where(eq(classesTable.tenantId, tenantId)).orderBy(classesTable.numericLevel);
  res.json({ data });
});

router.post("/classes", requireRoles(ROLES.SUPER_ADMIN, ROLES.TENANT_ADMIN, ROLES.PRINCIPAL), async (req, res): Promise<void> => {
  const { branchId, name, numericLevel } = req.body;
  if (!branchId || !name || numericLevel == null) {
    res.status(400).json({ error: "branchId, name, and numericLevel required" });
    return;
  }
  const tenantId = req.user!.tenantId;
  const [cls] = await db.insert(classesTable).values({ tenantId, branchId, name, numericLevel }).returning();
  res.status(201).json(cls);
});

router.patch("/classes/:id", requireRoles(ROLES.SUPER_ADMIN, ROLES.TENANT_ADMIN, ROLES.PRINCIPAL), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const tenantId = req.user!.tenantId;
  const { name, isActive } = req.body;

  const [existing] = await db.select().from(classesTable).where(and(eq(classesTable.id, id), eq(classesTable.tenantId, tenantId))).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Class not found" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (isActive !== undefined) updates.isActive = isActive;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [updated] = await db.update(classesTable).set(updates as any).where(eq(classesTable.id, id)).returning();
  res.json(updated);
});

export default router;
