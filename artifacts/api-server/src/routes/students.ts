import { Router, type IRouter } from "express";
import { eq, and, ilike, count } from "drizzle-orm";
import { db, studentsTable, studentImportBatchesTable, classesTable, sectionsTable, housesTable, studentLogEventsTable, usersTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireTenant } from "../middlewares/requireTenant";
import { requireRoles } from "../middlewares/requireRoles";
import { RBAC } from "../lib/rbac";
import { writeAuditLog } from "../lib/audit";

const router: IRouter = Router();
router.use(authenticate);
router.use(requireTenant);

async function enrichStudent(s: typeof studentsTable.$inferSelect) {
  const [cls] = await db.select({ name: classesTable.name }).from(classesTable).where(eq(classesTable.id, s.classId)).limit(1);
  const [sec] = await db.select({ name: sectionsTable.name }).from(sectionsTable).where(eq(sectionsTable.id, s.sectionId)).limit(1);
  const house = s.houseId
    ? (await db.select({ name: housesTable.name }).from(housesTable).where(eq(housesTable.id, s.houseId)).limit(1))[0]
    : null;
  return {
    ...s,
    className: cls?.name ?? "",
    sectionName: sec?.name ?? "",
    houseName: house?.name ?? null,
  };
}

router.get("/students", requireRoles(...RBAC.ALL_STAFF), async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const page = parseInt(String(req.query.page ?? 1), 10);
  const limit = parseInt(String(req.query.limit ?? 50), 10);
  const offset = (page - 1) * limit;
  const search = String(req.query.search ?? "");
  const classId = req.query.classId ? parseInt(String(req.query.classId), 10) : null;
  const sectionId = req.query.sectionId ? parseInt(String(req.query.sectionId), 10) : null;
  const status = String(req.query.status ?? "");

  const conditions = [eq(studentsTable.tenantId, tenantId)];
  if (classId) conditions.push(eq(studentsTable.classId, classId));
  if (sectionId) conditions.push(eq(studentsTable.sectionId, sectionId));
  if (status) conditions.push(eq(studentsTable.status, status));
  if (search) conditions.push(ilike(studentsTable.name, `%${search}%`));

  const where = and(...conditions);
  const [{ total }] = await db.select({ total: count() }).from(studentsTable).where(where);
  const rows = await db.select().from(studentsTable).where(where).limit(limit).offset(offset).orderBy(studentsTable.name);
  const enriched = await Promise.all(rows.map(enrichStudent));
  res.json({
    data: enriched,
    pagination: { page, limit, total: Number(total), totalPages: Math.ceil(Number(total) / limit) },
  });
});

router.get("/students/import/preview", requireRoles(...RBAC.ADMIN_AND_PRINCIPAL), async (_req, res): Promise<void> => {
  res.status(405).json({ error: "Use POST" });
});

type RawRow = Record<string, unknown>;
type ValidRow = {
  admissionNo: string;
  name: string;
  classId: number;
  sectionId: number;
  rollNo: string | null;
  fatherName: string | null;
  motherName: string | null;
  parentContact: string | null;
  houseId: number | null;
  status: "active";
};
type ImportError = { row: number; field?: string; message: string; data: RawRow };

