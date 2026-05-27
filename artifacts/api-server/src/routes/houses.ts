import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, housesTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireRoles, ROLES } from "../middlewares/requireRoles";

const router: IRouter = Router();
router.use(authenticate);

router.get("/houses", async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const data = await db.select().from(housesTable).where(eq(housesTable.tenantId, tenantId)).orderBy(housesTable.name);
  res.json({ data });
});

router.post("/houses", requireRoles(ROLES.SUPER_ADMIN, ROLES.TENANT_ADMIN), async (req, res): Promise<void> => {
  const { name, color } = req.body;
  if (!name) {
    res.status(400).json({ error: "name required" });
    return;
  }
  const tenantId = req.user!.tenantId;
  const [house] = await db.insert(housesTable).values({ tenantId, name, color: color ?? null }).returning();
  res.status(201).json(house);
});

export default router;
