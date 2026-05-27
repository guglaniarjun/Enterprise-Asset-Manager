import { Request, Response, NextFunction } from "express";

/**
 * Tenant isolation guard. Must be mounted after `authenticate`.
 *
 * - Rejects requests where the JWT does not carry a numeric `tenantId`
 *   (defense against malformed / forged / cross-tenant tokens).
 * - Exposes the verified `tenantId` on `res.locals.tenantId` so route
 *   handlers can use it without re-reading the JWT.
 *
 * This is belt-and-suspenders: route handlers still filter their DB
 * queries by `tenantId`, but if any handler ever forgets, the request
 * cannot proceed without an authenticated tenant context.
 */
export function requireTenant(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const tenantId = req.user.tenantId;
  if (typeof tenantId !== "number" || !Number.isFinite(tenantId) || tenantId <= 0) {
    res.status(403).json({ error: "Tenant context missing or invalid" });
    return;
  }
  res.locals.tenantId = tenantId;
  next();
}