async function validateImportRows(
  rows: RawRow[],
  tenantId: number,
  branchId: number,
): Promise<{ valid: ValidRow[]; errors: ImportError[] }> {
  const valid: ValidRow[] = [];
  const errors: ImportError[] = [];
  const seen = new Set<string>();

  // Branch must belong to this tenant — block cross-tenant branch IDs.
  // (branches table is queried via the schema; do a lightweight class lookup using branch.)
  // We rely on classes being tenant-scoped which we already check.

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    const admissionNo = String(row.admission_no ?? row.admissionNo ?? "").trim();
    const name = String(row.student_name ?? row.name ?? "").trim();
    const cls = String(row.class ?? row.className ?? "").trim();
    const section = String(row.section ?? row.sectionName ?? "").trim();

    if (!admissionNo) { errors.push({ row: rowNum, field: "admission_no", message: "Admission number required", data: row }); continue; }
    if (!name) { errors.push({ row: rowNum, field: "student_name", message: "Student name required", data: row }); continue; }
    if (!cls) { errors.push({ row: rowNum, field: "class", message: "Class required", data: row }); continue; }

    if (seen.has(admissionNo)) {
      errors.push({ row: rowNum, field: "admission_no", message: `Duplicate admission_no in file: ${admissionNo}`, data: row });
      continue;
    }

    const [dbStudent] = await db.select().from(studentsTable).where(and(eq(studentsTable.tenantId, tenantId), eq(studentsTable.admissionNo, admissionNo))).limit(1);
    if (dbStudent) {
      errors.push({ row: rowNum, field: "admission_no", message: `Admission no already exists: ${admissionNo}`, data: row });
      continue;
    }

    const [clsRow] = await db.select().from(classesTable).where(and(eq(classesTable.tenantId, tenantId), eq(classesTable.name, cls))).limit(1);
    if (!clsRow) {
      errors.push({ row: rowNum, field: "class", message: `Class not found: ${cls}`, data: row });
      continue;
    }
    if (clsRow.branchId !== branchId) {
      errors.push({ row: rowNum, field: "class", message: `Class ${cls} does not belong to selected branch`, data: row });
      continue;
    }

    const [secRow] = section
      ? await db.select().from(sectionsTable).where(and(eq(sectionsTable.classId, clsRow.id), eq(sectionsTable.name, section))).limit(1)
      : await db.select().from(sectionsTable).where(eq(sectionsTable.classId, clsRow.id)).limit(1);

    if (!secRow) {
      errors.push({ row: rowNum, field: "section", message: `Section not found: ${section} for class ${cls}`, data: row });
      continue;
    }

    const house = String(row.house ?? "").trim();
    let houseId: number | null = null;
    if (house) {
      const [houseRow] = await db.select().from(housesTable).where(and(eq(housesTable.tenantId, tenantId), eq(housesTable.name, house))).limit(1);
      if (houseRow) houseId = houseRow.id;
    }

    seen.add(admissionNo);
    valid.push({
      admissionNo,
      name,
      classId: clsRow.id,
      sectionId: secRow.id,
      rollNo: String(row.roll_no ?? row.rollNo ?? "").trim() || null,
      fatherName: String(row.father_name ?? row.fatherName ?? "").trim() || null,
      motherName: String(row.mother_name ?? row.motherName ?? "").trim() || null,
      parentContact: String(row.parent_contact ?? row.parentContact ?? "").trim() || null,
      houseId,
      status: "active",
    });
  }

  return { valid, errors };
}

router.post("/students/import/preview", requireRoles(...RBAC.ADMIN_AND_PRINCIPAL), async (req, res): Promise<void> => {
  const { rows, branchId } = req.body;
  if (!rows || !Array.isArray(rows) || !branchId) {
    res.status(400).json({ error: "rows and branchId required" });
    return;
  }
  const tenantId = req.user!.tenantId;
  const { valid, errors } = await validateImportRows(rows, tenantId, Number(branchId));
  res.json({ valid, errors, totalRows: rows.length, validRows: valid.length, errorRows: errors.length });
});

