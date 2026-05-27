import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, classesTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireTenant } from "../middlewares/requireTenant";
import { requireRoles } from "../middlewares/requireRoles";
import { RBAC } from "../lib/rbac";
import { writeAuditLog } from "../lib/audit";

const router: IRouter = Router();
router.use(authenticate);
router.use(requireTenant);

router.get(
  "/classes",
  requireRoles(...RBAC.ALL_STAFF),
  async (req, res): Promise<void> => {
    const tenantId = req.user!.tenantId;
    const data = await db
      .select()
      .from(classesTable)
      .where(eq(classesTable.tenantId, tenantId))
      .orderBy(classesTable.numericLevel);
    res.json({ data });
  },
);

router.post(
  "/classes",
  requireRoles(...RBAC.ADMIN_AND_PRINCIPAL),
  async (req, res): Promise<void> => {
    const { branchId, name, numericLevel } = req.body;
    if (!branchId || !name || numericLevel == null) {
      res
        .status(400)
        .json({ error: "branchId, name, and numericLevel required" });
      return;
    }
    const tenantId = req.user!.tenantId;
    const [cls] = await db
      .insert(classesTable)
      .values({ tenantId, branchId, name, numericLevel })
      .returning();
    await writeAuditLog({
      user: req.user,
      tenantId,
      action: "CREATE",
      entityType: "class",
      entityId: cls.id,
      newValue: cls,
      ipAddress: req.ip,
    });
    res.status(201).json(cls);
  },
);

router.patch(
  "/classes/:id",
  requireRoles(...RBAC.ADMIN_AND_PRINCIPAL),
  async (req, res): Promise<void> => {
    const id = parseInt(
      Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
      10,
    );
    const tenantId = req.user!.tenantId;
    const { name, isActive } = req.body;

    const [existing] = await db
      .select()
      .from(classesTable)
      .where(and(eq(classesTable.id, id), eq(classesTable.tenantId, tenantId)))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Class not found" });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (isActive !== undefined) updates.isActive = isActive;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [updated] = await db
      .update(classesTable)
      .set(updates as any)
      .where(and(eq(classesTable.id, id), eq(classesTable.tenantId, tenantId)))
      .returning();
    await writeAuditLog({
      user: req.user,
      tenantId,
      action: "UPDATE",
      entityType: "class",
      entityId: id,
      oldValue: existing,
      newValue: updates,
      ipAddress: req.ip,
    });
    res.json(updated);
  },
);

export default router;
