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
import { tenantsTable, usersTable } from "./platform";

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  title: text("title").notNull(),
  description: text("description"),
  module: text("module"),
  priority: text("priority").notNull().default("Medium"),
  assignedTo: integer("assigned_to").references(() => usersTable.id),
  dueDate: date("due_date"),
  status: text("status").notNull().default("Open"),
  createdBy: integer("created_by").references(() => usersTable.id),
  sourceType: text("source_type").notNull().default("Manual"),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: text("related_entity_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;

// ─── Alerts ───────────────────────────────────────────────────────────────────

export const alertsTable = pgTable("alerts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  alertType: text("alert_type").notNull(),
  severity: text("severity").notNull().default("Medium"),
  message: text("message").notNull(),
  module: text("module"),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: text("related_entity_id"),
  status: text("status").notNull().default("Open"),
  assignedTo: integer("assigned_to").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const insertAlertSchema = createInsertSchema(alertsTable).omit({ id: true, createdAt: true });
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alertsTable.$inferSelect;

// ─── Notifications ────────────────────────────────────────────────────────────

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  type: text("type").notNull().default("info"),
  isRead: boolean("is_read").notNull().default(false),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: text("related_entity_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;

// ─── AI Summary Requests ──────────────────────────────────────────────────────

export const aiSummaryRequestsTable = pgTable("ai_summary_requests", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  requestedBy: integer("requested_by").references(() => usersTable.id),
  provider: text("provider").notNull().default("mock"),
  inputContext: text("input_context"),
  outputSummary: text("output_summary"),
  status: text("status").notNull().default("Pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAiSummaryRequestSchema = createInsertSchema(aiSummaryRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiSummaryRequest = z.infer<typeof insertAiSummaryRequestSchema>;
export type AiSummaryRequest = typeof aiSummaryRequestsTable.$inferSelect;
