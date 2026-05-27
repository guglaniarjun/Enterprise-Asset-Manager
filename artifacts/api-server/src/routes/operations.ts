import { Router, type IRouter, type Request } from "express";
import {
  and,
  eq,
  desc,
  lte,
  gte,
  isNull,
  isNotNull,
  inArray,
  sql,
} from "drizzle-orm";
import {
  db,
  tasksTable,
  alertsTable,
  taskActivityTable,
  alertActivityTable,
  followUpsTable,
  slaPoliciesTable,
  usersTable,
  studentsTable,
} from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireTenant } from "../middlewares/requireTenant";
import { requireRoles } from "../middlewares/requireRoles";
import { RBAC } from "../lib/rbac";
import { writeAuditLog } from "../lib/audit";

const router: IRouter = Router();
router.use(authenticate);
router.use(requireTenant);

// ============================================================================
// State machines
// ============================================================================

const TASK_STATES = [
  "Open",
  "Pending",
  "In Progress",
  "Blocked",
  "Done",
  "Completed",
  "Cancelled",
] as const;
const TASK_TRANSITIONS: Record<string, string[]> = {
  Open: ["In Progress", "Blocked", "Done", "Cancelled"],
  Pending: ["In Progress", "Blocked", "Done", "Cancelled"], // legacy alias of Open
  "In Progress": ["Blocked", "Done", "Open", "Cancelled"],
  Blocked: ["In Progress", "Open", "Cancelled"],
  Done: [], // terminal
  Completed: [], // legacy terminal alias of Done
  Cancelled: [], // terminal
};
function isTerminalTask(s: string): boolean {
  return s === "Done" || s === "Completed" || s === "Cancelled";
}

const ALERT_STATES = ["Open", "Acknowledged", "Resolved", "Dismissed"] as const;
const ALERT_TRANSITIONS: Record<string, string[]> = {
  Open: ["Acknowledged", "Resolved", "Dismissed"],
  Acknowledged: ["Resolved", "Dismissed"],
  Resolved: [],
  Dismissed: [],
};

function canTransitionTask(from: string, to: string): boolean {
  return (TASK_TRANSITIONS[from] ?? []).includes(to);
}
function canTransitionAlert(from: string, to: string): boolean {
  return (ALERT_TRANSITIONS[from] ?? []).includes(to);
}

// ============================================================================
// SLA engine helpers
// ============================================================================

// Default SLA hours by priority/severity if no policy is configured for the tenant.
const DEFAULT_TASK_SLA: Record<string, number> = {
  High: 24,
  Medium: 72,
  Low: 168,
};
const DEFAULT_ALERT_SLA: Record<string, number> = {
  High: 4,
  Medium: 24,
  Low: 72,
};

async function getSlaPolicy(
  tenantId: number,
  scope: "task" | "alert",
  matchKey: string,
) {
  const [policy] = await db
    .select()
    .from(slaPoliciesTable)
    .where(
      and(
        eq(slaPoliciesTable.tenantId, tenantId),
        eq(slaPoliciesTable.scope, scope),
        eq(slaPoliciesTable.matchKey, matchKey),
        eq(slaPoliciesTable.isActive, true),
      ),
    )
    .limit(1);
  return policy ?? null;
}

async function resolveSlaHours(
  tenantId: number,
  scope: "task" | "alert",
  matchKey: string,
): Promise<number> {
  const p = await getSlaPolicy(tenantId, scope, matchKey);
  if (p) return p.hoursToResolve;
  return scope === "task"
    ? (DEFAULT_TASK_SLA[matchKey] ?? 72)
    : (DEFAULT_ALERT_SLA[matchKey] ?? 24);
}

function hoursBetween(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / 36e5;
}

function computeBreachStatus(
  createdAt: Date,
  slaHours: number | null,
  terminal: boolean,
) {
  if (!slaHours || terminal)
    return { breached: false, hoursOver: 0, dueAt: null as Date | null };
  const dueAt = new Date(createdAt.getTime() + slaHours * 36e5);
  const breached = new Date() > dueAt;
  const hoursOver = breached ? hoursBetween(new Date(), dueAt) : 0;
  return { breached, hoursOver, dueAt };
}

// ============================================================================
// Task lifecycle
// ============================================================================

router.get(
  "/operations/tasks",
  requireRoles(...RBAC.ALL_STAFF),
  async (req, res): Promise<void> => {
    const tenantId = req.user!.tenantId;
    const status = String(req.query["status"] ?? "");
    const assignedTo = req.query["assignedTo"]
      ? Number(req.query["assignedTo"])
      : null;
    const priority = String(req.query["priority"] ?? "");
    const mineOnly = String(req.query["mine"] ?? "") === "true";

    const where = [eq(tasksTable.tenantId, tenantId)];
    if (status) where.push(eq(tasksTable.status, status));
    if (priority) where.push(eq(tasksTable.priority, priority));
    if (assignedTo) where.push(eq(tasksTable.assignedTo, assignedTo));
    if (mineOnly) where.push(eq(tasksTable.assignedTo, req.user!.userId));

    const tasks = await db
      .select()
      .from(tasksTable)
      .where(and(...where))
      .orderBy(desc(tasksTable.createdAt));
    const userIds = [
      ...new Set(
        tasks.flatMap((t) =>
          [t.assignedTo, t.createdBy, t.escalatedToUserId].filter(
            (x): x is number => x !== null,
          ),
        ),
      ),
    ];
    const users = userIds.length
      ? await db
          .select()
          .from(usersTable)
          .where(
            and(
              eq(usersTable.tenantId, tenantId),
              inArray(usersTable.id, userIds),
            ),
          )
      : [];
    const uMap = new Map(users.map((u) => [u.id, u.name]));

    const enriched = await Promise.all(
      tasks.map(async (t) => {
        const slaHours =
          t.slaHours ?? (await resolveSlaHours(tenantId, "task", t.priority));
        const sla = computeBreachStatus(
          t.createdAt,
          slaHours,
          isTerminalTask(t.status),
        );
        return {
          ...t,
          assignedToName: t.assignedTo
            ? (uMap.get(t.assignedTo) ?? null)
            : null,
          createdByName: t.createdBy ? (uMap.get(t.createdBy) ?? null) : null,
          escalatedToName: t.escalatedToUserId
            ? (uMap.get(t.escalatedToUserId) ?? null)
            : null,
          slaHours,
          sla: { ...sla, dueAt: sla.dueAt?.toISOString() ?? null },
        };
      }),
    );

    res.json({ data: enriched, total: enriched.length });
  },
);

