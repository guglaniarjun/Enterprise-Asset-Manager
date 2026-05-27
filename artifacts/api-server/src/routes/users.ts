import { Router, type IRouter } from "express";
import { eq, and, ilike, count, sql } from "drizzle-orm";
import { db, usersTable, userRolesTable, rolesTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireTenant } from "../middlewares/requireTenant";
import { requireRoles, ROLES } from "../middlewares/requireRoles";
import { RBAC } from "../lib/rbac";
import { hashPassword } from "../lib/auth";
import { writeAuditLog } from "../lib/audit";

const router: IRouter = Router();

router.use(authenticate);
router.use(requireTenant);

async function getUserWithRoles(userId: number) {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!user) return null;
  const roles = await db
    .select({
      roleId: userRolesTable.roleId,
      roleName: rolesTable.name,
      branchId: userRolesTable.branchId,
    })
    .from(userRolesTable)
    .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
    .where(eq(userRolesTable.userId, userId));
  return {
    ...user,
    roles: roles.map((r) => ({
      roleId: r.roleId,
      roleName: r.roleName,
      branchId: r.branchId ?? null,
    })),
  };
}

router.get(
  "/users",
  requireRoles(...RBAC.LEADERSHIP),
  async (req, res): Promise<void> => {
    const page = parseInt(String(req.query.page ?? 1), 10);
    const limit = parseInt(String(req.query.limit ?? 50), 10);
    const search = String(req.query.search ?? "");
    const offset = (page - 1) * limit;

    const tenantId = req.user!.tenantId;

    const where = search
      ? and(
          eq(usersTable.tenantId, tenantId),
          ilike(usersTable.name, `%${search}%`),
        )
      : eq(usersTable.tenantId, tenantId);

    const [{ total }] = await db
      .select({ total: count() })
      .from(usersTable)
      .where(where);
    const users = await db
      .select()
      .from(usersTable)
      .where(where)
      .limit(limit)
      .offset(offset)
      .orderBy(usersTable.name);

    const usersWithRoles = await Promise.all(
      users.map((u) => getUserWithRoles(u.id)),
    );

    res.json({
      data: usersWithRoles.filter(Boolean),
      pagination: {
        page,
        limit,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / limit),
      },
    });
  },
);

router.post(
  "/users",
  requireRoles(...RBAC.TENANT_ADMIN),
  async (req, res): Promise<void> => {
    const { email, password, name, phone } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ error: "Email, password, and name are required" });
      return;
    }

    const tenantId = req.user!.tenantId;
    const passwordHash = await hashPassword(password);

    const [existing] = await db
      .select()
      .from(usersTable)
      .where(
        and(
          eq(usersTable.tenantId, tenantId),
          eq(usersTable.email, email.toLowerCase()),
        ),
      )
      .limit(1);
    if (existing) {
      res.status(409).json({ error: "User with this email already exists" });
      return;
    }

    const [user] = await db
      .insert(usersTable)
      .values({
        tenantId,
        email: email.toLowerCase(),
        passwordHash,
        name,
        phone: phone ?? null,
      })
      .returning();

    await writeAuditLog({
      user: req.user,
      tenantId,
      action: "CREATE",
      entityType: "user",
      entityId: user.id,
      newValue: { email, name },
      ipAddress: req.ip,
    });

    const result = await getUserWithRoles(user.id);
    res.status(201).json(result);
  },
);

router.get(
  "/users/:id",
  requireRoles(...RBAC.LEADERSHIP),
  async (req, res): Promise<void> => {
    const id = parseInt(
      Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
      10,
    );
    const tenantId = req.user!.tenantId;

    const result = await getUserWithRoles(id);
    if (!result || result.tenantId !== tenantId) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(result);
  },
);

router.patch(
  "/users/:id",
  requireRoles(...RBAC.TENANT_ADMIN),
  async (req, res): Promise<void> => {
    const id = parseInt(
      Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
      10,
    );
    const tenantId = req.user!.tenantId;
    const { name, phone, isActive } = req.body;

    const [existing] = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.id, id), eq(usersTable.tenantId, tenantId)))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (isActive !== undefined) updates.isActive = isActive;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db
      .update(usersTable)
      .set(updates as any)
      .where(and(eq(usersTable.id, id), eq(usersTable.tenantId, tenantId)));
    await writeAuditLog({
      user: req.user,
      tenantId,
      action: "UPDATE",
      entityType: "user",
      entityId: id,
      oldValue: existing,
      newValue: updates,
      ipAddress: req.ip,
    });

    const result = await getUserWithRoles(id);
    res.json(result);
  },
);

router.post(
  "/users/:id/roles",
  requireRoles(...RBAC.TENANT_ADMIN),
  async (req, res): Promise<void> => {
    const userId = parseInt(
      Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
      10,
    );
    const tenantId = req.user!.tenantId;
    const { roleId, branchId } = req.body;

    if (!roleId) {
      res.status(400).json({ error: "roleId required" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.id, userId), eq(usersTable.tenantId, tenantId)))
      .limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    await db
      .insert(userRolesTable)
      .values({ userId, roleId, tenantId, branchId: branchId ?? null })
      .onConflictDoNothing();
    await writeAuditLog({
      user: req.user,
      tenantId,
      action: "ASSIGN_ROLE",
      entityType: "user",
      entityId: userId,
      newValue: { roleId, branchId: branchId ?? null },
      ipAddress: req.ip,
    });
    res.status(201).json({ message: "Role assigned" });
  },
);

export default router;
