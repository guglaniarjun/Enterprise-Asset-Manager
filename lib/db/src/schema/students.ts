import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable, branchesTable, usersTable } from "./platform";
import { classesTable, sectionsTable, housesTable } from "./academic";

// ─── Student Import Batches ───────────────────────────────────────────────────

export const studentImportBatchesTable = pgTable("student_import_batches", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  branchId: integer("branch_id").notNull().references(() => branchesTable.id),
  uploadedBy: integer("uploaded_by").notNull().references(() => usersTable.id),
  filename: text("filename").notNull(),
  totalRows: integer("total_rows").notNull().default(0),
  successRows: integer("success_rows").notNull().default(0),
  errorRows: integer("error_rows").notNull().default(0),
  status: text("status").notNull().default("pending"),
  errorDetails: text("error_details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertStudentImportBatchSchema = createInsertSchema(studentImportBatchesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStudentImportBatch = z.infer<typeof insertStudentImportBatchSchema>;
export type StudentImportBatch = typeof studentImportBatchesTable.$inferSelect;

// ─── Students ─────────────────────────────────────────────────────────────────

export const studentsTable = pgTable("students", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  branchId: integer("branch_id").notNull().references(() => branchesTable.id),
  batchId: integer("batch_id").references(() => studentImportBatchesTable.id),
  admissionNo: text("admission_no").notNull(),
  name: text("name").notNull(),
  classId: integer("class_id").notNull().references(() => classesTable.id),
  sectionId: integer("section_id").notNull().references(() => sectionsTable.id),
  rollNo: text("roll_no"),
  fatherName: text("father_name"),
  motherName: text("mother_name"),
  parentContact: text("parent_contact"),
  houseId: integer("house_id").references(() => housesTable.id),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertStudentSchema = createInsertSchema(studentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof studentsTable.$inferSelect;
