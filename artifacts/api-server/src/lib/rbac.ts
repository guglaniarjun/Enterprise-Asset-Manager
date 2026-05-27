import { ROLES } from "../middlewares/requireRoles";

/**
 * Central RBAC matrix. Single source of truth for which role-groups
 * are allowed to hit a given endpoint. Use with `requireRoles(...)`:
 *
 *   router.get("/foo", requireRoles(...RBAC.ALL_STAFF), handler);
 *
 * Group definitions
 * - TENANT_ADMIN: platform & tenant administrators only
 * - ADMIN_AND_PRINCIPAL: school configuration (classes, sections, etc.)
 * - LEADERSHIP: read access to school-wide monitoring data
 * - LEADERSHIP_AND_COORDINATOR: verification authority + leadership
 * - ALL_STAFF: anyone who works in the school (incl. teachers)
 * - ALL_AUTHENTICATED: any signed-in user (incl. viewers)
 */
export const RBAC = {
  TENANT_ADMIN: [ROLES.SUPER_ADMIN, ROLES.TENANT_ADMIN] as string[],
  ADMIN_AND_PRINCIPAL: [
    ROLES.SUPER_ADMIN,
    ROLES.TENANT_ADMIN,
    ROLES.PRINCIPAL,
  ] as string[],
  LEADERSHIP: [
    ROLES.SUPER_ADMIN,
    ROLES.TENANT_ADMIN,
    ROLES.DIRECTOR,
    ROLES.PRINCIPAL,
  ] as string[],
  LEADERSHIP_AND_COORDINATOR: [
    ROLES.SUPER_ADMIN,
    ROLES.TENANT_ADMIN,
    ROLES.DIRECTOR,
    ROLES.PRINCIPAL,
    ROLES.COORDINATOR,
  ] as string[],
  ALL_STAFF: [
    ROLES.SUPER_ADMIN,
    ROLES.TENANT_ADMIN,
    ROLES.DIRECTOR,
    ROLES.PRINCIPAL,
    ROLES.COORDINATOR,
    ROLES.TEACHER,
  ] as string[],
  ALL_AUTHENTICATED: [
    ROLES.SUPER_ADMIN,
    ROLES.TENANT_ADMIN,
    ROLES.DIRECTOR,
    ROLES.PRINCIPAL,
    ROLES.COORDINATOR,
    ROLES.TEACHER,
    ROLES.VIEWER,
  ] as string[],
} as const;
