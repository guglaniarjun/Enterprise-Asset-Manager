import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, tasksTable, usersTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireTenant } from "../middlewares/requireTenant";
import { requireRoles } from "../middlewares/requireRoles";
import { RBAC } from "../lib/rbac";
import { writeAuditLog } from "../lib/audit";

const router: IRouter = Router();
router.use(authenticate);
router.use(requireTenant);

async function enrich(t: typeof tasksTable.$inferSelect) {
  const assignee = t.assignedTo ? (await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, t.assignedTo)).limit(1))[0] : null;
  const creator = t.createdBy ? (await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, t.createdBy)).limit(1))[0] : null;
  return { ...t, assignedToName: assignee?.name ?? null, createdByName: creator?.name ?? null };
}

router.get("/tasks", requireRoles(...RBAC.ALL_STAFF), async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const status = String(req.query.status ?? "");
  const priority = String(req.query.priority ?? "");

  let rows = await db.select().from(tasksTable).where(eq(tasksTable.tenantId, tenantId)).orderBy(tasksTable.createdAt);
  if (status) rows = rows.filter((r) => r.status === status);
  if (priority) rows = rows.filter((r) => r.priority === priority);

  const enriched = await Promise.all(rows.map(enrich));
  res.json({ data: enriched });
});

router.post("/tasks", requireRoles(...RBAC.ALL_STAFF), async (req, res): Promise<void> => {
  const { title, description, module, priority, assignedTo, dueDate, relatedEntityType, relatedEntityId } = req.body;
  if (!title) {
    res.status(400).json({ error: "title required" });
    return;
  }
  const tenantId = req.user!.tenantId;
  const [task] = await db.insert(tasksTable).values({
    tenantId, title, description: description ?? null, module: module ?? null,
    priority: priority ?? "Medium", assignedTo: assignedTo ?? null,
    dueDate: dueDate ?? null, createdBy: req.user!.userId,
    sourceType: "Manual", relatedEntityType: relatedEntityType ?? null, relatedEntityId: relatedEntityId ?? null,
  }).returning();
  await writeAuditLog({ user: req.user, tenantId, action: "CREATE", entityType: "task", entityId: task.id, newValue: task, ipAddress: req.ip });
  res.status(201).json(await enrich(task));
});

router.patch("/tasks/:id", requireRoles(...RBAC.ALL_STAFF), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const tenantId = req.user!.tenantId;
  const [existing] = await db.select().from(tasksTable).where(and(eq(tasksTable.id, id), eq(tasksTable.tenantId, tenantId))).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  const updates: Record<string, unknown> = {};
  const fields = ["title", "description", "priority", "assignedTo", "dueDate", "status"];
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [updated] = await db.update(tasksTable).set(updates as any).where(and(eq(tasksTable.id, id), eq(tasksTable.tenantId, tenantId))).returning();
  await writeAuditLog({ user: req.user, tenantId, action: "UPDATE", entityType: "task", entityId: id, oldValue: existing, newValue: updates, ipAddress: req.ip });
  res.json(await enrich(updated));
});

export default router;