router.get(
  "/operations/tasks/:id",
  requireRoles(...RBAC.ALL_STAFF),
  async (req, res): Promise<void> => {
    const tenantId = req.user!.tenantId;
    const id = Number(req.params["id"]);
    const [t] = await db
      .select()
      .from(tasksTable)
      .where(and(eq(tasksTable.id, id), eq(tasksTable.tenantId, tenantId)))
      .limit(1);
    if (!t) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    const userIds = [t.assignedTo, t.createdBy, t.escalatedToUserId].filter(
      (x): x is number => x !== null,
    );
    const users = userIds.length
      ? await db
          .select()
          .from(usersTable)
          .where(
            and(
              eq(usersTable.tenantId, tenantId),
              inArray(usersTable.id, userIds),
            ),
          )
      : [];
    const uMap = new Map(users.map((u) => [u.id, u.name]));

    const slaHours =
      t.slaHours ?? (await resolveSlaHours(tenantId, "task", t.priority));
    const sla = computeBreachStatus(
      t.createdAt,
      slaHours,
      isTerminalTask(t.status),
    );

    res.json({
      ...t,
      assignedToName: t.assignedTo ? (uMap.get(t.assignedTo) ?? null) : null,
      createdByName: t.createdBy ? (uMap.get(t.createdBy) ?? null) : null,
      escalatedToName: t.escalatedToUserId
        ? (uMap.get(t.escalatedToUserId) ?? null)
        : null,
      slaHours,
      sla: { ...sla, dueAt: sla.dueAt?.toISOString() ?? null },
      allowedTransitions: TASK_TRANSITIONS[t.status] ?? [],
    });
  },
);

router.get(
  "/operations/tasks/:id/activity",
  requireRoles(...RBAC.ALL_STAFF),
  async (req, res): Promise<void> => {
    const tenantId = req.user!.tenantId;
    const id = Number(req.params["id"]);
    const rows = await db
      .select()
      .from(taskActivityTable)
      .where(
        and(
          eq(taskActivityTable.tenantId, tenantId),
          eq(taskActivityTable.taskId, id),
        ),
      )
      .orderBy(desc(taskActivityTable.createdAt));
    const userIds = [
      ...new Set(
        rows.map((r) => r.userId).filter((x): x is number => x !== null),
      ),
    ];
    const users = userIds.length
      ? await db
          .select()
          .from(usersTable)
          .where(
            and(
              eq(usersTable.tenantId, tenantId),
              inArray(usersTable.id, userIds),
            ),
          )
      : [];
    const uMap = new Map(users.map((u) => [u.id, u.name]));
    res.json({
      data: rows.map((r) => ({
        ...r,
        userName: r.userId ? (uMap.get(r.userId) ?? null) : null,
      })),
    });
  },
);

async function recordTaskActivity(p: {
  tenantId: number;
  taskId: number;
  userId: number;
  action: string;
  fromValue?: string | null;
  toValue?: string | null;
  notes?: string | null;
}) {
  await db.insert(taskActivityTable).values({
    tenantId: p.tenantId,
    taskId: p.taskId,
    userId: p.userId,
    action: p.action,
    fromValue: p.fromValue ?? null,
    toValue: p.toValue ?? null,
    notes: p.notes ?? null,
  });
}

router.patch(
  "/operations/tasks/:id/status",
  requireRoles(...RBAC.ALL_STAFF),
  async (req, res): Promise<void> => {
    const tenantId = req.user!.tenantId;
    const id = Number(req.params["id"]);
    const newStatus = String(req.body.status ?? "");
    const notes = req.body.notes ? String(req.body.notes) : null;
    if (!TASK_STATES.includes(newStatus as (typeof TASK_STATES)[number])) {
      res
        .status(400)
        .json({ error: `Invalid status. Allowed: ${TASK_STATES.join(", ")}` });
      return;
    }
    const [t] = await db
      .select()
      .from(tasksTable)
      .where(and(eq(tasksTable.id, id), eq(tasksTable.tenantId, tenantId)))
      .limit(1);
    if (!t) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    if (!canTransitionTask(t.status, newStatus)) {
      res
        .status(409)
        .json({
          error: `Cannot transition task from "${t.status}" to "${newStatus}"`,
          allowed: TASK_TRANSITIONS[t.status] ?? [],
        });
      return;
    }
    const patch: Record<string, unknown> = { status: newStatus };
    if (newStatus === "In Progress" && !t.startedAt)
      patch.startedAt = new Date();
    if (newStatus === "Done" || newStatus === "Completed") {
      patch.completedAt = new Date();
      if (notes) patch.resolutionNotes = notes;
    }
    const [updated] = await db
      .update(tasksTable)
      .set(patch)
      .where(and(eq(tasksTable.id, id), eq(tasksTable.tenantId, tenantId)))
      .returning();
    await recordTaskActivity({
      tenantId,
      taskId: id,
      userId: req.user!.userId,
      action: "status_change",
      fromValue: t.status,
      toValue: newStatus,
      notes,
    });
    await writeAuditLog({
      user: req.user,
      tenantId,
      action: "TASK_STATUS_CHANGE",
      entityType: "task",
      entityId: id,
      oldValue: { status: t.status },
      newValue: patch,
      ipAddress: req.ip,
    });
    res.json(updated);
  },
);

