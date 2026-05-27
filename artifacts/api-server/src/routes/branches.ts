import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, branchesTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireRoles, ROLES } from "../middlewares/requireRoles";

const router: IRouter = Router();
router.use(authenticate);

router.get("/branches", async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const data = await db.select().from(branchesTable).where(eq(branchesTable.tenantId, tenantId)).orderBy(branchesTable.name);
  res.json({ data });
});

router.post("/branches", requireRoles(ROLES.SUPER_ADMIN, ROLES.TENANT_ADMIN), async (req, res): Promise<void> => {
  const { name, code, address } = req.body;
  if (!name || !code) {
    res.status(400).json({ error: "name and code required" });
    return;
  }
  const tenantId = req.user!.tenantId;
  const [branch] = await db.insert(branchesTable).values({ tenantId, name, code, address: address ?? null }).returning();
  res.status(201).json(branch);
});

export default router;
