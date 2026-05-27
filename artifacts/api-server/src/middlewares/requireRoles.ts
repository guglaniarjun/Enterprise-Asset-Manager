import { Request, Response, NextFunction } from "express";

export function requireRoles(...roleNames: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const userRoleNames = req.user.roles.map((r) => r.roleName);
    const hasRole = roleNames.some((role) => userRoleNames.includes(role));
    if (!hasRole) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}

export const ROLES = {
  SUPER_ADMIN: "Super Admin",
  TENANT_ADMIN: "Tenant Admin",
  DIRECTOR: "Director",
  PRINCIPAL: "Principal",
  COORDINATOR: "Coordinator",
  TEACHER: "Teacher",
  VIEWER: "Viewer",
} as const;