router.post(
  "/operations/tasks/:id/reassign",
  requireRoles(...RBAC.LEADERSHIP_AND_COORDINATOR),
  async (req, res): Promise<void> => {
    const tenantId = req.user!.tenantId;
    const id = Number(req.params["id"]);
    const newAssignee = Number(req.body.assignedTo);
    if (!newAssignee) {
      res.status(400).json({ error: "assignedTo required" });
      return;
    }
    const [target] = await db
      .select()
      .from(usersTable)
      .where(
        and(eq(usersTable.id, newAssignee), eq(usersTable.tenantId, tenantId)),
      )
      .limit(1);
    if (!target) {
      res.status(400).json({ error: "Assignee not found in this tenant" });
      return;
    }
    const [t] = await db
      .select()
      .from(tasksTable)
      .where(and(eq(tasksTable.id, id), eq(tasksTable.tenantId, tenantId)))
      .limit(1);
    if (!t) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    const [updated] = await db
      .update(tasksTable)
      .set({ assignedTo: newAssignee })
      .where(and(eq(tasksTable.id, id), eq(tasksTable.tenantId, tenantId)))
      .returning();
    await recordTaskActivity({
      tenantId,
      taskId: id,
      userId: req.user!.userId,
      action: "reassigned",
      fromValue: t.assignedTo ? String(t.assignedTo) : null,
      toValue: String(newAssignee),
      notes: req.body.notes ?? null,
    });
    await writeAuditLog({
      user: req.user,
      tenantId,
      action: "TASK_REASSIGN",
      entityType: "task",
      entityId: id,
      oldValue: { assignedTo: t.assignedTo },
      newValue: { assignedTo: newAssignee },
      ipAddress: req.ip,
    });
    res.json(updated);
  },
);

router.post(
  "/operations/tasks/:id/comment",
  requireRoles(...RBAC.ALL_STAFF),
  async (req, res): Promise<void> => {
    const tenantId = req.user!.tenantId;
    const id = Number(req.params["id"]);
    const notes = String(req.body.notes ?? "").trim();
    if (!notes) {
      res.status(400).json({ error: "notes required" });
      return;
    }
    const [t] = await db
      .select()
      .from(tasksTable)
      .where(and(eq(tasksTable.id, id), eq(tasksTable.tenantId, tenantId)))
      .limit(1);
    if (!t) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    await recordTaskActivity({
      tenantId,
      taskId: id,
      userId: req.user!.userId,
      action: "commented",
      notes,
    });
    res.status(201).json({ ok: true });
  },
);

router.post(
  "/operations/tasks/:id/escalate",
  requireRoles(...RBAC.LEADERSHIP_AND_COORDINATOR),
  async (req, res): Promise<void> => {
    const tenantId = req.user!.tenantId;
    const id = Number(req.params["id"]);
    const escalateTo = req.body.escalateTo ? Number(req.body.escalateTo) : null;
    const notes = req.body.notes ? String(req.body.notes) : null;
    const [t] = await db
      .select()
      .from(tasksTable)
      .where(and(eq(tasksTable.id, id), eq(tasksTable.tenantId, tenantId)))
      .limit(1);
    if (!t) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    if (escalateTo) {
      const [u] = await db
        .select()
        .from(usersTable)
        .where(
          and(eq(usersTable.id, escalateTo), eq(usersTable.tenantId, tenantId)),
        )
        .limit(1);
      if (!u) {
        res
          .status(400)
          .json({ error: "Escalation target not found in tenant" });
        return;
      }
    }
    const [updated] = await db
      .update(tasksTable)
      .set({
        escalationLevel: t.escalationLevel + 1,
        escalatedAt: new Date(),
        escalatedToUserId: escalateTo,
        priority:
          t.priority === "Low"
            ? "Medium"
            : t.priority === "Medium"
              ? "High"
              : "High",
      })
      .where(and(eq(tasksTable.id, id), eq(tasksTable.tenantId, tenantId)))
      .returning();
    await recordTaskActivity({
      tenantId,
      taskId: id,
      userId: req.user!.userId,
      action: "escalated",
      fromValue: String(t.escalationLevel),
      toValue: String(t.escalationLevel + 1),
      notes,
    });
    await writeAuditLog({
      user: req.user,
      tenantId,
      action: "TASK_ESCALATE",
      entityType: "task",
      entityId: id,
      oldValue: { escalationLevel: t.escalationLevel },
      newValue: {
        escalationLevel: t.escalationLevel + 1,
        escalatedToUserId: escalateTo,
      },
      ipAddress: req.ip,
    });
    res.json(updated);
  },
);

// ============================================================================
// Alert lifecycle
// ============================================================================

router.get(
  "/operations/alerts",
  requireRoles(...RBAC.LEADERSHIP_AND_COORDINATOR),
  async (req, res): Promise<void> => {
    const tenantId = req.user!.tenantId;
    const status = String(req.query["status"] ?? "");
    const severity = String(req.query["severity"] ?? "");
    const where = [eq(alertsTable.tenantId, tenantId)];
    if (status) where.push(eq(alertsTable.status, status));
    if (severity) where.push(eq(alertsTable.severity, severity));
    const alerts = await db
      .select()
      .from(alertsTable)
      .where(and(...where))
      .orderBy(desc(alertsTable.createdAt));
    const userIds = [
      ...new Set(
        alerts.flatMap((a) =>
          [
            a.assignedTo,
            a.acknowledgedBy,
            a.resolvedBy,
            a.escalatedToUserId,
          ].filter((x): x is number => x !== null),
        ),
      ),
    ];
    const users = userIds.length
      ? await db
          .select()
          .from(usersTable)
          .where(
            and(
              eq(usersTable.tenantId, tenantId),
              inArray(usersTable.id, userIds),
            ),
          )
      : [];
    const uMap = new Map(users.map((u) => [u.id, u.name]));

    const enriched = await Promise.all(
      alerts.map(async (a) => {
        const slaHours =
          a.slaHours ?? (await resolveSlaHours(tenantId, "alert", a.severity));
        const terminal = a.status === "Resolved" || a.status === "Dismissed";
        const sla = computeBreachStatus(a.createdAt, slaHours, terminal);
        return {
          ...a,
          assignedToName: a.assignedTo
            ? (uMap.get(a.assignedTo) ?? null)
            : null,
          acknowledgedByName: a.acknowledgedBy
            ? (uMap.get(a.acknowledgedBy) ?? null)
            : null,
          resolvedByName: a.resolvedBy
            ? (uMap.get(a.resolvedBy) ?? null)
            : null,
          escalatedToName: a.escalatedToUserId
            ? (uMap.get(a.escalatedToUserId) ?? null)
            : null,
          slaHours,
          sla: { ...sla, dueAt: sla.dueAt?.toISOString() ?? null },
        };
      }),
    );
    res.json({ data: enriched, total: enriched.length });
  },
);

