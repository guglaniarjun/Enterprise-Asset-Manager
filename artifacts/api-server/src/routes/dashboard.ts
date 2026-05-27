import { Router, type IRouter } from "express";
import { eq, and, gte, lte, count } from "drizzle-orm";
import { db, dailyClassLogsTable, teacherAssignmentsTable, syllabusBreakupsTable, studentLogEventsTable, tasksTable, alertsTable, usersTable, classesTable, sectionsTable, subjectsTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireTenant } from "../middlewares/requireTenant";
import { requireRoles } from "../middlewares/requireRoles";
import { RBAC } from "../lib/rbac";

const router: IRouter = Router();
router.use(authenticate);
router.use(requireTenant);

router.get("/dashboard/director", requireRoles(...RBAC.LEADERSHIP), async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const date = String(req.query.date ?? new Date().toISOString().slice(0, 10));

  const assignments = await db.select().from(teacherAssignmentsTable).where(and(eq(teacherAssignmentsTable.tenantId, tenantId), eq(teacherAssignmentsTable.isActive, true)));
  const logsToday = await db.select().from(dailyClassLogsTable).where(and(eq(dailyClassLogsTable.tenantId, tenantId), eq(dailyClassLogsTable.date, date)));

  const expectedLogsToday = assignments.length;
  const submittedLogsToday = logsToday.length;
  const missingLogsToday = Math.max(0, expectedLogsToday - submittedLogsToday);

  const teacherIds = [...new Set(assignments.map((a) => a.teacherId))];
  let complianceSum = 0;
  for (const tid of teacherIds) {
    const expected = assignments.filter((a) => a.teacherId === tid).length;
    const submitted = logsToday.filter((l) => l.teacherId === tid).length;
    complianceSum += expected > 0 ? submitted / expected : 1;
  }
  const teacherCompliancePercent = teacherIds.length > 0 ? Math.round((complianceSum / teacherIds.length) * 100) : 100;

  const syllabus = await db.select().from(syllabusBreakupsTable).where(eq(syllabusBreakupsTable.tenantId, tenantId));
  const totalSyllabus = syllabus.length;
  const completedSyllabus = syllabus.filter((s) => s.status === "Completed").length;
  const syllabusCompletionPercent = totalSyllabus > 0 ? Math.round((completedSyllabus / totalSyllabus) * 100) : 0;
  const classesBehindSyllabus = [...new Set(syllabus.filter((s) => s.status === "Delayed").map((s) => s.classId))].length;
  const subjectsBehindSyllabus = [...new Set(syllabus.filter((s) => s.status === "Delayed").map((s) => s.subjectId))].length;

  const todayEvents = await db.select().from(studentLogEventsTable).where(eq(studentLogEventsTable.tenantId, tenantId));
  const disciplineCasesToday = logsToday.filter((l) => l.disciplineIssue).length;

  const studentDisciplineCount: Record<number, number> = {};
  for (const e of todayEvents.filter((e) => e.eventType === "Discipline Issue")) {
    studentDisciplineCount[e.studentId] = (studentDisciplineCount[e.studentId] ?? 0) + 1;
  }
  const repeatedDisciplineStudents = Object.values(studentDisciplineCount).filter((c) => c > 1).length;

  const studentInattentiveCount: Record<number, number> = {};
  for (const e of todayEvents.filter((e) => e.eventType === "Inattentive")) {
    studentInattentiveCount[e.studentId] = (studentInattentiveCount[e.studentId] ?? 0) + 1;
  }
  const repeatedInattentiveStudents = Object.values(studentInattentiveCount).filter((c) => c > 1).length;

  const achievementsRecorded = todayEvents.filter((e) => e.eventType === "Achievement").length;
  const coordinatorVerificationPending = logsToday.filter((l) => l.verificationStatus === "Pending" && l.submittedAt !== null).length;
  const rejectedLogsPendingResubmission = logsToday.filter((l) => l.verificationStatus === "Rejected").length;

  const [{ total: openTasks }] = await db.select({ total: count() }).from(tasksTable).where(and(eq(tasksTable.tenantId, tenantId), eq(tasksTable.status, "Open")));
  const [{ total: criticalAlerts }] = await db.select({ total: count() }).from(alertsTable).where(and(eq(alertsTable.tenantId, tenantId), eq(alertsTable.status, "Open"), eq(alertsTable.severity, "High")));

  res.json({
    date, expectedLogsToday, submittedLogsToday, missingLogsToday, teacherCompliancePercent,
    syllabusCompletionPercent, classesBehindSyllabus, subjectsBehindSyllabus,
    disciplineCasesToday, repeatedDisciplineStudents, repeatedInattentiveStudents,
    achievementsRecorded, coordinatorVerificationPending, rejectedLogsPendingResubmission,
    openTasks: Number(openTasks), criticalAlerts: Number(criticalAlerts),
  });
});

