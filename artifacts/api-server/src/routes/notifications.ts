import { Router, type IRouter } from "express";
import { eq, and, count } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireTenant } from "../middlewares/requireTenant";
import { writeAuditLog } from "../lib/audit";

const router: IRouter = Router();
router.use(authenticate);
router.use(requireTenant);

router.get("/notifications", async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const userId = req.user!.userId;
  const unreadOnly = req.query.unreadOnly === "true";

  const conditions = [eq(notificationsTable.tenantId, tenantId), eq(notificationsTable.userId, userId)];
  if (unreadOnly) conditions.push(eq(notificationsTable.isRead, false));

  const rows = await db.select().from(notificationsTable).where(and(...conditions)).orderBy(notificationsTable.createdAt).limit(50);
  const [{ total: unreadCount }] = await db.select({ total: count() }).from(notificationsTable).where(and(eq(notificationsTable.tenantId, tenantId), eq(notificationsTable.userId, userId), eq(notificationsTable.isRead, false)));

  res.json({ data: rows, unreadCount: Number(unreadCount) });
});

router.post("/notifications/:id/read", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const tenantId = req.user!.tenantId;
  const userId = req.user!.userId;
  await db.update(notificationsTable).set({ isRead: true }).where(and(eq(notificationsTable.id, id), eq(notificationsTable.tenantId, tenantId), eq(notificationsTable.userId, userId)));
  await writeAuditLog({ user: req.user, tenantId, action: "UPDATE", entityType: "notification", entityId: id, newValue: { isRead: true }, ipAddress: req.ip });
  res.json({ message: "Marked as read" });
});

router.post("/notifications/read-all", async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const userId = req.user!.userId;
  await db.update(notificationsTable).set({ isRead: true }).where(and(eq(notificationsTable.tenantId, tenantId), eq(notificationsTable.userId, userId)));
  await writeAuditLog({ user: req.user, tenantId, action: "UPDATE", entityType: "notification", newValue: { isRead: true, scope: "all", userId }, ipAddress: req.ip });
  res.json({ message: "All notifications marked as read" });
});

export default router;