router.get(
  "/operations/alerts/:id",
  requireRoles(...RBAC.LEADERSHIP_AND_COORDINATOR),
  async (req, res): Promise<void> => {
    const tenantId = req.user!.tenantId;
    const id = Number(req.params["id"]);
    const [a] = await db
      .select()
      .from(alertsTable)
      .where(and(eq(alertsTable.id, id), eq(alertsTable.tenantId, tenantId)))
      .limit(1);
    if (!a) {
      res.status(404).json({ error: "Alert not found" });
      return;
    }
    const slaHours =
      a.slaHours ?? (await resolveSlaHours(tenantId, "alert", a.severity));
    const terminal = a.status === "Resolved" || a.status === "Dismissed";
    const sla = computeBreachStatus(a.createdAt, slaHours, terminal);
    res.json({
      ...a,
      slaHours,
      sla: { ...sla, dueAt: sla.dueAt?.toISOString() ?? null },
      allowedTransitions: ALERT_TRANSITIONS[a.status] ?? [],
    });
  },
);

router.get(
  "/operations/alerts/:id/activity",
  requireRoles(...RBAC.LEADERSHIP_AND_COORDINATOR),
  async (req, res): Promise<void> => {
    const tenantId = req.user!.tenantId;
    const id = Number(req.params["id"]);
    const rows = await db
      .select()
      .from(alertActivityTable)
      .where(
        and(
          eq(alertActivityTable.tenantId, tenantId),
          eq(alertActivityTable.alertId, id),
        ),
      )
      .orderBy(desc(alertActivityTable.createdAt));
    const userIds = [
      ...new Set(
        rows.map((r) => r.userId).filter((x): x is number => x !== null),
      ),
    ];
    const users = userIds.length
      ? await db
          .select()
          .from(usersTable)
          .where(
            and(
              eq(usersTable.tenantId, tenantId),
              inArray(usersTable.id, userIds),
            ),
          )
      : [];
    const uMap = new Map(users.map((u) => [u.id, u.name]));
    res.json({
      data: rows.map((r) => ({
        ...r,
        userName: r.userId ? (uMap.get(r.userId) ?? null) : null,
      })),
    });
  },
);

async function recordAlertActivity(p: {
  tenantId: number;
  alertId: number;
  userId: number;
  action: string;
  fromValue?: string | null;
  toValue?: string | null;
  notes?: string | null;
}) {
  await db.insert(alertActivityTable).values({
    tenantId: p.tenantId,
    alertId: p.alertId,
    userId: p.userId,
    action: p.action,
    fromValue: p.fromValue ?? null,
    toValue: p.toValue ?? null,
    notes: p.notes ?? null,
  });
}

router.patch(
  "/operations/alerts/:id/status",
  requireRoles(...RBAC.LEADERSHIP_AND_COORDINATOR),
  async (req, res): Promise<void> => {
    const tenantId = req.user!.tenantId;
    const id = Number(req.params["id"]);
    const newStatus = String(req.body.status ?? "");
    const notes = req.body.notes ? String(req.body.notes) : null;
    if (!ALERT_STATES.includes(newStatus as (typeof ALERT_STATES)[number])) {
      res
        .status(400)
        .json({ error: `Invalid status. Allowed: ${ALERT_STATES.join(", ")}` });
      return;
    }
    const [a] = await db
      .select()
      .from(alertsTable)
      .where(and(eq(alertsTable.id, id), eq(alertsTable.tenantId, tenantId)))
      .limit(1);
    if (!a) {
      res.status(404).json({ error: "Alert not found" });
      return;
    }
    if (!canTransitionAlert(a.status, newStatus)) {
      res
        .status(409)
        .json({
          error: `Cannot transition alert from "${a.status}" to "${newStatus}"`,
          allowed: ALERT_TRANSITIONS[a.status] ?? [],
        });
      return;
    }
    const patch: Record<string, unknown> = { status: newStatus };
    if (newStatus === "Acknowledged") {
      patch.acknowledgedAt = new Date();
      patch.acknowledgedBy = req.user!.userId;
    }
    if (newStatus === "Resolved") {
      patch.resolvedAt = new Date();
      patch.resolvedBy = req.user!.userId;
      if (notes) patch.resolutionNotes = notes;
    }
    const [updated] = await db
      .update(alertsTable)
      .set(patch)
      .where(and(eq(alertsTable.id, id), eq(alertsTable.tenantId, tenantId)))
      .returning();
    await recordAlertActivity({
      tenantId,
      alertId: id,
      userId: req.user!.userId,
      action: "status_change",
      fromValue: a.status,
      toValue: newStatus,
      notes,
    });
    await writeAuditLog({
      user: req.user,
      tenantId,
      action: "ALERT_STATUS_CHANGE",
      entityType: "alert",
      entityId: id,
      oldValue: { status: a.status },
      newValue: patch,
      ipAddress: req.ip,
    });
    res.json(updated);
  },
);

