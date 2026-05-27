import { db, auditLogsTable } from "@workspace/db";
import type { JwtPayload } from "./auth";

export async function writeAuditLog(params: {
  user?: JwtPayload;
  tenantId: number;
  action: string;
  entityType: string;
  entityId?: string | number;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
}): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      tenantId: params.tenantId,
      userId: params.user?.userId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId != null ? String(params.entityId) : null,
      oldValue: params.oldValue as Record<string, unknown> ?? null,
      newValue: params.newValue as Record<string, unknown> ?? null,
      ipAddress: params.ipAddress ?? null,
    });
  } catch {
    // audit log failures must not break main request flow
  }
}
