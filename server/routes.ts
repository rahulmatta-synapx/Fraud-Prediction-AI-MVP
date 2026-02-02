import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { analyzeClaim, convertToInsertSignals } from "./llm-analyzer";
import { calculateScore } from "./rules-engine";
import { insertClaimSchema, overrideInputSchema } from "@shared/schema";
import { z } from "zod";

const SYSTEM_USER_ID = "system";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Ensure system user exists for audit logs
  const ensureSystemUser = async () => {
    const existing = await storage.getUserByUsername("system");
    if (!existing) {
      await storage.createUser({
        username: "system",
        password: "system",
        role: "system",
        displayName: "System",
      });
    }
  };
  await ensureSystemUser().catch(console.error);

  // Get all claims (sorted by score descending)
  app.get("/api/claims", async (req, res) => {
    try {
      const claims = await storage.getAllClaims();
      res.json(claims);
    } catch (error) {
      console.error("Error fetching claims:", error);
      res.status(500).json({ error: "Failed to fetch claims" });
    }
  });

  // Get dashboard stats
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Get single claim with details
  app.get("/api/claims/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid claim ID" });
      }

      const claim = await storage.getClaimWithDetails(id);
      if (!claim) {
        return res.status(404).json({ error: "Claim not found" });
      }

      res.json(claim);
    } catch (error) {
      console.error("Error fetching claim:", error);
      res.status(500).json({ error: "Failed to fetch claim" });
    }
  });

  // Create new claim
  app.post("/api/claims", async (req, res) => {
    try {
      const validated = insertClaimSchema.parse(req.body);
      
      const claim = await storage.createClaim(validated);

      // Log claim creation
      await storage.createAuditLog({
        claimId: claim.id,
        userId: SYSTEM_USER_ID,
        action: "claim_created",
        fieldChanged: null,
        oldValue: null,
        newValue: claim.claimRef,
        reasonCategory: null,
        notes: "Claim submitted for analysis",
      });

      // Trigger async scoring (don't await to respond faster)
      scoreClaim(claim.id).catch(console.error);

      res.status(201).json(claim);
    } catch (error) {
      console.error("Error creating claim:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create claim" });
    }
  });

  // Rescore a claim
  app.post("/api/claims/:id/rescore", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid claim ID" });
      }

      const claim = await storage.getClaim(id);
      if (!claim) {
        return res.status(404).json({ error: "Claim not found" });
      }

      await scoreClaim(id);
      
      const updated = await storage.getClaimWithDetails(id);
      res.json(updated);
    } catch (error) {
      console.error("Error rescoring claim:", error);
      res.status(500).json({ error: "Failed to rescore claim" });
    }
  });

  // Override claim score
  app.post("/api/claims/:id/override", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid claim ID" });
      }

      const claim = await storage.getClaim(id);
      if (!claim) {
        return res.status(404).json({ error: "Claim not found" });
      }

      const validated = overrideInputSchema.parse(req.body);

      const oldScore = claim.fraudScore;
      const newScore = validated.newScore;
      const newRiskBand = newScore >= 70 ? "high" : newScore >= 40 ? "medium" : "low";

      // Update claim
      await storage.updateClaim(id, {
        fraudScore: newScore,
        riskBand: newRiskBand,
      });

      // Log the override in audit trail
      await storage.createAuditLog({
        claimId: id,
        userId: SYSTEM_USER_ID, // In production, use authenticated user
        action: "score_override",
        fieldChanged: "fraudScore",
        oldValue: oldScore?.toString() ?? "null",
        newValue: newScore.toString(),
        reasonCategory: validated.reasonCategory,
        notes: validated.notes,
      });

      const updated = await storage.getClaimWithDetails(id);
      res.json(updated);
    } catch (error) {
      console.error("Error overriding score:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to override score" });
    }
  });

  // Update claim status
  app.patch("/api/claims/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid claim ID" });
      }

      const claim = await storage.getClaim(id);
      if (!claim) {
        return res.status(404).json({ error: "Claim not found" });
      }

      const { status } = req.body;
      if (!["new", "scored", "reviewing", "decided"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const oldStatus = claim.status;

      await storage.updateClaim(id, { status });

      // Log status change
      await storage.createAuditLog({
        claimId: id,
        userId: SYSTEM_USER_ID,
        action: "status_change",
        fieldChanged: "status",
        oldValue: oldStatus,
        newValue: status,
        reasonCategory: null,
        notes: null,
      });

      const updated = await storage.getClaimWithDetails(id);
      res.json(updated);
    } catch (error) {
      console.error("Error updating status:", error);
      res.status(500).json({ error: "Failed to update status" });
    }
  });

  return httpServer;
}

// Helper function to score a claim
async function scoreClaim(claimId: number): Promise<void> {
  const claim = await storage.getClaim(claimId);
  if (!claim) return;

  // Clear existing signals and triggers for rescore
  await storage.deleteSignalsByClaimId(claimId);
  await storage.deleteRuleTriggersByClaimId(claimId);

  // Run LLM analysis
  const analysisSignals = await analyzeClaim(claim);
  
  // Save LLM signals
  const insertSignals = convertToInsertSignals(claimId, analysisSignals);
  for (const signal of insertSignals) {
    await storage.createSignal(signal);
  }

  // Get signals for rules engine
  const savedSignals = await storage.getSignalsByClaimId(claimId);

  // Calculate score using rules engine
  const scoringResult = calculateScore(claim, savedSignals);

  // Save rule triggers
  for (const trigger of scoringResult.triggeredRules) {
    await storage.createRuleTrigger(trigger);
  }

  // Update claim with score
  await storage.updateClaim(claimId, {
    fraudScore: scoringResult.score,
    riskBand: scoringResult.riskBand,
    status: "scored",
    scoredAt: new Date(),
  });

  // Log scoring
  await storage.createAuditLog({
    claimId,
    userId: SYSTEM_USER_ID,
    action: "score_calculated",
    fieldChanged: "fraudScore",
    oldValue: null,
    newValue: scoringResult.score.toString(),
    reasonCategory: null,
    notes: `AI analysis: ${analysisSignals.length} signals, ${scoringResult.triggeredRules.length} rules triggered`,
  });
}