router.post(
  "/operations/alerts/:id/assign",
  requireRoles(...RBAC.LEADERSHIP_AND_COORDINATOR),
  async (req, res): Promise<void> => {
    const tenantId = req.user!.tenantId;
    const id = Number(req.params["id"]);
    const newAssignee = Number(req.body.assignedTo);
    if (!newAssignee) {
      res.status(400).json({ error: "assignedTo required" });
      return;
    }
    const [target] = await db
      .select()
      .from(usersTable)
      .where(
        and(eq(usersTable.id, newAssignee), eq(usersTable.tenantId, tenantId)),
      )
      .limit(1);
    if (!target) {
      res.status(400).json({ error: "Assignee not found in tenant" });
      return;
    }
    const [a] = await db
      .select()
      .from(alertsTable)
      .where(and(eq(alertsTable.id, id), eq(alertsTable.tenantId, tenantId)))
      .limit(1);
    if (!a) {
      res.status(404).json({ error: "Alert not found" });
      return;
    }
    const [updated] = await db
      .update(alertsTable)
      .set({ assignedTo: newAssignee })
      .where(and(eq(alertsTable.id, id), eq(alertsTable.tenantId, tenantId)))
      .returning();
    await recordAlertActivity({
      tenantId,
      alertId: id,
      userId: req.user!.userId,
      action: "assigned",
      fromValue: a.assignedTo ? String(a.assignedTo) : null,
      toValue: String(newAssignee),
      notes: req.body.notes ?? null,
    });
    await writeAuditLog({
      user: req.user,
      tenantId,
      action: "ALERT_ASSIGN",
      entityType: "alert",
      entityId: id,
      oldValue: { assignedTo: a.assignedTo },
      newValue: { assignedTo: newAssignee },
      ipAddress: req.ip,
    });
    res.json(updated);
  },
);

router.post(
  "/operations/alerts/:id/escalate",
  requireRoles(...RBAC.LEADERSHIP_AND_COORDINATOR),
  async (req, res): Promise<void> => {
    const tenantId = req.user!.tenantId;
    const id = Number(req.params["id"]);
    const escalateTo = req.body.escalateTo ? Number(req.body.escalateTo) : null;
    const notes = req.body.notes ? String(req.body.notes) : null;
    const [a] = await db
      .select()
      .from(alertsTable)
      .where(and(eq(alertsTable.id, id), eq(alertsTable.tenantId, tenantId)))
      .limit(1);
    if (!a) {
      res.status(404).json({ error: "Alert not found" });
      return;
    }
    if (escalateTo) {
      const [u] = await db
        .select()
        .from(usersTable)
        .where(
          and(eq(usersTable.id, escalateTo), eq(usersTable.tenantId, tenantId)),
        )
        .limit(1);
      if (!u) {
        res.status(400).json({ error: "escalateTo user not in tenant" });
        return;
      }
    }
    const [updated] = await db
      .update(alertsTable)
      .set({
        escalationLevel: a.escalationLevel + 1,
        escalatedAt: new Date(),
        escalatedToUserId: escalateTo,
        severity: a.severity === "Low" ? "Medium" : "High",
      })
      .where(and(eq(alertsTable.id, id), eq(alertsTable.tenantId, tenantId)))
      .returning();
    await recordAlertActivity({
      tenantId,
      alertId: id,
      userId: req.user!.userId,
      action: "escalated",
      fromValue: String(a.escalationLevel),
      toValue: String(a.escalationLevel + 1),
      notes,
    });
    await writeAuditLog({
      user: req.user,
      tenantId,
      action: "ALERT_ESCALATE",
      entityType: "alert",
      entityId: id,
      oldValue: { escalationLevel: a.escalationLevel },
      newValue: {
        escalationLevel: a.escalationLevel + 1,
        escalatedToUserId: escalateTo,
      },
      ipAddress: req.ip,
    });
    res.json(updated);
  },
);

router.post(
  "/operations/alerts/:id/comment",
  requireRoles(...RBAC.LEADERSHIP_AND_COORDINATOR),
  async (req, res): Promise<void> => {
    const tenantId = req.user!.tenantId;
    const id = Number(req.params["id"]);
    const notes = String(req.body.notes ?? "").trim();
    if (!notes) {
      res.status(400).json({ error: "notes required" });
      return;
    }
    const [a] = await db
      .select()
      .from(alertsTable)
      .where(and(eq(alertsTable.id, id), eq(alertsTable.tenantId, tenantId)))
      .limit(1);
    if (!a) {
      res.status(404).json({ error: "Alert not found" });
      return;
    }
    await recordAlertActivity({
      tenantId,
      alertId: id,
      userId: req.user!.userId,
      action: "commented",
      notes,
    });
    res.status(201).json({ ok: true });
  },
);

// ============================================================================
// Follow-ups
// ============================================================================

router.get(
  "/operations/follow-ups",
  requireRoles(...RBAC.ALL_STAFF),
  async (req, res): Promise<void> => {
    const tenantId = req.user!.tenantId;
    const status = String(req.query["status"] ?? "");
    const assignedTo = req.query["assignedTo"]
      ? Number(req.query["assignedTo"])
      : null;
    const studentId = req.query["studentId"]
      ? Number(req.query["studentId"])
      : null;
    const mineOnly = String(req.query["mine"] ?? "") === "true";
    const dueBy = String(req.query["dueBy"] ?? ""); // ISO date string

    const where = [eq(followUpsTable.tenantId, tenantId)];
    if (status) where.push(eq(followUpsTable.status, status));
    if (assignedTo) where.push(eq(followUpsTable.assignedTo, assignedTo));
    if (studentId) where.push(eq(followUpsTable.studentId, studentId));
    if (mineOnly) where.push(eq(followUpsTable.assignedTo, req.user!.userId));
    if (dueBy) where.push(lte(followUpsTable.scheduledFor, new Date(dueBy)));

    const rows = await db
      .select()
      .from(followUpsTable)
      .where(and(...where))
      .orderBy(followUpsTable.scheduledFor);
    // Enrich with user + student names
    const userIds = [
      ...new Set(
        rows.flatMap((r) =>
          [r.assignedTo, r.createdBy, r.completedBy].filter(
            (x): x is number => x !== null,
          ),
        ),
      ),
    ];
    const stuIds = [
      ...new Set(
        rows.map((r) => r.studentId).filter((x): x is number => x !== null),
      ),
    ];
    const [users, students] = await Promise.all([
      userIds.length
        ? db
            .select()
            .from(usersTable)
            .where(
              and(
                eq(usersTable.tenantId, tenantId),
                inArray(usersTable.id, userIds),
              ),
            )
        : [],
      stuIds.length
        ? db
            .select()
            .from(studentsTable)
            .where(
              and(
                eq(studentsTable.tenantId, tenantId),
                inArray(studentsTable.id, stuIds),
              ),
            )
        : [],
    ]);
    const uMap = new Map(users.map((u) => [u.id, u.name]));
    const sMap = new Map(students.map((s) => [s.id, s]));
    const now = new Date();

    const enriched = rows.map((r) => {
      const overdue = r.status === "Pending" && r.scheduledFor < now;
      return {
        ...r,
        assignedToName: r.assignedTo ? (uMap.get(r.assignedTo) ?? null) : null,
        createdByName: r.createdBy ? (uMap.get(r.createdBy) ?? null) : null,
        completedByName: r.completedBy
          ? (uMap.get(r.completedBy) ?? null)
          : null,
        studentName: r.studentId ? (sMap.get(r.studentId)?.name ?? null) : null,
        studentAdmissionNo: r.studentId
          ? (sMap.get(r.studentId)?.admissionNo ?? null)
          : null,
        overdue,
      };
    });
    res.json({ data: enriched, total: enriched.length });
  },
);

