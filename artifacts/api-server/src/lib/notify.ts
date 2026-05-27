import { eq, and, inArray, or, isNull } from "drizzle-orm";
import {
  db,
  notificationsTable,
  userRolesTable,
  rolesTable,
} from "@workspace/db";

export async function sendInAppNotification(params: {
  tenantId: number;
  userId: number;
  title: string;
  body: string;
  type?: string;
  relatedEntityType?: string;
  relatedEntityId?: string | number;
}): Promise<void> {
  try {
    await db.insert(notificationsTable).values({
      tenantId: params.tenantId,
      userId: params.userId,
      title: params.title,
      body: params.body,
      type: params.type ?? "info",
      relatedEntityType: params.relatedEntityType ?? null,
      relatedEntityId:
        params.relatedEntityId != null ? String(params.relatedEntityId) : null,
    });
  } catch {
    // notification failures must not break main request flow
  }
}

export async function notifyRolesInBranch(params: {
  tenantId: number;
  branchId: number;
  roleNames: string[];
  title: string;
  body: string;
  type?: string;
  relatedEntityType?: string;
  relatedEntityId?: string | number;
}): Promise<void> {
  try {
    const recipients = await db
      .select({ userId: userRolesTable.userId })
      .from(userRolesTable)
      .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
      .where(
        and(
          eq(userRolesTable.tenantId, params.tenantId),
          inArray(rolesTable.name, params.roleNames),
          or(
            eq(userRolesTable.branchId, params.branchId),
            isNull(userRolesTable.branchId),
          ),
        ),
      );
    const uniqueUserIds = Array.from(new Set(recipients.map((r) => r.userId)));
    await Promise.all(
      uniqueUserIds.map((userId) =>
        sendInAppNotification({
          tenantId: params.tenantId,
          userId,
          title: params.title,
          body: params.body,
          type: params.type,
          relatedEntityType: params.relatedEntityType,
          relatedEntityId: params.relatedEntityId,
        }),
      ),
    );
  } catch {
    // never break main request flow
  }
}
