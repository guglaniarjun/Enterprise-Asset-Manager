import {
  db,
  tenantsTable, branchesTable, rolesTable, usersTable, userRolesTable,
  classesTable, sectionsTable, subjectsTable, housesTable, teacherAssignmentsTable,
  studentsTable, syllabusBreakupsTable, dailyClassLogsTable,
  studentLogEventsTable, tasksTable, alertsTable, notificationsTable,
} from "@workspace/db";
import bcrypt from "bcryptjs";

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function main() {
  console.log("🌱 Seeding Springfield AI Command Center...");

  // ── Tenant ─────────────────────────────────────────────────────────────────
  const [tenant] = await db.insert(tenantsTable).values({
    name: "Springfield Public School",
    slug: "springfield",
    settings: { academicYear: "2025-26", timezone: "Asia/Kolkata" },
  }).onConflictDoNothing().returning();

  const tenantId = tenant?.id ?? (await db.select().from(tenantsTable).limit(1))[0].id;
  console.log(`✓ Tenant: ${tenantId}`);

  // ── Branch ─────────────────────────────────────────────────────────────────
  const [branch] = await db.insert(branchesTable).values({
    tenantId, name: "Main Campus – Ambala", code: "MCB", address: "Ambala, Haryana",
  }).onConflictDoNothing().returning();

  const branchId = branch?.id ?? (await db.select().from(branchesTable).limit(1))[0].id;
  console.log(`✓ Branch: ${branchId}`);

  // ── Roles ──────────────────────────────────────────────────────────────────
  const roleNames = ["Super Admin", "Tenant Admin", "Director", "Principal", "Coordinator", "Teacher", "Viewer"];
  const roleMap: Record<string, number> = {};
  for (const name of roleNames) {
    const [role] = await db.insert(rolesTable).values({ name, description: `${name} role` }).onConflictDoNothing().returning();
    const existing = role ?? (await db.select().from(rolesTable).limit(1))[0];
    const [found] = await db.select().from(rolesTable).limit(100);
    const allRoles = await db.select().from(rolesTable);
    const r = allRoles.find((r) => r.name === name);
    if (r) roleMap[name] = r.id;
  }
  console.log(`✓ Roles: ${Object.keys(roleMap).length}`);

  // ── Users ──────────────────────────────────────────────────────────────────
  const usersToCreate = [
    { email: "admin@springfieldschool.net", name: "Super Admin", role: "Super Admin", password: "Admin@12345" },
    { email: "director@springfieldschool.net", name: "Dr. Ramesh Sharma", role: "Director", password: "Director@123" },
    { email: "principal@springfieldschool.net", name: "Mrs. Sunita Gupta", role: "Principal", password: "Principal@123" },
    { email: "coord.joshi@springfieldschool.net", name: "Mr. Anil Joshi", role: "Coordinator", password: "Coord@123" },
    { email: "coord.mehta@springfieldschool.net", name: "Mrs. Priya Mehta", role: "Coordinator", password: "Coord@123" },
    { email: "teacher.kumar@springfieldschool.net", name: "Mr. Rajesh Kumar", role: "Teacher", password: "Teacher@123" },
    { email: "teacher.singh@springfieldschool.net", name: "Mrs. Neha Singh", role: "Teacher", password: "Teacher@123" },
    { email: "teacher.verma@springfieldschool.net", name: "Mr. Dinesh Verma", role: "Teacher", password: "Teacher@123" },
    { email: "teacher.kapoor@springfieldschool.net", name: "Mrs. Anjali Kapoor", role: "Teacher", password: "Teacher@123" },
    { email: "teacher.patel@springfieldschool.net", name: "Mr. Suresh Patel", role: "Teacher", password: "Teacher@123" },
  ];

  const userMap: Record<string, number> = {};
  for (const u of usersToCreate) {
    const hash = await hashPassword(u.password);
    const [user] = await db.insert(usersTable).values({
      tenantId, email: u.email, passwordHash: hash, name: u.name,
    }).onConflictDoNothing().returning();
    const allUsers = await db.select().from(usersTable).where((await import("drizzle-orm")).eq(usersTable.tenantId, tenantId));
    const found = allUsers.find((usr) => usr.email === u.email);
    if (found) {
      userMap[u.email] = found.id;
      if (roleMap[u.role]) {
        await db.insert(userRolesTable).values({ userId: found.id, roleId: roleMap[u.role], tenantId, branchId }).onConflictDoNothing();
      }
    }
  }
  console.log(`✓ Users: ${Object.keys(userMap).length}`);

  // ── Houses ─────────────────────────────────────────────────────────────────
  const houseData = [
    { name: "Red House", color: "#ef4444" },
    { name: "Blue House", color: "#3b82f6" },
    { name: "Green House", color: "#22c55e" },
    { name: "Yellow House", color: "#eab308" },
  ];
  const houseMap: Record<string, number> = {};
  for (const h of houseData) {
    const [house] = await db.insert(housesTable).values({ tenantId, name: h.name, color: h.color }).onConflictDoNothing().returning();
    const all = await db.select().from(housesTable).where((await import("drizzle-orm")).eq(housesTable.tenantId, tenantId));
    const found = all.find((x) => x.name === h.name);
    if (found) houseMap[h.name] = found.id;
  }
  console.log(`✓ Houses: ${Object.keys(houseMap).length}`);

  // ── Classes ────────────────────────────────────────────────────────────────
  const classData = [
    { name: "Class 4", level: 4 }, { name: "Class 5", level: 5 }, { name: "Class 6", level: 6 },
    { name: "Class 7", level: 7 }, { name: "Class 8", level: 8 }, { name: "Class 9", level: 9 },
    { name: "Class 10", level: 10 }, { name: "Class 11", level: 11 }, { name: "Class 12", level: 12 },
  ];
  const classMap: Record<string, number> = {};
  for (const c of classData) {
    const [cls] = await db.insert(classesTable).values({ tenantId, branchId, name: c.name, numericLevel: c.level }).onConflictDoNothing().returning();
    const all = await db.select().from(classesTable).where((await import("drizzle-orm")).eq(classesTable.tenantId, tenantId));
    const found = all.find((x) => x.name === c.name);
    if (found) classMap[c.name] = found.id;
  }
  console.log(`✓ Classes: ${Object.keys(classMap).length}`);

  // ── Sections ──────────────────────────────────────────────────────────────
  const sectionNames = ["A", "B", "C", "D"];
  const sectionMap: Record<string, number> = {};
  for (const [className, classId] of Object.entries(classMap)) {
    for (const sec of sectionNames) {
      const key = `${className}-${sec}`;
      const [section] = await db.insert(sectionsTable).values({ tenantId, branchId, classId, name: sec }).onConflictDoNothing().returning();
      const all = await db.select().from(sectionsTable).where((await import("drizzle-orm")).eq(sectionsTable.classId, classId));
      const found = all.find((x) => x.name === sec);
      if (found) sectionMap[key] = found.id;
    }
  }
  console.log(`✓ Sections: ${Object.keys(sectionMap).length}`);

  // ── Subjects ──────────────────────────────────────────────────────────────
  const subjectData = [
    { name: "English", code: "ENG", classes: ["Class 4", "Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"] },
    { name: "Hindi", code: "HIN", classes: ["Class 4", "Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10"] },
    { name: "Mathematics", code: "MATH", classes: ["Class 4", "Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"] },
    { name: "Science", code: "SCI", classes: ["Class 4", "Class 5", "Class 6", "Class 7", "Class 8"] },
    { name: "Social Science", code: "SST", classes: ["Class 4", "Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10"] },
    { name: "Computer", code: "COMP", classes: ["Class 4", "Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10"] },
    { name: "Physics", code: "PHY", classes: ["Class 9", "Class 10", "Class 11", "Class 12"] },
    { name: "Chemistry", code: "CHEM", classes: ["Class 9", "Class 10", "Class 11", "Class 12"] },
    { name: "Biology", code: "BIO", classes: ["Class 9", "Class 10", "Class 11", "Class 12"] },
    { name: "Economics", code: "ECO", classes: ["Class 11", "Class 12"] },
    { name: "Business Studies", code: "BST", classes: ["Class 11", "Class 12"] },
    { name: "Accountancy", code: "ACC", classes: ["Class 11", "Class 12"] },
    { name: "History", code: "HIST", classes: ["Class 11", "Class 12"] },
    { name: "Geography", code: "GEO", classes: ["Class 11", "Class 12"] },
    { name: "Physical Education", code: "PE", classes: ["Class 4", "Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"] },
    { name: "GK", code: "GK", classes: ["Class 4", "Class 5", "Class 6", "Class 7", "Class 8"] },
    { name: "Moral Science", code: "MOR", classes: ["Class 4", "Class 5", "Class 6", "Class 7", "Class 8"] },
  ];
  const subjectMap: Record<string, number> = {};
  for (const s of subjectData) {
    const [sub] = await db.insert(subjectsTable).values({ tenantId, branchId, name: s.name, code: s.code, applicableClasses: s.classes }).onConflictDoNothing().returning();
    const all = await db.select().from(subjectsTable).where((await import("drizzle-orm")).eq(subjectsTable.tenantId, tenantId));
    const found = all.find((x) => x.name === s.name);
    if (found) subjectMap[s.name] = found.id;
  }
  console.log(`✓ Subjects: ${Object.keys(subjectMap).length}`);

  // ── Teacher Assignments ────────────────────────────────────────────────────
  const teacherEmails = [
    "teacher.kumar@springfieldschool.net",
    "teacher.singh@springfieldschool.net",
    "teacher.verma@springfieldschool.net",
    "teacher.kapoor@springfieldschool.net",
    "teacher.patel@springfieldschool.net",
  ];
  const assignmentData = [
    { teacher: "teacher.kumar@springfieldschool.net", class: "Class 9", section: "A", subject: "Mathematics" },
    { teacher: "teacher.kumar@springfieldschool.net", class: "Class 10", section: "A", subject: "Mathematics" },
    { teacher: "teacher.singh@springfieldschool.net", class: "Class 9", section: "A", subject: "English" },
    { teacher: "teacher.singh@springfieldschool.net", class: "Class 9", section: "B", subject: "English" },
    { teacher: "teacher.verma@springfieldschool.net", class: "Class 10", section: "A", subject: "Physics" },
    { teacher: "teacher.verma@springfieldschool.net", class: "Class 11", section: "A", subject: "Physics" },
    { teacher: "teacher.kapoor@springfieldschool.net", class: "Class 9", section: "A", subject: "Chemistry" },
    { teacher: "teacher.kapoor@springfieldschool.net", class: "Class 9", section: "B", subject: "Chemistry" },
    { teacher: "teacher.patel@springfieldschool.net", class: "Class 8", section: "A", subject: "Mathematics" },
    { teacher: "teacher.patel@springfieldschool.net", class: "Class 8", section: "B", subject: "Science" },
  ];

  for (const a of assignmentData) {
    const teacherId = userMap[a.teacher];
    const classId = classMap[a.class];
    const sectionId = sectionMap[`${a.class}-${a.section}`];
    const subjectId = subjectMap[a.subject];
    if (teacherId && classId && sectionId && subjectId) {
      await db.insert(teacherAssignmentsTable).values({ tenantId, branchId, teacherId, classId, sectionId, subjectId, academicYear: "2025-26" }).onConflictDoNothing();
    }
  }
  console.log(`✓ Teacher assignments: ${assignmentData.length}`);

  // ── Students ───────────────────────────────────────────────────────────────
  const studentData = [];
  const studentClasses = ["Class 9", "Class 10", "Class 8"];
  const studentSections = ["A", "B"];
  const houseKeys = Object.keys(houseMap);
  let admNum = 1001;
  for (const cls of studentClasses) {
    for (const sec of studentSections) {
      const classId = classMap[cls];
      const sectionId = sectionMap[`${cls}-${sec}`];
      if (!classId || !sectionId) continue;
      for (let i = 1; i <= 10; i++) {
        const houseId = houseMap[houseKeys[(i - 1) % houseKeys.length]];
        studentData.push({
          tenantId, branchId,
          admissionNo: `SPS${admNum++}`,
          name: `Student ${cls} ${sec} ${i}`,
          classId, sectionId,
          rollNo: String(i),
          fatherName: `Father ${i}`,
          motherName: `Mother ${i}`,
          parentContact: `98765${String(admNum).padStart(5, "0")}`,
          houseId,
          status: "active",
        });
      }
    }
  }
  for (const s of studentData) {
    await db.insert(studentsTable).values(s).onConflictDoNothing();
  }
  console.log(`✓ Students: ${studentData.length}`);

  // ── Syllabus Entries ───────────────────────────────────────────────────────
  const syllabusEntries = [
    { classId: classMap["Class 9"], sectionId: sectionMap["Class 9-A"], subjectId: subjectMap["Mathematics"], teacherId: userMap["teacher.kumar@springfieldschool.net"], month: 4, chapter: "Number Systems", topic: "Irrational Numbers", status: "Completed" },
    { classId: classMap["Class 9"], sectionId: sectionMap["Class 9-A"], subjectId: subjectMap["Mathematics"], teacherId: userMap["teacher.kumar@springfieldschool.net"], month: 5, chapter: "Polynomials", topic: "Degree of a Polynomial", status: "In Progress" },
    { classId: classMap["Class 9"], sectionId: sectionMap["Class 9-A"], subjectId: subjectMap["English"], teacherId: userMap["teacher.singh@springfieldschool.net"], month: 4, chapter: "Prose", topic: "The Fun They Had", status: "Completed" },
    { classId: classMap["Class 9"], sectionId: sectionMap["Class 9-A"], subjectId: subjectMap["Chemistry"], teacherId: userMap["teacher.kapoor@springfieldschool.net"], month: 4, chapter: "Matter", topic: "States of Matter", status: "Delayed" },
    { classId: classMap["Class 10"], sectionId: sectionMap["Class 10-A"], subjectId: subjectMap["Mathematics"], teacherId: userMap["teacher.kumar@springfieldschool.net"], month: 4, chapter: "Real Numbers", topic: "Euclid's Division Lemma", status: "Completed" },
    { classId: classMap["Class 10"], sectionId: sectionMap["Class 10-A"], subjectId: subjectMap["Physics"], teacherId: userMap["teacher.verma@springfieldschool.net"], month: 4, chapter: "Light", topic: "Reflection of Light", status: "In Progress" },
  ];

  for (const s of syllabusEntries) {
    if (s.classId && s.sectionId && s.subjectId && s.teacherId) {
      await db.insert(syllabusBreakupsTable).values({
        tenantId, branchId, teacherId: s.teacherId, classId: s.classId, sectionId: s.sectionId,
        subjectId: s.subjectId, academicYear: "2025-26", month: s.month, chapter: s.chapter,
        topic: s.topic, status: s.status,
      }).onConflictDoNothing();
    }
  }
  console.log(`✓ Syllabus entries: ${syllabusEntries.length}`);

  // ── Daily Logs ─────────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const logEntries = [
    { date: today, teacherId: userMap["teacher.kumar@springfieldschool.net"], classId: classMap["Class 9"], sectionId: sectionMap["Class 9-A"], subjectId: subjectMap["Mathematics"], periodNumber: 3, topicTaught: "Irrational Numbers Practice", verificationStatus: "Pending", syllabusStatus: "On Track", submittedAt: new Date() },
    { date: today, teacherId: userMap["teacher.singh@springfieldschool.net"], classId: classMap["Class 9"], sectionId: sectionMap["Class 9-A"], subjectId: subjectMap["English"], periodNumber: 1, topicTaught: "Reading Comprehension", verificationStatus: "Verified", syllabusStatus: "On Track", submittedAt: new Date() },
    { date: today, teacherId: userMap["teacher.kapoor@springfieldschool.net"], classId: classMap["Class 9"], sectionId: sectionMap["Class 9-A"], subjectId: subjectMap["Chemistry"], periodNumber: 5, topicTaught: "States of Matter – Lab", verificationStatus: "Rejected", syllabusStatus: "Behind", disciplineIssue: true, disciplineDetails: "Two students were disruptive", submittedAt: new Date() },
    { date: yesterday, teacherId: userMap["teacher.kumar@springfieldschool.net"], classId: classMap["Class 10"], sectionId: sectionMap["Class 10-A"], subjectId: subjectMap["Mathematics"], periodNumber: 2, topicTaught: "Euclid's Algorithm", verificationStatus: "Verified", syllabusStatus: "On Track", submittedAt: new Date(Date.now() - 86400000) },
    { date: yesterday, teacherId: userMap["teacher.verma@springfieldschool.net"], classId: classMap["Class 10"], sectionId: sectionMap["Class 10-A"], subjectId: subjectMap["Physics"], periodNumber: 4, topicTaught: "Mirror Formula", verificationStatus: "Pending", syllabusStatus: "Ahead", submittedAt: new Date(Date.now() - 86400000) },
  ];

  const logIds: number[] = [];
  for (const l of logEntries) {
    if (l.classId && l.sectionId && l.subjectId && l.teacherId) {
      const [log] = await db.insert(dailyClassLogsTable).values({
        tenantId, branchId, teacherId: l.teacherId, classId: l.classId, sectionId: l.sectionId,
        subjectId: l.subjectId, date: l.date, periodNumber: l.periodNumber,
        topicTaught: l.topicTaught, verificationStatus: l.verificationStatus,
        syllabusStatus: l.syllabusStatus ?? "On Track", teachingMethod: "Lecture",
        homeworkGiven: false, notebookWorkGiven: true,
        disciplineIssue: l.disciplineIssue ?? false, disciplineDetails: l.disciplineDetails ?? null,
        submittedAt: l.submittedAt,
      }).onConflictDoNothing().returning();
      if (log) logIds.push(log.id);
    }
  }
  console.log(`✓ Daily logs: ${logIds.length}`);

  // ── Student Events ─────────────────────────────────────────────────────────
  const allStudents = await db.select().from(studentsTable).where((await import("drizzle-orm")).eq(studentsTable.tenantId, tenantId));

  if (logIds.length > 0 && allStudents.length > 0) {
    const eventTypes = ["Absent", "Inattentive", "Good Performance", "Achievement", "Discipline Issue", "Homework Defaulter"];
    for (let i = 0; i < Math.min(8, allStudents.length); i++) {
      const student = allStudents[i];
      const logId = logIds[i % logIds.length];
      const eventType = eventTypes[i % eventTypes.length];
      await db.insert(studentLogEventsTable).values({
        tenantId, dailyLogId: logId, studentId: student.id,
        teacherId: userMap["teacher.kumar@springfieldschool.net"],
        eventType, severity: i % 3 === 0 ? "High" : "Medium",
        remarks: `Auto-generated event: ${eventType}`,
        followUpRequired: i % 2 === 0, status: "Open",
      }).onConflictDoNothing();
    }
  }
  console.log(`✓ Student events seeded`);

  // ── Tasks ──────────────────────────────────────────────────────────────────
  const taskData = [
    { title: "Review pending syllabus for Class 9 Chemistry", priority: "High", status: "Open", module: "Academic" },
    { title: "Follow up with Mr. Kumar on missing logs", priority: "Medium", status: "Open", module: "Academic" },
    { title: "Prepare monthly compliance report", priority: "Low", status: "Open", module: "Reports" },
    { title: "Update student data for Class 8", priority: "Medium", status: "Completed", module: "Student" },
  ];
  for (const t of taskData) {
    await db.insert(tasksTable).values({ tenantId, title: t.title, priority: t.priority, status: t.status, module: t.module, sourceType: "Manual", createdBy: userMap["admin@springfieldschool.net"] }).onConflictDoNothing();
  }
  console.log(`✓ Tasks: ${taskData.length}`);

  // ── Alerts ─────────────────────────────────────────────────────────────────
  const alertData = [
    { alertType: "missing_logs", severity: "High", message: "3 teachers have not submitted logs today", module: "Academic" },
    { alertType: "syllabus_delayed", severity: "Medium", message: "Class 9 Chemistry is behind syllabus by 2 weeks", module: "Academic" },
    { alertType: "discipline_issue", severity: "High", message: "Repeated discipline issue in Class 9-A Chemistry", module: "Academic" },
    { alertType: "verification_pending", severity: "Low", message: "12 logs pending coordinator verification", module: "Academic" },
  ];
  for (const a of alertData) {
    await db.insert(alertsTable).values({ tenantId, alertType: a.alertType, severity: a.severity, message: a.message, module: a.module, status: "Open" }).onConflictDoNothing();
  }
  console.log(`✓ Alerts: ${alertData.length}`);

  // ── Notifications ──────────────────────────────────────────────────────────
  const directorId = userMap["director@springfieldschool.net"];
  const principalId = userMap["principal@springfieldschool.net"];
  if (directorId) {
    await db.insert(notificationsTable).values({ tenantId, userId: directorId, title: "System Ready", body: "Springfield AI Command Center Phase 1 is now operational.", type: "info" }).onConflictDoNothing();
    await db.insert(notificationsTable).values({ tenantId, userId: directorId, title: "3 Missing Logs Today", body: "Click to view teacher compliance dashboard.", type: "warning" }).onConflictDoNothing();
  }
  if (principalId) {
    await db.insert(notificationsTable).values({ tenantId, userId: principalId, title: "Log Rejection Alert", body: "Class 9-A Chemistry log rejected. Pending teacher resubmission.", type: "warning" }).onConflictDoNothing();
  }
  console.log(`✓ Notifications seeded`);

  console.log("\n✅ Seed complete!");
  console.log("\n📋 Login credentials:");
  console.log("   Super Admin:  admin@springfieldschool.net / Admin@12345");
  console.log("   Director:     director@springfieldschool.net / Director@123");
  console.log("   Principal:    principal@springfieldschool.net / Principal@123");
  console.log("   Coordinator:  coord.joshi@springfieldschool.net / Coord@123");
  console.log("   Teacher:      teacher.kumar@springfieldschool.net / Teacher@123");

  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
