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

/**
 * TODO(coordinator-scope): Implement class/section/subject-scoped Coordinator authorization.
 *
 * Today `isCoordinator()` is a binary check — once true, the coordinator has
 * tenant-wide visibility identical to Principal. The product intent is for a
 * Coordinator to only see/act on the classes, sections, or subjects they
 * supervise (e.g. "Coordinator for Grades 6–8" or "Science Coordinator").
 *
 * Design sketch (do NOT implement until Phase E):
 *   1. Add `coordinator_scopes` table: (id, tenantId, userId, scopeType, scopeId, isActive)
 *      where scopeType ∈ {"class", "section", "subject", "branch"}.
 *   2. Add helper `getCoordinatorScope(req)` returning `{ classIds, sectionIds, subjectIds, branchIds }`
 *      (empty arrays => unscoped / tenant-wide, for backward compat with current seed data).
 *   3. In list routes (logs, events, syllabus, dashboards, KPI, operations),
 *      when `isCoordinator(req) && !isPrivileged(req)`, filter results by
 *      the union of scope ids.
 *   4. In write routes (verify/reject log, resolve event, escalate alert),
 *      reject with 403 if the target entity falls outside the coordinator's scope.
 *   5. UI: Add a "Coordinator scopes" tab in user management for Tenant Admin
 *      to assign scopes; display the active scope chips in the AppShell header.
 *
 * Until this is implemented, all coordinators have tenant-wide reach. This is
 * acceptable for the current single-tenant Springfield demo but MUST be
 * tightened before onboarding a second tenant with multiple coordinators.
 */

/** Teacher-only (not also coordinator/leadership). */
export function isTeacherOnly(req: Request): boolean {
  const names = getRoleNames(req);
  if (!names.includes(ROLES.TEACHER)) return false;
  return !names.some(
    (r) => PRIVILEGED_ROLES.includes(r) || r === ROLES.COORDINATOR,
  );
}
