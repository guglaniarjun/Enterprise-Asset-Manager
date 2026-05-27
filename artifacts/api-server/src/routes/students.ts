import { Router, type IRouter } from "express";
import { eq, and, ilike, count } from "drizzle-orm";
import { db, studentsTable, studentImportBatchesTable, classesTable, sectionsTable, housesTable, studentLogEventsTable, usersTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireRoles, ROLES } from "../middlewares/requireRoles";
import { writeAuditLog } from "../lib/audit";

const router: IRouter = Router();
router.use(authenticate);

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

router.get("/students", async (req, res): Promise<void> => {
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

router.get("/students/import/preview", async (_req, res): Promise<void> => {
  res.status(405).json({ error: "Use POST" });
});

router.post("/students/import/preview", requireRoles(ROLES.SUPER_ADMIN, ROLES.TENANT_ADMIN, ROLES.PRINCIPAL), async (req, res): Promise<void> => {
  const { rows, branchId } = req.body;
  if (!rows || !Array.isArray(rows) || !branchId) {
    res.status(400).json({ error: "rows and branchId required" });
    return;
  }
  const tenantId = req.user!.tenantId;

  const valid: Record<string, unknown>[] = [];
  const errors: { row: number; field?: string; message: string; data: Record<string, unknown> }[] = [];

  const seen = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as Record<string, unknown>;
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

  res.json({ valid, errors, totalRows: rows.length, validRows: valid.length, errorRows: errors.length });
});

router.post("/students/import/confirm", requireRoles(ROLES.SUPER_ADMIN, ROLES.TENANT_ADMIN, ROLES.PRINCIPAL), async (req, res): Promise<void> => {
  const { rows, branchId, filename } = req.body;
  if (!rows || !Array.isArray(rows) || !branchId) {
    res.status(400).json({ error: "rows and branchId required" });
    return;
  }
  const tenantId = req.user!.tenantId;

  const [batch] = await db.insert(studentImportBatchesTable).values({
    tenantId,
    branchId,
    uploadedBy: req.user!.userId,
    filename: filename ?? "import.csv",
    totalRows: rows.length,
    successRows: 0,
    errorRows: 0,
    status: "processing",
  }).returning();

  let successRows = 0;
  let errorRows = 0;

  for (const row of rows as Record<string, unknown>[]) {
    try {
      await db.insert(studentsTable).values({
        tenantId,
        branchId,
        batchId: batch.id,
        admissionNo: String(row.admissionNo),
        name: String(row.name),
        classId: Number(row.classId),
        sectionId: Number(row.sectionId),
        rollNo: row.rollNo as string | null,
        fatherName: row.fatherName as string | null,
        motherName: row.motherName as string | null,
        parentContact: row.parentContact as string | null,
        houseId: row.houseId as number | null,
        status: "active",
      });
      successRows++;
    } catch {
      errorRows++;
    }
  }

  await db.update(studentImportBatchesTable).set({ successRows, errorRows, status: "completed" }).where(eq(studentImportBatchesTable.id, batch.id));

  await writeAuditLog({ user: req.user, tenantId, action: "IMPORT", entityType: "students", entityId: batch.id, newValue: { totalRows: rows.length, successRows }, ipAddress: req.ip });

  res.json({ batchId: batch.id, totalRows: rows.length, successRows, errorRows, message: `Imported ${successRows} students successfully` });
});

router.get("/students/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const tenantId = req.user!.tenantId;

  const [student] = await db.select().from(studentsTable).where(and(eq(studentsTable.id, id), eq(studentsTable.tenantId, tenantId))).limit(1);
  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  const enriched = await enrichStudent(student);

  const recentEvents = await db.select().from(studentLogEventsTable).where(eq(studentLogEventsTable.studentId, id)).orderBy(studentLogEventsTable.createdAt).limit(20);
  const eventsEnriched = await Promise.all(recentEvents.map(async (e) => {
    const [teacher] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, e.teacherId)).limit(1);
    return { ...e, studentName: enriched.name, admissionNo: enriched.admissionNo, teacherName: teacher?.name ?? "", logDate: null };
  }));

  res.json({ ...enriched, recentEvents: eventsEnriched });
});

router.patch("/students/:id", requireRoles(ROLES.SUPER_ADMIN, ROLES.TENANT_ADMIN, ROLES.PRINCIPAL, ROLES.COORDINATOR), async (req, res): Promise<void> => {
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
  const [updated] = await db.update(studentsTable).set(updates as any).where(eq(studentsTable.id, id)).returning();
  const enriched = await enrichStudent(updated);
  res.json(enriched);
});

router.get("/students/:id/events", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const tenantId = req.user!.tenantId;
  const eventType = String(req.query.eventType ?? "");
  const status = String(req.query.status ?? "");

  const [student] = await db.select().from(studentsTable).where(and(eq(studentsTable.id, id), eq(studentsTable.tenantId, tenantId))).limit(1);
  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  let events = await db.select().from(studentLogEventsTable).where(eq(studentLogEventsTable.studentId, id)).orderBy(studentLogEventsTable.createdAt);
  if (eventType) events = events.filter((e) => e.eventType === eventType);
  if (status) events = events.filter((e) => e.status === status);

  const enriched = await Promise.all(events.map(async (e) => {
    const [teacher] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, e.teacherId)).limit(1);
    return { ...e, studentName: student.name, admissionNo: student.admissionNo, teacherName: teacher?.name ?? "", logDate: null };
  }));

  res.json({ data: enriched });
});

export default router;
