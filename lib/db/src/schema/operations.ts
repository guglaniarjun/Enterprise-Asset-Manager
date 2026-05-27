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
import { tenantsTable, usersTable } from "./platform";
import { studentsTable } from "./students";
import { tasksTable, alertsTable } from "./systems";

// ─── Task Activity (audit timeline per task) ──────────────────────────────────

export const taskActivityTable = pgTable("task_activity", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  taskId: integer("task_id").notNull().references(() => tasksTable.id),
  userId: integer("user_id").references(() => usersTable.id),
  action: text("action").notNull(), // created | status_change | reassigned | commented | escalated | resolved | sla_breached
  fromValue: text("from_value"),
  toValue: text("to_value"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTaskActivitySchema = createInsertSchema(taskActivityTable).omit({ id: true, createdAt: true });
export type InsertTaskActivity = z.infer<typeof insertTaskActivitySchema>;
export type TaskActivity = typeof taskActivityTable.$inferSelect;

// ─── Alert Activity (audit timeline per alert) ────────────────────────────────

export const alertActivityTable = pgTable("alert_activity", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  alertId: integer("alert_id").notNull().references(() => alertsTable.id),
  userId: integer("user_id").references(() => usersTable.id),
  action: text("action").notNull(),
  fromValue: text("from_value"),
  toValue: text("to_value"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAlertActivitySchema = createInsertSchema(alertActivityTable).omit({ id: true, createdAt: true });
export type InsertAlertActivity = z.infer<typeof insertAlertActivitySchema>;
export type AlertActivity = typeof alertActivityTable.$inferSelect;

// ─── Follow-ups (scheduled action items linked to a source) ───────────────────

export const followUpsTable = pgTable("follow_ups", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  title: text("title").notNull(),
  notes: text("notes"),
  // Source: which event or entity triggered this follow-up
  sourceType: text("source_type"), // student_event | discipline | task | alert | manual
  sourceId: text("source_id"),
  studentId: integer("student_id").references(() => studentsTable.id),
  // Scheduling & ownership
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
  assignedTo: integer("assigned_to").references(() => usersTable.id),
  createdBy: integer("created_by").references(() => usersTable.id),
  status: text("status").notNull().default("Pending"), // Pending | Done | Skipped | Overdue
  completedAt: timestamp("completed_at", { withTimezone: true }),
  completedBy: integer("completed_by").references(() => usersTable.id),
  outcome: text("outcome"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertFollowUpSchema = createInsertSchema(followUpsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFollowUp = z.infer<typeof insertFollowUpSchema>;
export type FollowUp = typeof followUpsTable.$inferSelect;

// ─── SLA Policies (per scope+key SLA rules) ───────────────────────────────────

export const slaPoliciesTable = pgTable("sla_policies", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  scope: text("scope").notNull(), // 'task' | 'alert'
  // matchKey: for tasks → priority value ("High"/"Medium"/"Low"); for alerts → severity value
  matchKey: text("match_key").notNull(),
  hoursToResolve: integer("hours_to_resolve").notNull(),
  hoursToEscalate: integer("hours_to_escalate"),
  escalateToRole: text("escalate_to_role"), // role name to escalate to
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSlaPolicySchema = createInsertSchema(slaPoliciesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSlaPolicy = z.infer<typeof insertSlaPolicySchema>;
export type SlaPolicy = typeof slaPoliciesTable.$inferSelect;
