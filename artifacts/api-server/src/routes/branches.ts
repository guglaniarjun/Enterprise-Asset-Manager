import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, branchesTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireTenant } from "../middlewares/requireTenant";
import { requireRoles } from "../middlewares/requireRoles";
import { RBAC } from "../lib/rbac";
import { writeAuditLog } from "../lib/audit";

const router: IRouter = Router();
router.use(authenticate);
router.use(requireTenant);

router.get("/branches", requireRoles(...RBAC.ALL_STAFF), async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const data = await db.select().from(branchesTable).where(eq(branchesTable.tenantId, tenantId)).orderBy(branchesTable.name);
  res.json({ data });
});

router.post("/branches", requireRoles(...RBAC.TENANT_ADMIN), async (req, res): Promise<void> => {
  const { name, code, address } = req.body;
  if (!name || !code) {
    res.status(400).json({ error: "name and code required" });
    return;
  }
  const tenantId = req.user!.tenantId;
  const [branch] = await db.insert(branchesTable).values({ tenantId, name, code, address: address ?? null }).returning();
  await writeAuditLog({ user: req.user, tenantId, action: "CREATE", entityType: "branch", entityId: branch.id, newValue: branch, ipAddress: req.ip });
  res.status(201).json(branch);
});

export default router;
