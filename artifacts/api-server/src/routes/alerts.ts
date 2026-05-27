import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, alertsTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";

const router: IRouter = Router();
router.use(authenticate);

router.get("/alerts", async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const status = String(req.query.status ?? "");
  const severity = String(req.query.severity ?? "");
  const module = String(req.query.module ?? "");

  let rows = await db.select().from(alertsTable).where(eq(alertsTable.tenantId, tenantId)).orderBy(alertsTable.createdAt);
  if (status) rows = rows.filter((r) => r.status === status);
  if (severity) rows = rows.filter((r) => r.severity === severity);
  if (module) rows = rows.filter((r) => r.module === module);

  res.json({ data: rows });
});

router.post("/alerts", async (req, res): Promise<void> => {
  const { alertType, severity, message, module, relatedEntityType, relatedEntityId, assignedTo } = req.body;
  if (!alertType || !severity || !message) {
    res.status(400).json({ error: "alertType, severity, message required" });
    return;
  }
  const tenantId = req.user!.tenantId;
  const [alert] = await db.insert(alertsTable).values({
    tenantId, alertType, severity, message, module: module ?? null,
    relatedEntityType: relatedEntityType ?? null, relatedEntityId: relatedEntityId ?? null,
    assignedTo: assignedTo ?? null, status: "Open",
  }).returning();
  res.status(201).json(alert);
});

router.patch("/alerts/:id/acknowledge", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const tenantId = req.user!.tenantId;
  const [existing] = await db.select().from(alertsTable).where(and(eq(alertsTable.id, id), eq(alertsTable.tenantId, tenantId))).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }
  const [updated] = await db.update(alertsTable).set({ status: "Acknowledged" }).where(eq(alertsTable.id, id)).returning();
  res.json(updated);
});

router.patch("/alerts/:id/resolve", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const tenantId = req.user!.tenantId;
  const [existing] = await db.select().from(alertsTable).where(and(eq(alertsTable.id, id), eq(alertsTable.tenantId, tenantId))).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }
  const [updated] = await db.update(alertsTable).set({ status: "Resolved", resolvedAt: new Date() }).where(eq(alertsTable.id, id)).returning();
  res.json(updated);
});

export default router;
