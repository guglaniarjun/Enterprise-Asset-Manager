import type { Request } from "express";
import { ROLES } from "../middlewares/requireRoles";

export function getRoleNames(req: Request): string[] {
  return req.user?.roles.map((r) => r.roleName) ?? [];
}

const PRIVILEGED_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.TENANT_ADMIN,
  ROLES.DIRECTOR,
  ROLES.PRINCIPAL,
] as readonly string[];

/** Admins, Director, Principal — full tenant scope. */
export function isPrivileged(req: Request): boolean {
  return getRoleNames(req).some((r) => PRIVILEGED_ROLES.includes(r));
}

/** Coordinator role (regardless of other roles). */
export function isCoordinator(req: Request): boolean {
  return getRoleNames(req).includes(ROLES.COORDINATOR);
}

/** Teacher-only (not also coordinator/leadership). */
export function isTeacherOnly(req: Request): boolean {
  const names = getRoleNames(req);
  if (!names.includes(ROLES.TEACHER)) return false;
  return !names.some(
    (r) =>
      PRIVILEGED_ROLES.includes(r) || r === ROLES.COORDINATOR,
  );
}
