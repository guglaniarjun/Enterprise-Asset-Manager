import {
  pgTable,
  text,
  serial,
  timestamp,
  boolean,
  integer,
  date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable, branchesTable, usersTable } from "./platform";
import { classesTable, sectionsTable, subjectsTable } from "./academic";
import { studentsTable } from "./students";

// ─── Syllabus Breakups ────────────────────────────────────────────────────────

export const syllabusBreakupsTable = pgTable("syllabus_breakups", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  branchId: integer("branch_id").notNull().references(() => branchesTable.id),
  teacherId: integer("teacher_id").notNull().references(() => usersTable.id),
  classId: integer("class_id").notNull().references(() => classesTable.id),
  sectionId: integer("section_id").references(() => sectionsTable.id),
  subjectId: integer("subject_id").notNull().references(() => subjectsTable.id),
  academicYear: text("academic_year").notNull(),
  month: integer("month").notNull(),
  week: integer("week"),
  chapter: text("chapter").notNull(),
  topic: text("topic").notNull(),
  subtopic: text("subtopic"),
  expectedPeriods: integer("expected_periods"),
  plannedStartDate: date("planned_start_date"),
  plannedEndDate: date("planned_end_date"),
  learningOutcomes: text("learning_outcomes"),
  teachingAids: text("teaching_aids"),
  activityPlan: text("activity_plan"),
  assessmentPlan: text("assessment_plan"),
  status: text("status").notNull().default("Planned"),
  verifiedBy: integer("verified_by").references(() => usersTable.id),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSyllabusBreakupSchema = createInsertSchema(syllabusBreakupsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSyllabusBreakup = z.infer<typeof insertSyllabusBreakupSchema>;
export type SyllabusBreakup = typeof syllabusBreakupsTable.$inferSelect;

// ─── Daily Class Logs ─────────────────────────────────────────────────────────

export const dailyClassLogsTable = pgTable("daily_class_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  branchId: integer("branch_id").notNull().references(() => branchesTable.id),
  teacherId: integer("teacher_id").notNull().references(() => usersTable.id),
  classId: integer("class_id").notNull().references(() => classesTable.id),
  sectionId: integer("section_id").notNull().references(() => sectionsTable.id),
  subjectId: integer("subject_id").notNull().references(() => subjectsTable.id),
  date: date("date").notNull(),
  periodNumber: integer("period_number").notNull(),
  syllabusId: integer("syllabus_id").references(() => syllabusBreakupsTable.id),
  topicPlanned: text("topic_planned"),
  topicTaught: text("topic_taught"),
  syllabusStatus: text("syllabus_status").default("On Track"),
  teachingMethod: text("teaching_method").default("Lecture"),
  homeworkGiven: boolean("homework_given").notNull().default(false),
  homeworkDetails: text("homework_details"),
  notebookWorkGiven: boolean("notebook_work_given").notNull().default(false),
  notebookWorkDetails: text("notebook_work_details"),
  disciplineIssue: boolean("discipline_issue").notNull().default(false),
  disciplineDetails: text("discipline_details"),
  achievementDetails: text("achievement_details"),
  improvementDetails: text("improvement_details"),
  remarks: text("remarks"),
  verificationStatus: text("verification_status").notNull().default("Pending"),
  verifiedBy: integer("verified_by").references(() => usersTable.id),
  verificationTime: timestamp("verification_time", { withTimezone: true }),
  coordinatorRemarks: text("coordinator_remarks"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDailyClassLogSchema = createInsertSchema(dailyClassLogsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDailyClassLog = z.infer<typeof insertDailyClassLogSchema>;
export type DailyClassLog = typeof dailyClassLogsTable.$inferSelect;

// ─── Student Log Events ───────────────────────────────────────────────────────

export const studentLogEventsTable = pgTable("student_log_events", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  dailyLogId: integer("daily_log_id").notNull().references(() => dailyClassLogsTable.id),
  studentId: integer("student_id").notNull().references(() => studentsTable.id),
  teacherId: integer("teacher_id").notNull().references(() => usersTable.id),
  eventType: text("event_type").notNull(),
  severity: text("severity").notNull().default("Low"),
  remarks: text("remarks"),
  followUpRequired: boolean("follow_up_required").notNull().default(false),
  followUpDate: date("follow_up_date"),
  status: text("status").notNull().default("Open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertStudentLogEventSchema = createInsertSchema(studentLogEventsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStudentLogEvent = z.infer<typeof insertStudentLogEventSchema>;
export type StudentLogEvent = typeof studentLogEventsTable.$inferSelect;

// ─── OCR Uploads ──────────────────────────────────────────────────────────────

export const ocrUploadsTable = pgTable("ocr_uploads", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  filename: text("filename").notNull(),
  storagePath: text("storage_path").notNull(),
  mimeType: text("mime_type").notNull(),
  ocrProvider: text("ocr_provider").notNull().default("mock"),
  ocrRawOutput: text("ocr_raw_output"),
  extractedFields: text("extracted_fields"),
  status: text("status").notNull().default("Pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOcrUploadSchema = createInsertSchema(ocrUploadsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOcrUpload = z.infer<typeof insertOcrUploadSchema>;
export type OcrUpload = typeof ocrUploadsTable.$inferSelect;
