import { Router, type IRouter } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db, usersTable, userRolesTable, rolesTable, refreshTokensTable } from "@workspace/db";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashPassword,
  comparePassword,
  hashToken,
  refreshExpiresAt,
} from "../lib/auth";
import { authenticate } from "../middlewares/authenticate";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (!user || !user.isActive) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const userRoles = await db
    .select({ roleId: userRolesTable.roleId, roleName: rolesTable.name, branchId: userRolesTable.branchId })
    .from(userRolesTable)
    .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
    .where(eq(userRolesTable.userId, user.id));

  const payload = {
    userId: user.id,
    tenantId: user.tenantId,
    email: user.email,
    roles: userRoles.map((r) => ({ roleId: r.roleId, roleName: r.roleName, branchId: r.branchId ?? null })),
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken({ userId: user.id, tenantId: user.tenantId });

  await db.insert(refreshTokensTable).values({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: refreshExpiresAt(),
  });

  req.log.info({ userId: user.id }, "User logged in");

  res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      phone: user.phone ?? null,
      isActive: user.isActive,
      forcePasswordChange: user.forcePasswordChange,
      roles: payload.roles,
      createdAt: user.createdAt,
    },
  });
});

router.post("/auth/refresh", async (req, res): Promise<void> => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ error: "Refresh token required" });
    return;
  }

  let decoded: { userId: number; tenantId: number };
  try {
    decoded = verifyRefreshToken(refreshToken) as { userId: number; tenantId: number };
  } catch {
    res.status(401).json({ error: "Invalid refresh token" });
    return;
  }

  const tokenHash = hashToken(refreshToken);
  const [stored] = await db
    .select()
    .from(refreshTokensTable)
    .where(and(eq(refreshTokensTable.tokenHash, tokenHash), isNull(refreshTokensTable.revokedAt)))
    .limit(1);

  if (!stored || stored.expiresAt < new Date()) {
    res.status(401).json({ error: "Refresh token invalid or expired" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, decoded.userId)).limit(1);
  if (!user || !user.isActive) {
    res.status(401).json({ error: "User not found or inactive" });
    return;
  }

  const userRoles = await db
    .select({ roleId: userRolesTable.roleId, roleName: rolesTable.name, branchId: userRolesTable.branchId })
    .from(userRolesTable)
    .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
    .where(eq(userRolesTable.userId, user.id));

  const accessToken = signAccessToken({
    userId: user.id,
    tenantId: user.tenantId,
    email: user.email,
    roles: userRoles.map((r) => ({ roleId: r.roleId, roleName: r.roleName, branchId: r.branchId ?? null })),
  });

  res.json({ accessToken });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    const tokenHash = hashToken(refreshToken);
    await db
      .update(refreshTokensTable)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokensTable.tokenHash, tokenHash));
  }
  res.json({ message: "Logged out successfully" });
});

router.get("/auth/me", authenticate, async (req, res): Promise<void> => {
  const user = req.user!;
  const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.userId)).limit(1);
  if (!dbUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const userRoles = await db
    .select({ roleId: userRolesTable.roleId, roleName: rolesTable.name, branchId: userRolesTable.branchId })
    .from(userRolesTable)
    .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
    .where(eq(userRolesTable.userId, dbUser.id));

  res.json({
    id: dbUser.id,
    tenantId: dbUser.tenantId,
    email: dbUser.email,
    name: dbUser.name,
    phone: dbUser.phone ?? null,
    isActive: dbUser.isActive,
    forcePasswordChange: dbUser.forcePasswordChange,
    roles: userRoles.map((r) => ({ roleId: r.roleId, roleName: r.roleName, branchId: r.branchId ?? null })),
    createdAt: dbUser.createdAt,
  });
});

export default router;
