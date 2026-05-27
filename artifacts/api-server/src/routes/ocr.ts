import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, ocrUploadsTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";

const router: IRouter = Router();
router.use(authenticate);

function mockOcrExtract(filename: string): Record<string, string> {
  return {
    date: new Date().toISOString().slice(0, 10),
    topicTaught: "Extracted from: " + filename,
    teachingMethod: "Lecture",
    homeworkGiven: "false",
    remarks: "OCR mock extraction complete. Please review and correct.",
  };
}

router.post("/ocr/upload", async (req, res): Promise<void> => {
  const { filename, storagePath, mimeType } = req.body;
  if (!filename || !storagePath || !mimeType) {
    res.status(400).json({ error: "filename, storagePath, mimeType required" });
    return;
  }
  const tenantId = req.user!.tenantId;
  const userId = req.user!.userId;

  const [upload] = await db.insert(ocrUploadsTable).values({
    tenantId, userId, filename, storagePath, mimeType, ocrProvider: "mock", status: "Processing",
  }).returning();

  const extracted = mockOcrExtract(filename);
  const [updated] = await db.update(ocrUploadsTable).set({
    ocrRawOutput: JSON.stringify(extracted), extractedFields: JSON.stringify(extracted), status: "Done",
  }).where(eq(ocrUploadsTable.id, upload.id)).returning();

  res.status(201).json({
    id: updated.id,
    filename: updated.filename,
    status: updated.status,
    extractedFields: JSON.parse(updated.extractedFields ?? "{}"),
    createdAt: updated.createdAt,
  });
});

router.get("/ocr/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const tenantId = req.user!.tenantId;
  const [upload] = await db.select().from(ocrUploadsTable).where(and(eq(ocrUploadsTable.id, id), eq(ocrUploadsTable.tenantId, tenantId))).limit(1);
  if (!upload) {
    res.status(404).json({ error: "Upload not found" });
    return;
  }
  res.json({
    id: upload.id,
    filename: upload.filename,
    status: upload.status,
    extractedFields: upload.extractedFields ? JSON.parse(upload.extractedFields) : null,
    createdAt: upload.createdAt,
  });
});

export default router;