router.post(
  "/operations/follow-ups",
  requireRoles(...RBAC.ALL_STAFF),
  async (req, res): Promise<void> => {
    const tenantId = req.user!.tenantId;
    const {
      title,
      notes,
      sourceType,
      sourceId,
      studentId,
      scheduledFor,
      assignedTo,
    } = req.body;
    if (!title || !scheduledFor) {
      res.status(400).json({ error: "title and scheduledFor are required" });
      return;
    }
    if (assignedTo != null) {
      const [u] = await db
        .select()
        .from(usersTable)
        .where(
          and(
            eq(usersTable.id, Number(assignedTo)),
            eq(usersTable.tenantId, tenantId),
          ),
        )
        .limit(1);
      if (!u) {
        res.status(400).json({ error: "assignedTo user not in tenant" });
        return;
      }
    }
    if (studentId != null) {
      const [s] = await db
        .select()
        .from(studentsTable)
        .where(
          and(
            eq(studentsTable.id, Number(studentId)),
            eq(studentsTable.tenantId, tenantId),
          ),
        )
        .limit(1);
      if (!s) {
        res.status(400).json({ error: "studentId not in tenant" });
        return;
      }
    }
    const [created] = await db
      .insert(followUpsTable)
      .values({
        tenantId,
        title: String(title),
        notes: notes ?? null,
        sourceType: sourceType ?? "manual",
        sourceId: sourceId != null ? String(sourceId) : null,
        studentId: studentId ?? null,
        scheduledFor: new Date(scheduledFor),
        assignedTo: assignedTo ?? null,
        createdBy: req.user!.userId,
        status: "Pending",
      })
      .returning();
    await writeAuditLog({
      user: req.user,
      tenantId,
      action: "CREATE",
      entityType: "follow_up",
      entityId: created.id,
      newValue: created,
      ipAddress: req.ip,
    });
    res.status(201).json(created);
  },
);

router.delete(
  "/operations/follow-ups/:id",
  requireRoles(...RBAC.ALL_STAFF),
  async (req, res): Promise<void> => {
    const tenantId = req.user!.tenantId;
    const id = Number(req.params["id"]);
    const [existing] = await db
      .select()
      .from(followUpsTable)
      .where(
        and(eq(followUpsTable.id, id), eq(followUpsTable.tenantId, tenantId)),
      )
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Follow-up not found" });
      return;
    }
    await db
      .delete(followUpsTable)
      .where(
        and(eq(followUpsTable.id, id), eq(followUpsTable.tenantId, tenantId)),
      );
    await writeAuditLog({
      user: req.user,
      tenantId,
      action: "DELETE",
      entityType: "follow_up",
      entityId: id,
      oldValue: existing,
      ipAddress: req.ip,
    });
    res.status(204).end();
  },
);

router.patch(
  "/operations/follow-ups/:id",
  requireRoles(...RBAC.ALL_STAFF),
  async (req, res): Promise<void> => {
    const tenantId = req.user!.tenantId;
    const id = Number(req.params["id"]);
    const [existing] = await db
      .select()
      .from(followUpsTable)
      .where(
        and(eq(followUpsTable.id, id), eq(followUpsTable.tenantId, tenantId)),
      )
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Follow-up not found" });
      return;
    }
    if (req.body.assignedTo != null) {
      const [u] = await db
        .select()
        .from(usersTable)
        .where(
          and(
            eq(usersTable.id, Number(req.body.assignedTo)),
            eq(usersTable.tenantId, tenantId),
          ),
        )
        .limit(1);
      if (!u) {
        res.status(400).json({ error: "assignedTo user not in tenant" });
        return;
      }
    }
    const patch: Record<string, unknown> = {};
    for (const k of ["title", "notes", "assignedTo", "outcome"] as const) {
      if (req.body[k] !== undefined) patch[k] = req.body[k];
    }
    if (req.body.scheduledFor)
      patch.scheduledFor = new Date(req.body.scheduledFor);
    if (req.body.status) {
      const s = String(req.body.status);
      if (!["Pending", "Done", "Skipped"].includes(s)) {
        res.status(400).json({ error: "Invalid status" });
        return;
      }
      patch.status = s;
      if (s === "Done" || s === "Skipped") {
        patch.completedAt = new Date();
        patch.completedBy = req.user!.userId;
      }
    }
    const [updated] = await db
      .update(followUpsTable)
      .set(patch)
      .where(
        and(eq(followUpsTable.id, id), eq(followUpsTable.tenantId, tenantId)),
      )
      .returning();
    await writeAuditLog({
      user: req.user,
      tenantId,
      action: "UPDATE",
      entityType: "follow_up",
      entityId: id,
      oldValue: existing,
      newValue: patch,
      ipAddress: req.ip,
    });
    res.json(updated);
  },
);

