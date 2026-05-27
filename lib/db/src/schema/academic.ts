import {
  pgTable,
  text,
  serial,
  timestamp,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./platform";
import { branchesTable } from "./platform";
import { usersTable } from "./platform";

// ─── Classes ──────────────────────────────────────────────────────────────────

export const classesTable = pgTable("classes", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  branchId: integer("branch_id").notNull().references(() => branchesTable.id),
  name: text("name").notNull(),
  numericLevel: integer("numeric_level").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertClassSchema = createInsertSchema(classesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClass = z.infer<typeof insertClassSchema>;
export type Class = typeof classesTable.$inferSelect;

// ─── Sections ─────────────────────────────────────────────────────────────────

export const sectionsTable = pgTable("sections", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  branchId: integer("branch_id").notNull().references(() => branchesTable.id),
  classId: integer("class_id").notNull().references(() => classesTable.id),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSectionSchema = createInsertSchema(sectionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSection = z.infer<typeof insertSectionSchema>;
export type Section = typeof sectionsTable.$inferSelect;

// ─── Subjects ─────────────────────────────────────────────────────────────────

export const subjectsTable = pgTable("subjects", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  branchId: integer("branch_id").notNull().references(() => branchesTable.id),
  name: text("name").notNull(),
  code: text("code"),
  applicableClasses: text("applicable_classes").array().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSubjectSchema = createInsertSchema(subjectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubject = z.infer<typeof insertSubjectSchema>;
export type Subject = typeof subjectsTable.$inferSelect;

// ─── Teacher Assignments ──────────────────────────────────────────────────────

export const teacherAssignmentsTable = pgTable("teacher_assignments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  branchId: integer("branch_id").notNull().references(() => branchesTable.id),
  teacherId: integer("teacher_id").notNull().references(() => usersTable.id),
  classId: integer("class_id").notNull().references(() => classesTable.id),
  sectionId: integer("section_id").notNull().references(() => sectionsTable.id),
  subjectId: integer("subject_id").notNull().references(() => subjectsTable.id),
  academicYear: text("academic_year").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTeacherAssignmentSchema = createInsertSchema(teacherAssignmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTeacherAssignment = z.infer<typeof insertTeacherAssignmentSchema>;
export type TeacherAssignment = typeof teacherAssignmentsTable.$inferSelect;

// ─── Houses ───────────────────────────────────────────────────────────────────

export const housesTable = pgTable("houses", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  name: text("name").notNull(),
  color: text("color"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHouseSchema = createInsertSchema(housesTable).omit({ id: true, createdAt: true });
export type InsertHouse = z.infer<typeof insertHouseSchema>;
export type House = typeof housesTable.$inferSelect;
