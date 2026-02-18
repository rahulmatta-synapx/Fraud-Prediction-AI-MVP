import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, decimal, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table - fraud analysts and managers
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("analyst"),
  displayName: text("display_name"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Vehicle details embedded in claims
export const vehicleDetailsSchema = z.object({
  make: z.string(),
  model: z.string(),
  year: z.number(),
  registration: z.string(),
  estimatedValue: z.number(),
});

// Claimant history
export const claimantHistorySchema = z.object({
  previousClaims: z.number(),
  lastClaimDate: z.string().nullable(),
  totalPreviousAmount: z.number(),
});

// Claims table - UK motor insurance claims
export const claims = pgTable("claims", {
  id: serial("id").primaryKey(),
  claimRef: varchar("claim_ref", { length: 20 }).notNull().unique(),
  brokerId: varchar("broker_id", { length: 50 }).notNull(), // Broker-level tracking
  policyId: varchar("policy_id", { length: 50 }).notNull(),
  claimAmount: decimal("claim_amount", { precision: 12, scale: 2 }).notNull(),
  accidentDate: timestamp("accident_date").notNull(),
  accidentLocation: text("accident_location").notNull(),
  accidentType: text("accident_type").notNull(),
  accidentDescription: text("accident_description").notNull(),
  vehicleDetails: jsonb("vehicle_details").$type<z.infer<typeof vehicleDetailsSchema>>().notNull(),
  claimantName: text("claimant_name").notNull(),
  claimantHistory: jsonb("claimant_history").$type<z.infer<typeof claimantHistorySchema>>().notNull(),
  documents: jsonb("documents").$type<string[]>().default([]),
  status: text("status").notNull().default("new"),
  fraudScore: integer("fraud_score"),
  riskBand: text("risk_band"),
  assignedTo: varchar("assigned_to").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  scoredAt: timestamp("scored_at"),
});

// Broker statistics table - tracks historical and recent high-value policy distribution
export const brokerStatistics = pgTable("broker_statistics", {
  id: serial("id").primaryKey(),
  brokerId: varchar("broker_id", { length: 50 }).notNull().unique(),
  historicalWindowStart: timestamp("historical_window_start").notNull(),
  historicalWindowEnd: timestamp("historical_window_end").notNull(),
  recentWindowStart: timestamp("recent_window_start").notNull(),
  recentWindowEnd: timestamp("recent_window_end").notNull(),
  highValueThreshold: decimal("high_value_threshold", { precision: 12, scale: 2 }).notNull(),
  historicalHighValueCount: integer("historical_high_value_count").notNull(),
  historicalTotalCount: integer("historical_total_count").notNull(),
  recentHighValueCount: integer("recent_high_value_count").notNull(),
  recentTotalCount: integer("recent_total_count").notNull(),
  deviationPercent: decimal("deviation_percent", { precision: 5, scale: 2 }).notNull(),
  severity: text("severity"), // low, medium, high
  alertGeneratedAt: timestamp("alert_generated_at"),
  suppressed: integer("suppressed").default(0), // 1 if suppressed for edge cases
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// LLM Signals - neutral observations from AI analysis
export const llmSignals = pgTable("llm_signals", {
  id: serial("id").primaryKey(),
  claimId: integer("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
  signalType: text("signal_type").notNull(),
  description: text("description").notNull(),
  evidence: text("evidence").notNull(),
  confidence: decimal("confidence", { precision: 3, scale: 2 }).notNull(),
  sourceDocument: text("source_document"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Rule triggers - which rules fired during scoring
export const ruleTriggers = pgTable("rule_triggers", {
  id: serial("id").primaryKey(),
  claimId: integer("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
  ruleId: varchar("rule_id", { length: 50 }).notNull(),
  ruleName: text("rule_name").notNull(),
  ruleDescription: text("rule_description").notNull(),
  weight: integer("weight").notNull(),
  triggered: text("triggered").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Audit log - immutable trail of all changes
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  claimId: integer("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  fieldChanged: text("field_changed"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  reasonCategory: text("reason_category"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
  displayName: true,
});

export const insertClaimSchema = createInsertSchema(claims).omit({
  id: true,
  claimRef: true,
  status: true,
  fraudScore: true,
  riskBand: true,
  createdAt: true,
  updatedAt: true,
  scoredAt: true,
}).extend({
  brokerId: z.string(),
  vehicleDetails: vehicleDetailsSchema,
  claimantHistory: claimantHistorySchema,
});

export const insertLlmSignalSchema = createInsertSchema(llmSignals).omit({
  id: true,
  createdAt: true,
});

export const insertRuleTriggerSchema = createInsertSchema(ruleTriggers).omit({
  id: true,
  createdAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

// Override input schema
export const overrideInputSchema = z.object({
  newScore: z.number().min(0).max(100),
  reasonCategory: z.enum([
    "false_positive",
    "additional_evidence",
    "disagree_with_signal",
    "manual_review_complete",
    "other",
  ]),
  notes: z.string().min(1, "Notes are required"),
});

// Claim status enum
export const claimStatusEnum = z.enum([
  "new",
  "scored",
  "reviewing",
  "decided",
]);

// Risk band enum
export const riskBandEnum = z.enum([
  "high",
  "medium",
  "low",
]);

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertClaim = z.infer<typeof insertClaimSchema>;
export type Claim = typeof claims.$inferSelect;
export type InsertLlmSignal = z.infer<typeof insertLlmSignalSchema>;
export type LlmSignal = typeof llmSignals.$inferSelect;
export type InsertRuleTrigger = z.infer<typeof insertRuleTriggerSchema>;
export type RuleTrigger = typeof ruleTriggers.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type OverrideInput = z.infer<typeof overrideInputSchema>;
export type ClaimStatus = z.infer<typeof claimStatusEnum>;
export type RiskBand = z.infer<typeof riskBandEnum>;

export type BrokerStatistics = typeof brokerStatistics.$inferSelect;

// Claim with full details for API responses
export type ClaimWithDetails = Claim & {
  signals: LlmSignal[];
  ruleTriggers: RuleTrigger[];
  auditLogs: AuditLog[];
};
