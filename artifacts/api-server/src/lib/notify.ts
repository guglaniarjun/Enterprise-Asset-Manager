import { db, notificationsTable } from "@workspace/db";

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
      relatedEntityId: params.relatedEntityId != null ? String(params.relatedEntityId) : null,
    });
  } catch {
    // notification failures must not break main request flow
  }
}
