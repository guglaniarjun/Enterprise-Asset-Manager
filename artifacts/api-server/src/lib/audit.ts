import { db, auditLogsTable } from "@workspace/db";
import type { JwtPayload } from "./auth";

// Infer the transaction handle type from db.transaction's callback parameter.
// This stays in sync with the real Drizzle types without us having to name
// the underlying schema / driver generics.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbOrTx = typeof db | Tx;

export async function writeAuditLog(params: {
  user?: JwtPayload;
  tenantId: number;
  action: string;
  entityType: string;
  entityId?: string | number;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  /**
   * Optional Drizzle transaction handle. When provided, the audit insert is
   * enrolled in the transaction AND errors are re-thrown so the outer
   * transaction rolls back together with the audit failure. This guarantees
   * "audit row exists iff main write commits" for transactional callers.
   *
   * When omitted, audit errors are swallowed (best-effort logging) so a flaky
   * audit table never breaks a user-facing flow.
   */
  tx?: DbOrTx;
}): Promise<void> {
  const inTx = params.tx !== undefined;
  const client = (params.tx ?? db) as typeof db;
  try {
    await client.insert(auditLogsTable).values({
      tenantId: params.tenantId,
      userId: params.user?.userId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId != null ? String(params.entityId) : null,
      oldValue: (params.oldValue as Record<string, unknown>) ?? null,
      newValue: (params.newValue as Record<string, unknown>) ?? null,
      ipAddress: params.ipAddress ?? null,
    });
  } catch (err) {
    if (inTx) throw err;
    // best-effort: audit log failures must not break main request flow
  }
}
