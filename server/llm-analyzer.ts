import OpenAI from "openai";
import type { Claim, InsertLlmSignal } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const ANALYSIS_PROMPT = `You are a neutral fraud analysis assistant for UK motor insurance claims. Your role is to identify potential inconsistencies, anomalies, or noteworthy patterns in claim data. You do NOT determine if something is fraudulent - you only highlight observations that may warrant further human investigation.

CRITICAL RULES:
1. Use neutral, objective language only. Never use words like "suspicious", "fraudulent", "deceptive", "dishonest", or similar judgmental terms.
2. Focus on factual observations: date mismatches, unusual values, inconsistencies in narrative.
3. For each observation, cite specific evidence from the data.
4. Provide a confidence level (0.0 to 1.0) for each observation.
5. If the claim appears straightforward, return fewer signals.

TYPES OF SIGNALS TO LOOK FOR:
- Date inconsistencies (accident date vs claim submission timing)
- Repair cost anomalies (amounts significantly above/below vehicle value)
- Description inconsistencies (narrative contradictions)
- History patterns (frequent claims, high cumulative amounts)
- Location/timing patterns (unusual accident circumstances)
- Documentation gaps (missing expected details)

OUTPUT FORMAT:
Return a JSON array of signals. Each signal should have:
- signalType: A short category name (e.g., "Date Mismatch", "Cost Anomaly", "Description Gap")
- description: A neutral description of the observation
- evidence: The specific data that led to this observation
- confidence: A number from 0.0 to 1.0

Example output:
[
  {
    "signalType": "Repair Cost Note",
    "description": "The claimed repair amount represents a significant proportion of the vehicle's estimated value",
    "evidence": "Claim amount: £8,500 for vehicle valued at £12,000 (71% of value)",
    "confidence": 0.75
  }
]

If no noteworthy patterns are found, return an empty array: []`;

export interface AnalysisSignal {
  signalType: string;
  description: string;
  evidence: string;
  confidence: number;
}

export async function analyzeClaim(claim: Claim): Promise<AnalysisSignal[]> {
  const vehicleDetails = claim.vehicleDetails as { make: string; model: string; year: number; registration: string; estimatedValue: number };
  const claimantHistory = claim.claimantHistory as { previousClaims: number; lastClaimDate: string | null; totalPreviousAmount: number };

  const claimData = `
CLAIM DATA FOR ANALYSIS:
========================
Claim Reference: ${claim.claimRef}
Claim Amount: £${Number(claim.claimAmount).toLocaleString()}
Accident Date: ${new Date(claim.accidentDate).toDateString()}
Claim Submitted: ${new Date(claim.createdAt).toDateString()}
Accident Location: ${claim.accidentLocation}
Accident Type: ${claim.accidentType}

VEHICLE INFORMATION:
- Make/Model: ${vehicleDetails.year} ${vehicleDetails.make} ${vehicleDetails.model}
- Registration: ${vehicleDetails.registration}
- Estimated Value: £${vehicleDetails.estimatedValue.toLocaleString()}

CLAIMANT HISTORY:
- Previous Claims: ${claimantHistory.previousClaims}
- Total Previous Amount: £${claimantHistory.totalPreviousAmount.toLocaleString()}
- Last Claim Date: ${claimantHistory.lastClaimDate || "None"}

ACCIDENT DESCRIPTION:
${claim.accidentDescription}
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: ANALYSIS_PROMPT },
        { role: "user", content: claimData },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    const signals = Array.isArray(parsed) ? parsed : (parsed.signals || []);
    
    return signals.filter((s: any) => 
      s.signalType && 
      s.description && 
      s.evidence && 
      typeof s.confidence === 'number'
    );
  } catch (error) {
    console.error("LLM analysis error:", error);
    return [];
  }
}

export function convertToInsertSignals(claimId: number, signals: AnalysisSignal[]): InsertLlmSignal[] {
  return signals.map(signal => ({
    claimId,
    signalType: signal.signalType,
    description: signal.description,
    evidence: signal.evidence,
    confidence: signal.confidence.toFixed(2),
    sourceDocument: null,
  }));
}
