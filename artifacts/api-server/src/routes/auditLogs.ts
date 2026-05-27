import { Router, type IRouter } from "express";
import { eq, and, count } from "drizzle-orm";
import { db, auditLogsTable, usersTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireTenant } from "../middlewares/requireTenant";
import { requireRoles, ROLES } from "../middlewares/requireRoles";

const router: IRouter = Router();
router.use(authenticate);
router.use(requireTenant);
router.use(requireRoles(ROLES.SUPER_ADMIN, ROLES.TENANT_ADMIN, ROLES.DIRECTOR, ROLES.PRINCIPAL));

router.get("/audit-logs", async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const page = parseInt(String(req.query.page ?? 1), 10);
  const limit = parseInt(String(req.query.limit ?? 50), 10);
  const offset = (page - 1) * limit;
  const entityType = String(req.query.entityType ?? "");
  const entityId = String(req.query.entityId ?? "");

  const conditions = [eq(auditLogsTable.tenantId, tenantId)];
  if (entityType) conditions.push(eq(auditLogsTable.entityType, entityType));
  if (entityId) conditions.push(eq(auditLogsTable.entityId, entityId));

  const where = and(...conditions);
  const [{ total }] = await db.select({ total: count() }).from(auditLogsTable).where(where);
  const rows = await db.select().from(auditLogsTable).where(where).limit(limit).offset(offset).orderBy(auditLogsTable.createdAt);

  const enriched = await Promise.all(rows.map(async (r) => {
    const user = r.userId ? (await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, r.userId)).limit(1))[0] : null;
    return { ...r, userName: user?.name ?? null };
  }));

  res.json({ data: enriched, pagination: { page, limit, total: Number(total), totalPages: Math.ceil(Number(total) / limit) } });
});

export default router;
