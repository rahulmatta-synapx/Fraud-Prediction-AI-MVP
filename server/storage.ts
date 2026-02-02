import { db } from "./db";
import { 
  users, 
  claims, 
  llmSignals, 
  ruleTriggers, 
  auditLogs,
  type User, 
  type InsertUser,
  type Claim,
  type InsertClaim,
  type LlmSignal,
  type InsertLlmSignal,
  type RuleTrigger,
  type InsertRuleTrigger,
  type AuditLog,
  type InsertAuditLog,
  type ClaimWithDetails,
} from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Claims
  getClaim(id: number): Promise<Claim | undefined>;
  getClaimWithDetails(id: number): Promise<ClaimWithDetails | undefined>;
  getAllClaims(): Promise<Claim[]>;
  createClaim(claim: Omit<InsertClaim, "claimRef">): Promise<Claim>;
  updateClaim(id: number, updates: Partial<Claim>): Promise<Claim | undefined>;
  
  // LLM Signals
  getSignalsByClaimId(claimId: number): Promise<LlmSignal[]>;
  createSignal(signal: InsertLlmSignal): Promise<LlmSignal>;
  deleteSignalsByClaimId(claimId: number): Promise<void>;
  
  // Rule Triggers
  getRuleTriggersByClaimId(claimId: number): Promise<RuleTrigger[]>;
  createRuleTrigger(trigger: InsertRuleTrigger): Promise<RuleTrigger>;
  deleteRuleTriggersByClaimId(claimId: number): Promise<void>;
  
  // Audit Logs
  getAuditLogsByClaimId(claimId: number): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  
  // Stats
  getStats(): Promise<{
    totalClaims: number;
    highRiskClaims: number;
    pendingReview: number;
    overridesThisMonth: number;
  }>;
}

function generateClaimRef(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `CLM-${year}-${random}`;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const [user] = await db.insert(users).values({ ...insertUser, id }).returning();
    return user;
  }

  // Claims
  async getClaim(id: number): Promise<Claim | undefined> {
    const [claim] = await db.select().from(claims).where(eq(claims.id, id));
    return claim;
  }

  async getClaimWithDetails(id: number): Promise<ClaimWithDetails | undefined> {
    const claim = await this.getClaim(id);
    if (!claim) return undefined;

    const [signals, ruleTriggersList, auditLogsList] = await Promise.all([
      this.getSignalsByClaimId(id),
      this.getRuleTriggersByClaimId(id),
      this.getAuditLogsByClaimId(id),
    ]);

    return {
      ...claim,
      signals,
      ruleTriggers: ruleTriggersList,
      auditLogs: auditLogsList,
    };
  }

  async getAllClaims(): Promise<Claim[]> {
    return db.select().from(claims).orderBy(desc(claims.fraudScore), desc(claims.createdAt));
  }

  async createClaim(claimData: Omit<InsertClaim, "claimRef">): Promise<Claim> {
    const claimRef = generateClaimRef();
    const [claim] = await db.insert(claims).values({ 
      ...claimData, 
      claimRef,
      status: "new",
    }).returning();
    return claim;
  }

  async updateClaim(id: number, updates: Partial<Claim>): Promise<Claim | undefined> {
    const [claim] = await db.update(claims)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(claims.id, id))
      .returning();
    return claim;
  }

  // LLM Signals
  async getSignalsByClaimId(claimId: number): Promise<LlmSignal[]> {
    return db.select().from(llmSignals).where(eq(llmSignals.claimId, claimId)).orderBy(desc(llmSignals.confidence));
  }

  async createSignal(signal: InsertLlmSignal): Promise<LlmSignal> {
    const [created] = await db.insert(llmSignals).values(signal).returning();
    return created;
  }

  async deleteSignalsByClaimId(claimId: number): Promise<void> {
    await db.delete(llmSignals).where(eq(llmSignals.claimId, claimId));
  }

  // Rule Triggers
  async getRuleTriggersByClaimId(claimId: number): Promise<RuleTrigger[]> {
    return db.select().from(ruleTriggers).where(eq(ruleTriggers.claimId, claimId)).orderBy(desc(ruleTriggers.weight));
  }

  async createRuleTrigger(trigger: InsertRuleTrigger): Promise<RuleTrigger> {
    const [created] = await db.insert(ruleTriggers).values(trigger).returning();
    return created;
  }

  async deleteRuleTriggersByClaimId(claimId: number): Promise<void> {
    await db.delete(ruleTriggers).where(eq(ruleTriggers.claimId, claimId));
  }

  // Audit Logs
  async getAuditLogsByClaimId(claimId: number): Promise<AuditLog[]> {
    return db.select().from(auditLogs).where(eq(auditLogs.claimId, claimId)).orderBy(desc(auditLogs.createdAt));
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values(log).returning();
    return created;
  }

  // Stats
  async getStats(): Promise<{
    totalClaims: number;
    highRiskClaims: number;
    pendingReview: number;
    overridesThisMonth: number;
  }> {
    const allClaims = await this.getAllClaims();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const overrideLogs = await db.select().from(auditLogs)
      .where(eq(auditLogs.action, "score_override"));
    
    const overridesThisMonth = overrideLogs.filter(
      log => new Date(log.createdAt) >= startOfMonth
    ).length;

    return {
      totalClaims: allClaims.length,
      highRiskClaims: allClaims.filter(c => c.riskBand === "high").length,
      pendingReview: allClaims.filter(c => c.status === "reviewing").length,
      overridesThisMonth,
    };
  }
}

export const storage = new DatabaseStorage();