// ============================================================================
// SLA policies
// ============================================================================

router.get(
  "/operations/sla/policies",
  requireRoles(...RBAC.LEADERSHIP),
  async (req, res): Promise<void> => {
    const tenantId = req.user!.tenantId;
    const rows = await db
      .select()
      .from(slaPoliciesTable)
      .where(eq(slaPoliciesTable.tenantId, tenantId))
      .orderBy(slaPoliciesTable.scope, slaPoliciesTable.matchKey);
    res.json({
      data: rows,
      defaults: { task: DEFAULT_TASK_SLA, alert: DEFAULT_ALERT_SLA },
    });
  },
);

router.post(
  "/operations/sla/policies",
  requireRoles(...RBAC.LEADERSHIP),
  async (req, res): Promise<void> => {
    const tenantId = req.user!.tenantId;
    const {
      scope,
      matchKey,
      hoursToResolve,
      hoursToEscalate,
      escalateToRole,
      isActive,
    } = req.body;
    if (!scope || !matchKey || !hoursToResolve) {
      res
        .status(400)
        .json({ error: "scope, matchKey, hoursToResolve required" });
      return;
    }
    if (!["task", "alert"].includes(scope)) {
      res.status(400).json({ error: "scope must be 'task' or 'alert'" });
      return;
    }
    // Upsert: if a policy exists for (tenant, scope, key), update it.
    const existing = await db
      .select()
      .from(slaPoliciesTable)
      .where(
        and(
          eq(slaPoliciesTable.tenantId, tenantId),
          eq(slaPoliciesTable.scope, scope),
          eq(slaPoliciesTable.matchKey, matchKey),
        ),
      )
      .limit(1);
    if (existing[0]) {
      const [updated] = await db
        .update(slaPoliciesTable)
        .set({
          hoursToResolve: Number(hoursToResolve),
          hoursToEscalate:
            hoursToEscalate != null ? Number(hoursToEscalate) : null,
          escalateToRole: escalateToRole ?? null,
          isActive: isActive ?? true,
        })
        .where(eq(slaPoliciesTable.id, existing[0].id))
        .returning();
      res.json(updated);
      return;
    }
    const [created] = await db
      .insert(slaPoliciesTable)
      .values({
        tenantId,
        scope,
        matchKey,
        hoursToResolve: Number(hoursToResolve),
        hoursToEscalate:
          hoursToEscalate != null ? Number(hoursToEscalate) : null,
        escalateToRole: escalateToRole ?? null,
        isActive: isActive ?? true,
      })
      .returning();
    res.status(201).json(created);
  },
);

// ============================================================================
// SLA engine: compute breaches + return summary; also marks slaBreachedAt
// ============================================================================

router.get(
  "/operations/sla/status",
  requireRoles(...RBAC.LEADERSHIP_AND_COORDINATOR),
  async (req, res): Promise<void> => {
    const tenantId = req.user!.tenantId;
    const openTasks = await db
      .select()
      .from(tasksTable)
      .where(
        and(
          eq(tasksTable.tenantId, tenantId),
          sql`${tasksTable.status} NOT IN ('Done','Completed','Cancelled')`,
        ),
      );
    const openAlerts = await db
      .select()
      .from(alertsTable)
      .where(
        and(
          eq(alertsTable.tenantId, tenantId),
          sql`${alertsTable.status} NOT IN ('Resolved','Dismissed')`,
        ),
      );

    let breachedTasks = 0,
      breachedAlerts = 0,
      atRiskTasks = 0,
      atRiskAlerts = 0;
    const breachedRows: Array<{
      scope: "task" | "alert";
      id: number;
      title: string;
      severity?: string;
      priority?: string;
      status: string;
      hoursOver: number;
      dueAt: string | null;
      assignedTo: number | null;
    }> = [];
    const taskBreachIdsToMark: number[] = [];
    const alertBreachIdsToMark: number[] = [];

    for (const t of openTasks) {
      const slaHours =
        t.slaHours ?? (await resolveSlaHours(tenantId, "task", t.priority));
      const sla = computeBreachStatus(t.createdAt, slaHours, false);
      if (sla.breached) {
        breachedTasks++;
        breachedRows.push({
          scope: "task",
          id: t.id,
          title: t.title,
          priority: t.priority,
          status: t.status,
          hoursOver: Math.round(sla.hoursOver * 10) / 10,
          dueAt: sla.dueAt?.toISOString() ?? null,
          assignedTo: t.assignedTo,
        });
        if (!t.slaBreachedAt) taskBreachIdsToMark.push(t.id);
      } else if (sla.dueAt) {
        const hLeft = hoursBetween(sla.dueAt, new Date());
        if (hLeft > 0 && hLeft <= 4) atRiskTasks++;
      }
    }
    for (const a of openAlerts) {
      const slaHours =
        a.slaHours ?? (await resolveSlaHours(tenantId, "alert", a.severity));
      const sla = computeBreachStatus(a.createdAt, slaHours, false);
      if (sla.breached) {
        breachedAlerts++;
        breachedRows.push({
          scope: "alert",
          id: a.id,
          title: a.alertType,
          severity: a.severity,
          status: a.status,
          hoursOver: Math.round(sla.hoursOver * 10) / 10,
          dueAt: sla.dueAt?.toISOString() ?? null,
          assignedTo: a.assignedTo,
        });
        if (!a.slaBreachedAt) alertBreachIdsToMark.push(a.id);
      } else if (sla.dueAt) {
        const hLeft = hoursBetween(sla.dueAt, new Date());
        if (hLeft > 0 && hLeft <= 4) atRiskAlerts++;
      }
    }

    // Mark newly breached
    const now = new Date();
    if (taskBreachIdsToMark.length) {
      await db
        .update(tasksTable)
        .set({ slaBreachedAt: now })
        .where(
          and(
            eq(tasksTable.tenantId, tenantId),
            inArray(tasksTable.id, taskBreachIdsToMark),
          ),
        );
      for (const id of taskBreachIdsToMark) {
        await recordTaskActivity({
          tenantId,
          taskId: id,
          userId: req.user!.userId,
          action: "sla_breached",
          notes: "Automatically flagged by SLA engine",
        });
      }
    }
    if (alertBreachIdsToMark.length) {
      await db
        .update(alertsTable)
        .set({ slaBreachedAt: now })
        .where(
          and(
            eq(alertsTable.tenantId, tenantId),
            inArray(alertsTable.id, alertBreachIdsToMark),
          ),
        );
      for (const id of alertBreachIdsToMark) {
        await recordAlertActivity({
          tenantId,
          alertId: id,
          userId: req.user!.userId,
          action: "sla_breached",
          notes: "Automatically flagged by SLA engine",
        });
      }
    }

    res.json({
      summary: {
        openTasks: openTasks.length,
        openAlerts: openAlerts.length,
        breachedTasks,
        breachedAlerts,
        atRiskTasks,
        atRiskAlerts,
        newlyFlagged: taskBreachIdsToMark.length + alertBreachIdsToMark.length,
      },
      breached: breachedRows.sort((a, b) => b.hoursOver - a.hoursOver),
    });
  },
);