router.post("/students/import/confirm", requireRoles(...RBAC.ADMIN_AND_PRINCIPAL), async (req, res): Promise<void> => {
  const { rows, branchId, filename } = req.body;
  if (!rows || !Array.isArray(rows) || !branchId) {
    res.status(400).json({ error: "rows and branchId required" });
    return;
  }
  const tenantId = req.user!.tenantId;
  // Re-validate server-side. Never trust client-provided "validated" rows.
  const { valid, errors } = await validateImportRows(rows, tenantId, Number(branchId));

  const [batch] = await db.insert(studentImportBatchesTable).values({
    tenantId,
    branchId: Number(branchId),
    uploadedBy: req.user!.userId,
    filename: filename ?? "import.csv",
    totalRows: rows.length,
    successRows: 0,
    errorRows: errors.length,
    status: "processing",
  }).returning();

  let successRows = 0;
  let insertErrors = 0;

  for (const row of valid) {
    try {
      await db.insert(studentsTable).values({
        tenantId,
        branchId: Number(branchId),
        batchId: batch.id,
        admissionNo: row.admissionNo,
        name: row.name,
        classId: row.classId,
        sectionId: row.sectionId,
        rollNo: row.rollNo,
        fatherName: row.fatherName,
        motherName: row.motherName,
        parentContact: row.parentContact,
        houseId: row.houseId,
        status: "active",
      });
      successRows++;
    } catch {
      insertErrors++;
    }
  }

  const totalErrors = errors.length + insertErrors;
  const finalStatus = totalErrors === 0 ? "completed" : (successRows === 0 ? "failed" : "partial");
  await db.update(studentImportBatchesTable).set({ successRows, errorRows: totalErrors, status: finalStatus }).where(eq(studentImportBatchesTable.id, batch.id));

  await writeAuditLog({
    user: req.user, tenantId,
    action: finalStatus === "completed" ? "IMPORT" : (finalStatus === "failed" ? "IMPORT_FAILED" : "IMPORT_PARTIAL"),
    entityType: "students", entityId: batch.id,
    newValue: { totalRows: rows.length, successRows, errorRows: totalErrors, validationErrors: errors.length, insertErrors },
    ipAddress: req.ip,
  });

  res.json({
    batchId: batch.id,
    totalRows: rows.length,
    successRows,
    errorRows: totalErrors,
    errors,
    message: finalStatus === "completed"
      ? `Imported ${successRows} students successfully`
      : finalStatus === "failed"
      ? `Import failed: 0 of ${rows.length} rows imported (${totalErrors} errors)`
      : `Partial import: ${successRows} of ${rows.length} rows imported (${totalErrors} errors)`,
  });
});

router.get("/students/:id", requireRoles(...RBAC.ALL_STAFF), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const tenantId = req.user!.tenantId;

  const [student] = await db.select().from(studentsTable).where(and(eq(studentsTable.id, id), eq(studentsTable.tenantId, tenantId))).limit(1);
  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  const enriched = await enrichStudent(student);

  const recentEvents = await db.select().from(studentLogEventsTable).where(and(eq(studentLogEventsTable.studentId, id), eq(studentLogEventsTable.tenantId, tenantId))).orderBy(studentLogEventsTable.createdAt).limit(20);
  const eventsEnriched = await Promise.all(recentEvents.map(async (e) => {
    const [teacher] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, e.teacherId)).limit(1);
    return { ...e, studentName: enriched.name, admissionNo: enriched.admissionNo, teacherName: teacher?.name ?? "", logDate: null };
  }));

  res.json({ ...enriched, recentEvents: eventsEnriched });
});

router.patch("/students/:id", requireRoles(...RBAC.LEADERSHIP_AND_COORDINATOR), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const tenantId = req.user!.tenantId;
  const [existing] = await db.select().from(studentsTable).where(and(eq(studentsTable.id, id), eq(studentsTable.tenantId, tenantId))).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Student not found" });
    return;
  }
  const updates: Record<string, unknown> = {};
  const fields = ["name", "classId", "sectionId", "rollNo", "fatherName", "motherName", "parentContact", "houseId", "status"];
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [updated] = await db.update(studentsTable).set(updates as any).where(and(eq(studentsTable.id, id), eq(studentsTable.tenantId, tenantId))).returning();
  await writeAuditLog({ user: req.user, tenantId, action: "UPDATE", entityType: "student", entityId: id, oldValue: existing, newValue: updates, ipAddress: req.ip });
  const enriched = await enrichStudent(updated);
  res.json(enriched);
});

router.get("/students/:id/events", requireRoles(...RBAC.ALL_STAFF), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const tenantId = req.user!.tenantId;
  const eventType = String(req.query.eventType ?? "");
  const status = String(req.query.status ?? "");

  const [student] = await db.select().from(studentsTable).where(and(eq(studentsTable.id, id), eq(studentsTable.tenantId, tenantId))).limit(1);
  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  let events = await db.select().from(studentLogEventsTable).where(and(eq(studentLogEventsTable.studentId, id), eq(studentLogEventsTable.tenantId, tenantId))).orderBy(studentLogEventsTable.createdAt);
  if (eventType) events = events.filter((e) => e.eventType === eventType);
  if (status) events = events.filter((e) => e.status === status);

  const enriched = await Promise.all(events.map(async (e) => {
    const [teacher] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, e.teacherId)).limit(1);
    return { ...e, studentName: student.name, admissionNo: student.admissionNo, teacherName: teacher?.name ?? "", logDate: null };
  }));

  res.json({ data: enriched });
});

export default router;