router.get("/dashboard/principal", requireRoles(...RBAC.LEADERSHIP), async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const date = String(req.query.date ?? new Date().toISOString().slice(0, 10));

  const assignments = await db.select().from(teacherAssignmentsTable).where(and(eq(teacherAssignmentsTable.tenantId, tenantId), eq(teacherAssignmentsTable.isActive, true)));
  const logsToday = await db.select().from(dailyClassLogsTable).where(and(eq(dailyClassLogsTable.tenantId, tenantId), eq(dailyClassLogsTable.date, date)));

  const rejectedLogs = logsToday.filter((l) => l.verificationStatus === "Rejected").length;
  const missingLogs = Math.max(0, assignments.length - logsToday.length);

  const teacherLogCount: Record<number, number> = {};
  for (const l of logsToday) teacherLogCount[l.teacherId] = (teacherLogCount[l.teacherId] ?? 0) + 1;
  const repeatedNonComplianceTeachers = assignments.filter((a) => !teacherLogCount[a.teacherId]).length;

  const syllabusDelayedSubjects = (await db.select().from(syllabusBreakupsTable).where(and(eq(syllabusBreakupsTable.tenantId, tenantId), eq(syllabusBreakupsTable.status, "Delayed")))).length;

  const events = await db.select().from(studentLogEventsTable).where(and(eq(studentLogEventsTable.tenantId, tenantId), eq(studentLogEventsTable.severity, "High")));
  const seriousDisciplineIssues = events.filter((e) => e.eventType === "Discipline Issue").length;

  const coordinatorPendingVerifications = logsToday.filter((l) => l.verificationStatus === "Pending" && l.submittedAt !== null).length;

  res.json({ date, rejectedLogs, missingLogs, repeatedNonComplianceTeachers, syllabusDelayedSubjects, seriousDisciplineIssues, coordinatorPendingVerifications });
});

router.get("/dashboard/teacher", requireRoles(...RBAC.ALL_STAFF), async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const teacherId = req.user!.userId;
  const date = String(req.query.date ?? new Date().toISOString().slice(0, 10));

  const assignments = await db.select().from(teacherAssignmentsTable).where(and(eq(teacherAssignmentsTable.tenantId, tenantId), eq(teacherAssignmentsTable.teacherId, teacherId), eq(teacherAssignmentsTable.isActive, true)));
  const logsToday = await db.select().from(dailyClassLogsTable).where(and(eq(dailyClassLogsTable.tenantId, tenantId), eq(dailyClassLogsTable.teacherId, teacherId), eq(dailyClassLogsTable.date, date)));

  const enrichedAssignments = await Promise.all(assignments.map(async (a) => {
    const [cls] = await db.select({ name: classesTable.name }).from(classesTable).where(eq(classesTable.id, a.classId)).limit(1);
    const [sec] = await db.select({ name: sectionsTable.name }).from(sectionsTable).where(eq(sectionsTable.id, a.sectionId)).limit(1);
    const [sub] = await db.select({ name: subjectsTable.name }).from(subjectsTable).where(eq(subjectsTable.id, a.subjectId)).limit(1);
    const [teacher] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, a.teacherId)).limit(1);
    return { ...a, teacherName: teacher?.name ?? "", className: cls?.name ?? "", sectionName: sec?.name ?? "", subjectName: sub?.name ?? "" };
  }));

  const allLogs = await db.select().from(dailyClassLogsTable).where(and(eq(dailyClassLogsTable.tenantId, tenantId), eq(dailyClassLogsTable.teacherId, teacherId)));

  res.json({
    date,
    myAssignments: assignments.length,
    myLogsToday: logsToday.length,
    myPendingLogs: allLogs.filter((l) => !l.submittedAt).length,
    myRejectedLogs: allLogs.filter((l) => l.verificationStatus === "Rejected").length,
    myUnverifiedLogs: allLogs.filter((l) => l.verificationStatus === "Pending" && l.submittedAt !== null).length,
    assignments: enrichedAssignments,
  });
});

router.get("/dashboard/coordinator", requireRoles(...RBAC.LEADERSHIP_AND_COORDINATOR), async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const date = String(req.query.date ?? new Date().toISOString().slice(0, 10));

  const allToday = await db.select().from(dailyClassLogsTable).where(and(eq(dailyClassLogsTable.tenantId, tenantId), eq(dailyClassLogsTable.date, date)));

  const pendingLogs = allToday.filter((l) => l.verificationStatus === "Pending" && l.submittedAt !== null);
  const verifiedToday = allToday.filter((l) => l.verificationStatus === "Verified").length;
  const rejectedToday = allToday.filter((l) => l.verificationStatus === "Rejected").length;

  const enrichedPending = await Promise.all(pendingLogs.slice(0, 50).map(async (l) => {
    const [teacher] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, l.teacherId)).limit(1);
    const [cls] = await db.select({ name: classesTable.name }).from(classesTable).where(eq(classesTable.id, l.classId)).limit(1);
    const [sec] = await db.select({ name: sectionsTable.name }).from(sectionsTable).where(eq(sectionsTable.id, l.sectionId)).limit(1);
    const [sub] = await db.select({ name: subjectsTable.name }).from(subjectsTable).where(eq(subjectsTable.id, l.subjectId)).limit(1);
    return { ...l, teacherName: teacher?.name ?? "", className: cls?.name ?? "", sectionName: sec?.name ?? "", subjectName: sub?.name ?? "", verifierName: null };
  }));

  res.json({ date, pendingVerifications: pendingLogs.length, verifiedToday, rejectedToday, pendingLogs: enrichedPending });
});

