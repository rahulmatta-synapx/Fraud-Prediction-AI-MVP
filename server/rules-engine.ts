import type { Claim, InsertRuleTrigger, LlmSignal } from "@shared/schema";

export interface RuleConfig {
  id: string;
  name: string;
  description: string;
  weight: number;
  condition: (claim: Claim, signals: LlmSignal[]) => { triggered: boolean; reason: string };
}

// Configurable rules for UK motor insurance fraud scoring
const RULES: RuleConfig[] = [
  {
    id: "high_claim_to_value",
    name: "High Claim-to-Value Ratio",
    description: "Claim amount exceeds 50% of vehicle value",
    weight: 15,
    condition: (claim) => {
      const vehicleDetails = claim.vehicleDetails as { estimatedValue: number };
      const ratio = Number(claim.claimAmount) / vehicleDetails.estimatedValue;
      return {
        triggered: ratio > 0.5,
        reason: `Claim is ${Math.round(ratio * 100)}% of vehicle value (£${Number(claim.claimAmount).toLocaleString()} / £${vehicleDetails.estimatedValue.toLocaleString()})`,
      };
    },
  },
  {
    id: "excessive_claim_amount",
    name: "Excessive Claim Amount",
    description: "Claim amount exceeds vehicle value",
    weight: 25,
    condition: (claim) => {
      const vehicleDetails = claim.vehicleDetails as { estimatedValue: number };
      const exceeds = Number(claim.claimAmount) > vehicleDetails.estimatedValue;
      return {
        triggered: exceeds,
        reason: `Claim £${Number(claim.claimAmount).toLocaleString()} exceeds vehicle value £${vehicleDetails.estimatedValue.toLocaleString()}`,
      };
    },
  },
  {
    id: "multiple_previous_claims",
    name: "Multiple Previous Claims",
    description: "Claimant has 3 or more previous claims",
    weight: 10,
    condition: (claim) => {
      const history = claim.claimantHistory as { previousClaims: number };
      return {
        triggered: history.previousClaims >= 3,
        reason: `Claimant has ${history.previousClaims} previous claims on record`,
      };
    },
  },
  {
    id: "high_historical_amount",
    name: "High Historical Claim Amount",
    description: "Total previous claims exceed £20,000",
    weight: 12,
    condition: (claim) => {
      const history = claim.claimantHistory as { totalPreviousAmount: number };
      return {
        triggered: history.totalPreviousAmount > 20000,
        reason: `Previous claim total: £${history.totalPreviousAmount.toLocaleString()}`,
      };
    },
  },
  {
    id: "recent_policy",
    name: "New Policy Pattern",
    description: "Claim made within first 90 days of accident date (proxy for new policy)",
    weight: 8,
    condition: (claim) => {
      const accidentDate = new Date(claim.accidentDate);
      const claimDate = new Date(claim.createdAt);
      const daysSinceAccident = Math.floor((claimDate.getTime() - accidentDate.getTime()) / (1000 * 60 * 60 * 24));
      return {
        triggered: daysSinceAccident < 7,
        reason: `Claim submitted ${daysSinceAccident} days after accident`,
      };
    },
  },
  {
    id: "old_vehicle_high_claim",
    name: "Old Vehicle High Claim",
    description: "Vehicle over 10 years old with claim over £5,000",
    weight: 10,
    condition: (claim) => {
      const vehicleDetails = claim.vehicleDetails as { year: number };
      const vehicleAge = new Date().getFullYear() - vehicleDetails.year;
      const triggered = vehicleAge > 10 && Number(claim.claimAmount) > 5000;
      return {
        triggered,
        reason: `${vehicleAge}-year-old vehicle with £${Number(claim.claimAmount).toLocaleString()} claim`,
      };
    },
  },
  {
    id: "theft_type",
    name: "Theft Claim Type",
    description: "Claim type is theft (higher risk category)",
    weight: 8,
    condition: (claim) => ({
      triggered: claim.accidentType === "theft",
      reason: "Theft claims require additional verification",
    }),
  },
  {
    id: "fire_damage",
    name: "Fire Damage Claim",
    description: "Claim type is fire (higher risk category)",
    weight: 10,
    condition: (claim) => ({
      triggered: claim.accidentType === "fire",
      reason: "Fire damage claims require thorough investigation",
    }),
  },
  {
    id: "ai_high_confidence_signals",
    name: "AI High-Confidence Signals",
    description: "AI analysis detected patterns with 80%+ confidence",
    weight: 15,
    condition: (_, signals) => {
      const highConfidence = signals.filter(s => Number(s.confidence) >= 0.8);
      return {
        triggered: highConfidence.length > 0,
        reason: `${highConfidence.length} high-confidence observation(s) from AI analysis`,
      };
    },
  },
  {
    id: "multiple_ai_signals",
    name: "Multiple AI Observations",
    description: "AI analysis detected 3+ noteworthy patterns",
    weight: 12,
    condition: (_, signals) => ({
      triggered: signals.length >= 3,
      reason: `${signals.length} observations flagged by AI analysis`,
    }),
  },
];

export interface ScoringResult {
  score: number;
  riskBand: "high" | "medium" | "low";
  triggeredRules: InsertRuleTrigger[];
}

export function calculateScore(claim: Claim, signals: LlmSignal[]): ScoringResult {
  const triggeredRules: InsertRuleTrigger[] = [];
  let totalScore = 0;

  for (const rule of RULES) {
    const result = rule.condition(claim, signals);
    if (result.triggered) {
      totalScore += rule.weight;
      triggeredRules.push({
        claimId: claim.id,
        ruleId: rule.id,
        ruleName: rule.name,
        ruleDescription: rule.description,
        weight: rule.weight,
        triggered: result.reason,
      });
    }
  }

  // Normalize score to 0-100 range (max possible ~125 from all rules)
  const normalizedScore = Math.min(100, Math.round((totalScore / 100) * 100));

  // Determine risk band
  let riskBand: "high" | "medium" | "low";
  if (normalizedScore >= 70) {
    riskBand = "high";
  } else if (normalizedScore >= 40) {
    riskBand = "medium";
  } else {
    riskBand = "low";
  }

  return {
    score: normalizedScore,
    riskBand,
    triggeredRules,
  };
}