// ============================================================================
// Accountability dashboard
// ============================================================================

router.get(
  "/operations/accountability",
  requireRoles(...RBAC.LEADERSHIP_AND_COORDINATOR),
  async (req, res): Promise<void> => {
    const tenantId = req.user!.tenantId;
    const [tasks, alerts, followUps, users] = await Promise.all([
      db.select().from(tasksTable).where(eq(tasksTable.tenantId, tenantId)),
      db.select().from(alertsTable).where(eq(alertsTable.tenantId, tenantId)),
      db
        .select()
        .from(followUpsTable)
        .where(eq(followUpsTable.tenantId, tenantId)),
      db.select().from(usersTable).where(eq(usersTable.tenantId, tenantId)),
    ]);
    const uMap = new Map(users.map((u) => [u.id, u.name]));
    const now = new Date();

    // Per-owner metrics
    const owners: Record<
      number,
      {
        userId: number;
        userName: string;
        openTasks: number;
        doneTasks: number;
        breachedTasks: number;
        avgResolutionHours: number;
        openAlerts: number;
        resolvedAlerts: number;
        breachedAlerts: number;
        pendingFollowUps: number;
        overdueFollowUps: number;
      }
    > = {};

    function ensureOwner(uid: number | null) {
      if (uid == null) return null;
      if (!owners[uid]) {
        owners[uid] = {
          userId: uid,
          userName: uMap.get(uid) ?? `User ${uid}`,
          openTasks: 0,
          doneTasks: 0,
          breachedTasks: 0,
          avgResolutionHours: 0,
          openAlerts: 0,
          resolvedAlerts: 0,
          breachedAlerts: 0,
          pendingFollowUps: 0,
          overdueFollowUps: 0,
        };
      }
      return owners[uid];
    }

    const resolutionByOwner: Record<number, number[]> = {};

    for (const t of tasks) {
      const o = ensureOwner(t.assignedTo);
      if (!o) continue;
      const terminal = isTerminalTask(t.status);
      if (terminal) {
        if (t.status === "Done" || t.status === "Completed") o.doneTasks++;
        if (t.completedAt) {
          const hrs = hoursBetween(t.completedAt, t.createdAt);
          resolutionByOwner[o.userId] = resolutionByOwner[o.userId] ?? [];
          resolutionByOwner[o.userId]!.push(hrs);
        }
      } else {
        o.openTasks++;
        const slaHours =
          t.slaHours ?? (await resolveSlaHours(tenantId, "task", t.priority));
        const dueAt = new Date(t.createdAt.getTime() + slaHours * 36e5);
        if (now > dueAt) o.breachedTasks++;
      }
    }
    for (const a of alerts) {
      const o = ensureOwner(a.assignedTo);
      if (!o) continue;
      if (a.status === "Resolved") o.resolvedAlerts++;
      else if (a.status !== "Dismissed") {
        o.openAlerts++;
        const slaHours =
          a.slaHours ?? (await resolveSlaHours(tenantId, "alert", a.severity));
        const dueAt = new Date(a.createdAt.getTime() + slaHours * 36e5);
        if (now > dueAt) o.breachedAlerts++;
      }
    }
    for (const f of followUps) {
      const o = ensureOwner(f.assignedTo);
      if (!o) continue;
      if (f.status === "Pending") {
        o.pendingFollowUps++;
        if (f.scheduledFor < now) o.overdueFollowUps++;
      }
    }
    for (const o of Object.values(owners)) {
      const arr = resolutionByOwner[o.userId];
      o.avgResolutionHours =
        arr && arr.length
          ? Math.round((arr.reduce((s, n) => s + n, 0) / arr.length) * 10) / 10
          : 0;
    }

    // Global MTTR
    const allRes = Object.values(resolutionByOwner).flat();
    const mttrHours = allRes.length
      ? Math.round((allRes.reduce((s, n) => s + n, 0) / allRes.length) * 10) /
        10
      : 0;

    // Unassigned counts (everyone should care)
    const unassignedTasks = tasks.filter(
      (t) => t.assignedTo === null && !isTerminalTask(t.status),
    ).length;
    const unassignedAlerts = alerts.filter(
      (a) =>
        a.assignedTo === null &&
        a.status !== "Resolved" &&
        a.status !== "Dismissed",
    ).length;

    res.json({
      global: {
        totalTasks: tasks.length,
        totalAlerts: alerts.length,
        totalFollowUps: followUps.length,
        mttrHours,
        unassignedTasks,
        unassignedAlerts,
      },
      owners: Object.values(owners).sort(
        (a, b) =>
          b.breachedTasks +
          b.breachedAlerts -
          (a.breachedTasks + a.breachedAlerts),
      ),
    });
  },
);

// silence unused imports
void isNull;
void isNotNull;
void gte;

export default router;