router.get("/analytics/compliance", requireRoles(...RBAC.LEADERSHIP_AND_COORDINATOR), async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const dateFrom = String(req.query.dateFrom ?? new Date().toISOString().slice(0, 10));
  const dateTo = String(req.query.dateTo ?? new Date().toISOString().slice(0, 10));

  const logs = await db.select().from(dailyClassLogsTable).where(and(eq(dailyClassLogsTable.tenantId, tenantId), gte(dailyClassLogsTable.date, dateFrom), lte(dailyClassLogsTable.date, dateTo)));
  const assignments = await db.select().from(teacherAssignmentsTable).where(and(eq(teacherAssignmentsTable.tenantId, tenantId), eq(teacherAssignmentsTable.isActive, true)));

  const teacherMap: Record<number, { teacherId: number; teacherName: string; submitted: number; expected: number }> = {};
  for (const a of assignments) {
    if (!teacherMap[a.teacherId]) teacherMap[a.teacherId] = { teacherId: a.teacherId, teacherName: "", submitted: 0, expected: 0 };
    teacherMap[a.teacherId].expected++;
  }
  for (const l of logs) {
    if (teacherMap[l.teacherId]) teacherMap[l.teacherId].submitted++;
  }

  const byTeacher = await Promise.all(Object.values(teacherMap).map(async (t) => {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, t.teacherId)).limit(1);
    return { ...t, teacherName: u?.name ?? "", compliancePercent: t.expected > 0 ? Math.round((t.submitted / t.expected) * 100) : 100 };
  }));

  const classMap: Record<number, { classId: number; className: string; submitted: number; expected: number }> = {};
  for (const a of assignments) {
    if (!classMap[a.classId]) classMap[a.classId] = { classId: a.classId, className: "", submitted: 0, expected: 0 };
    classMap[a.classId].expected++;
  }
  for (const l of logs) {
    if (classMap[l.classId]) classMap[l.classId].submitted++;
  }
  const byClass = await Promise.all(Object.values(classMap).map(async (c) => {
    const [cls] = await db.select({ name: classesTable.name }).from(classesTable).where(eq(classesTable.id, c.classId)).limit(1);
    return { ...c, className: cls?.name ?? "", compliancePercent: c.expected > 0 ? Math.round((c.submitted / c.expected) * 100) : 100 };
  }));

  const totalExpected = assignments.length;
  const totalSubmitted = logs.length;
  const overallPercent = totalExpected > 0 ? Math.round((totalSubmitted / totalExpected) * 100) : 100;

  res.json({ summary: { dateFrom, dateTo, totalExpected, totalSubmitted, overallPercent }, byTeacher, byClass });
});

router.get("/analytics/discipline", requireRoles(...RBAC.LEADERSHIP_AND_COORDINATOR), async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const events = await db.select().from(studentLogEventsTable).where(and(eq(studentLogEventsTable.tenantId, tenantId), eq(studentLogEventsTable.eventType, "Discipline Issue")));

  const total = events.length;
  const open = events.filter((e) => e.status === "Open").length;
  const high = events.filter((e) => e.severity === "High").length;

  const classMap: Record<number, { count: number; logIds: number[] }> = {};
  for (const e of events) {
    const [log] = await db.select({ classId: dailyClassLogsTable.classId }).from(dailyClassLogsTable).where(and(eq(dailyClassLogsTable.id, e.dailyLogId), eq(dailyClassLogsTable.tenantId, tenantId))).limit(1);
    if (log) {
      if (!classMap[log.classId]) classMap[log.classId] = { count: 0, logIds: [] };
      classMap[log.classId].count++;
    }
  }
  const byClass = await Promise.all(Object.entries(classMap).map(async ([classId, v]) => {
    const [cls] = await db.select({ name: classesTable.name }).from(classesTable).where(eq(classesTable.id, parseInt(classId, 10))).limit(1);
    return { classId: parseInt(classId, 10), className: cls?.name ?? "", count: v.count };
  }));

  const studentCount: Record<number, number> = {};
  for (const e of events) studentCount[e.studentId] = (studentCount[e.studentId] ?? 0) + 1;
  const repeatedStudents = Object.entries(studentCount).filter(([, c]) => c > 1).map(([id, count]) => ({ studentId: parseInt(id, 10), count }));

  res.json({ summary: { total, open, high }, byClass, repeatedStudents });
});

export default router;
