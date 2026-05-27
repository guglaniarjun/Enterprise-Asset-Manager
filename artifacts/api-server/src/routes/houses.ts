import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, housesTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireTenant } from "../middlewares/requireTenant";
import { requireRoles } from "../middlewares/requireRoles";
import { RBAC } from "../lib/rbac";
import { writeAuditLog } from "../lib/audit";

const router: IRouter = Router();
router.use(authenticate);
router.use(requireTenant);

router.get(
  "/houses",
  requireRoles(...RBAC.ALL_STAFF),
  async (req, res): Promise<void> => {
    const tenantId = req.user!.tenantId;
    const data = await db
      .select()
      .from(housesTable)
      .where(eq(housesTable.tenantId, tenantId))
      .orderBy(housesTable.name);
    res.json({ data });
  },
);

router.post(
  "/houses",
  requireRoles(...RBAC.TENANT_ADMIN),
  async (req, res): Promise<void> => {
    const { name, color } = req.body;
    if (!name) {
      res.status(400).json({ error: "name required" });
      return;
    }
    const tenantId = req.user!.tenantId;
    const [house] = await db
      .insert(housesTable)
      .values({ tenantId, name, color: color ?? null })
      .returning();
    await writeAuditLog({
      user: req.user,
      tenantId,
      action: "CREATE",
      entityType: "house",
      entityId: house.id,
      newValue: house,
      ipAddress: req.ip,
    });
    res.status(201).json(house);
  },
);

export default router;
