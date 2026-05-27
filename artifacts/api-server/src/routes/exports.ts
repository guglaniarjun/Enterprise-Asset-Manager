import { Router, type IRouter } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { db, dailyClassLogsTable, studentLogEventsTable, usersTable, classesTable, sectionsTable, subjectsTable, studentsTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireTenant } from "../middlewares/requireTenant";
import { requireRoles } from "../middlewares/requireRoles";
import { RBAC } from "../lib/rbac";
import { writeAuditLog } from "../lib/audit";
import * as XLSX from "xlsx";

const router: IRouter = Router();
router.use(authenticate);
router.use(requireTenant);

router.get("/export/logs", requireRoles(...RBAC.LEADERSHIP_AND_COORDINATOR), async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const dateFrom = String(req.query.dateFrom ?? "");
  const dateTo = String(req.query.dateTo ?? "");
  const classId = req.query.classId ? parseInt(String(req.query.classId), 10) : null;

  const conditions = [eq(dailyClassLogsTable.tenantId, tenantId)];
  if (dateFrom) conditions.push(gte(dailyClassLogsTable.date, dateFrom));
  if (dateTo) conditions.push(lte(dailyClassLogsTable.date, dateTo));
  if (classId) conditions.push(eq(dailyClassLogsTable.classId, classId));

  const logs = await db.select().from(dailyClassLogsTable).where(and(...conditions)).orderBy(dailyClassLogsTable.date);

  const rows = await Promise.all(logs.map(async (l) => {
    const [teacher] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, l.teacherId)).limit(1);
    const [cls] = await db.select({ name: classesTable.name }).from(classesTable).where(eq(classesTable.id, l.classId)).limit(1);
    const [sec] = await db.select({ name: sectionsTable.name }).from(sectionsTable).where(eq(sectionsTable.id, l.sectionId)).limit(1);
    const [sub] = await db.select({ name: subjectsTable.name }).from(subjectsTable).where(eq(subjectsTable.id, l.subjectId)).limit(1);
    return {
      Date: l.date, Teacher: teacher?.name ?? "", Class: cls?.name ?? "", Section: sec?.name ?? "",
      Subject: sub?.name ?? "", Period: l.periodNumber, "Topic Planned": l.topicPlanned ?? "",
      "Topic Taught": l.topicTaught ?? "", "Syllabus Status": l.syllabusStatus ?? "",
      "Teaching Method": l.teachingMethod ?? "", "Homework Given": l.homeworkGiven ? "Yes" : "No",
      "Notebook Work": l.notebookWorkGiven ? "Yes" : "No", "Discipline Issue": l.disciplineIssue ? "Yes" : "No",
      Remarks: l.remarks ?? "", "Verification Status": l.verificationStatus,
    };
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Daily Logs");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  await writeAuditLog({ user: req.user, tenantId, action: "EXPORT", entityType: "daily_logs", newValue: { dateFrom, dateTo, classId, count: logs.length }, ipAddress: req.ip });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=daily-logs.xlsx");
  res.send(buf);
});

router.get("/export/events", requireRoles(...RBAC.LEADERSHIP_AND_COORDINATOR), async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const eventType = String(req.query.eventType ?? "");

  let events = await db.select().from(studentLogEventsTable).where(eq(studentLogEventsTable.tenantId, tenantId)).orderBy(studentLogEventsTable.createdAt);
  if (eventType) events = events.filter((e) => e.eventType === eventType);

  const rows = await Promise.all(events.map(async (e) => {
    const [stu] = await db.select({ name: studentsTable.name, admissionNo: studentsTable.admissionNo }).from(studentsTable).where(eq(studentsTable.id, e.studentId)).limit(1);
    const [teacher] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, e.teacherId)).limit(1);
    return {
      "Admission No": stu?.admissionNo ?? "", "Student Name": stu?.name ?? "",
      "Teacher": teacher?.name ?? "", "Event Type": e.eventType, "Severity": e.severity,
      "Remarks": e.remarks ?? "", "Follow-up Required": e.followUpRequired ? "Yes" : "No",
      "Follow-up Date": e.followUpDate ?? "", "Status": e.status,
      "Created At": e.createdAt.toISOString().slice(0, 10),
    };
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Student Events");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  await writeAuditLog({ user: req.user, tenantId, action: "EXPORT", entityType: "student_events", newValue: { eventType, count: events.length }, ipAddress: req.ip });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=student-events.xlsx");
  res.send(buf);
});

export default router;
