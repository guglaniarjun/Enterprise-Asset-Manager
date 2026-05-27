import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, ocrUploadsTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireTenant } from "../middlewares/requireTenant";
import { requireRoles } from "../middlewares/requireRoles";
import { RBAC } from "../lib/rbac";
import { writeAuditLog } from "../lib/audit";

const router: IRouter = Router();
router.use(authenticate);
router.use(requireTenant);

function mockOcrExtract(filename: string): Record<string, string> {
  return {
    date: new Date().toISOString().slice(0, 10),
    topicTaught: "Extracted from: " + filename,
    teachingMethod: "Lecture",
    homeworkGiven: "false",
    remarks: "OCR mock extraction complete. Please review and correct.",
  };
}

router.post(
  "/ocr/upload",
  requireRoles(...RBAC.ALL_STAFF),
  async (req, res): Promise<void> => {
    const { filename, storagePath, mimeType } = req.body;
    if (!filename || !storagePath || !mimeType) {
      res
        .status(400)
        .json({ error: "filename, storagePath, mimeType required" });
      return;
    }
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;

    const [upload] = await db
      .insert(ocrUploadsTable)
      .values({
        tenantId,
        userId,
        filename,
        storagePath,
        mimeType,
        ocrProvider: "mock",
        status: "Processing",
      })
      .returning();

    const extracted = mockOcrExtract(filename);
    const [updated] = await db
      .update(ocrUploadsTable)
      .set({
        ocrRawOutput: JSON.stringify(extracted),
        extractedFields: JSON.stringify(extracted),
        status: "Done",
      })
      .where(
        and(
          eq(ocrUploadsTable.id, upload.id),
          eq(ocrUploadsTable.tenantId, tenantId),
        ),
      )
      .returning();

    await writeAuditLog({
      user: req.user,
      tenantId,
      action: "CREATE",
      entityType: "ocr_upload",
      entityId: upload.id,
      newValue: { filename, mimeType },
      ipAddress: req.ip,
    });

    res.status(201).json({
      id: updated.id,
      filename: updated.filename,
      status: updated.status,
      extractedFields: JSON.parse(updated.extractedFields ?? "{}"),
      createdAt: updated.createdAt,
    });
  },
);

router.get(
  "/ocr/:id",
  requireRoles(...RBAC.ALL_STAFF),
  async (req, res): Promise<void> => {
    const id = parseInt(
      Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
      10,
    );
    const tenantId = req.user!.tenantId;
    const [upload] = await db
      .select()
      .from(ocrUploadsTable)
      .where(
        and(eq(ocrUploadsTable.id, id), eq(ocrUploadsTable.tenantId, tenantId)),
      )
      .limit(1);
    if (!upload) {
      res.status(404).json({ error: "Upload not found" });
      return;
    }
    res.json({
      id: upload.id,
      filename: upload.filename,
      status: upload.status,
      extractedFields: upload.extractedFields
        ? JSON.parse(upload.extractedFields)
        : null,
      createdAt: upload.createdAt,
    });
  },
);

export default router;
