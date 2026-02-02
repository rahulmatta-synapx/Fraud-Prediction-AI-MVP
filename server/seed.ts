import { db } from "./db";
import { users, claims, llmSignals, ruleTriggers, auditLogs } from "@shared/schema";
import { sql } from "drizzle-orm";

const sampleClaims = [
  {
    policyId: "POL-2024-001234",
    claimAmount: "8500.00",
    accidentDate: new Date("2026-01-15"),
    accidentLocation: "High Street, Manchester",
    accidentType: "rear_end",
    accidentDescription: "I was stationary at a red traffic light when another vehicle collided with the rear of my car. The impact caused significant damage to the rear bumper, boot, and exhaust system. There were two witnesses at the scene who provided their details.",
    claimantName: "James Thompson",
    vehicleDetails: {
      make: "BMW",
      model: "3 Series",
      year: 2021,
      registration: "AB21 XYZ",
      estimatedValue: 28000,
    },
    claimantHistory: {
      previousClaims: 0,
      lastClaimDate: null,
      totalPreviousAmount: 0,
    },
  },
  {
    policyId: "POL-2023-005678",
    claimAmount: "15200.00",
    accidentDate: new Date("2026-01-20"),
    accidentLocation: "A40 Western Avenue, London",
    accidentType: "collision",
    accidentDescription: "Was driving westbound on the A40 when a vehicle merged into my lane without indicating. Attempted evasive action but still made contact. Vehicle sustained front-end damage including bumper, headlights, and radiator.",
    claimantName: "Sarah Mitchell",
    vehicleDetails: {
      make: "Mercedes",
      model: "C-Class",
      year: 2022,
      registration: "DE22 ABC",
      estimatedValue: 35000,
    },
    claimantHistory: {
      previousClaims: 1,
      lastClaimDate: "2024-06-15",
      totalPreviousAmount: 3200,
    },
  },
  {
    policyId: "POL-2024-009012",
    claimAmount: "4200.00",
    accidentDate: new Date("2026-01-22"),
    accidentLocation: "Tesco Car Park, Birmingham",
    accidentType: "parking",
    accidentDescription: "Returned to my parked vehicle to find damage to the driver side door and front wing. No note left by responsible party. CCTV request submitted to store management.",
    claimantName: "David Chen",
    vehicleDetails: {
      make: "Volkswagen",
      model: "Golf",
      year: 2020,
      registration: "FG20 HIJ",
      estimatedValue: 18000,
    },
    claimantHistory: {
      previousClaims: 0,
      lastClaimDate: null,
      totalPreviousAmount: 0,
    },
  },
  {
    policyId: "POL-2022-003456",
    claimAmount: "22500.00",
    accidentDate: new Date("2026-01-10"),
    accidentLocation: "M1 Motorway Junction 25",
    accidentType: "side_impact",
    accidentDescription: "A lorry changed lanes on the motorway and made contact with my vehicle. The force pushed me into the central reservation barrier. Emergency services attended. Vehicle is likely a total loss. I sustained minor whiplash injury.",
    claimantName: "Patricia Williams",
    vehicleDetails: {
      make: "Audi",
      model: "A4",
      year: 2023,
      registration: "KL23 MNO",
      estimatedValue: 32000,
    },
    claimantHistory: {
      previousClaims: 4,
      lastClaimDate: "2025-03-20",
      totalPreviousAmount: 28500,
    },
  },
  {
    policyId: "POL-2023-007890",
    claimAmount: "6800.00",
    accidentDate: new Date("2026-01-25"),
    accidentLocation: "Residential Street, Leeds",
    accidentType: "vandalism",
    accidentDescription: "Discovered vehicle vandalised overnight. All four tyres slashed, bodywork keyed along both sides, and wing mirrors broken. Police report filed under crime reference CR/2026/1234.",
    claimantName: "Michael Brown",
    vehicleDetails: {
      make: "Ford",
      model: "Focus",
      year: 2019,
      registration: "PQ19 RST",
      estimatedValue: 12000,
    },
    claimantHistory: {
      previousClaims: 2,
      lastClaimDate: "2024-11-05",
      totalPreviousAmount: 4800,
    },
  },
  {
    policyId: "POL-2024-002345",
    claimAmount: "45000.00",
    accidentDate: new Date("2026-01-28"),
    accidentLocation: "Private Garage, Edinburgh",
    accidentType: "fire",
    accidentDescription: "Vehicle caught fire while parked in private garage. Fire brigade attended. Cause suspected electrical fault. Vehicle completely destroyed. Garage also damaged - separate building claim.",
    claimantName: "Robert Campbell",
    vehicleDetails: {
      make: "Range Rover",
      model: "Sport",
      year: 2024,
      registration: "UV24 WXY",
      estimatedValue: 75000,
    },
    claimantHistory: {
      previousClaims: 1,
      lastClaimDate: "2023-08-12",
      totalPreviousAmount: 5200,
    },
  },
  {
    policyId: "POL-2021-008765",
    claimAmount: "9800.00",
    accidentDate: new Date("2026-01-18"),
    accidentLocation: "Roundabout, Bristol",
    accidentType: "collision",
    accidentDescription: "Another driver failed to give way at a roundabout and drove into the side of my vehicle. The other driver admitted fault at the scene. Both vehicles were driveable but mine requires significant panel work.",
    claimantName: "Emma Johnson",
    vehicleDetails: {
      make: "Toyota",
      model: "Corolla",
      year: 2022,
      registration: "ZA22 BCD",
      estimatedValue: 22000,
    },
    claimantHistory: {
      previousClaims: 0,
      lastClaimDate: null,
      totalPreviousAmount: 0,
    },
  },
];

export async function seedDatabase() {
  console.log("Checking if seed data exists...");
  
  const existingClaims = await db.select().from(claims).limit(1);
  if (existingClaims.length > 0) {
    console.log("Seed data already exists, skipping...");
    return;
  }

  console.log("Seeding database with sample UK motor insurance claims...");

  // Create system user
  await db.insert(users).values({
    id: "system",
    username: "system",
    password: "system",
    role: "system",
    displayName: "System",
  }).onConflictDoNothing();

  // Create analyst user
  await db.insert(users).values({
    id: "analyst-001",
    username: "john.analyst",
    password: "password123",
    role: "analyst",
    displayName: "John Smith",
  }).onConflictDoNothing();

  // Create sample claims
  for (let i = 0; i < sampleClaims.length; i++) {
    const claimData = sampleClaims[i];
    const claimRef = `CLM-2026-${(10001 + i).toString()}`;
    
    const [claim] = await db.insert(claims).values({
      claimRef,
      ...claimData,
    }).returning();

    // Add audit log for creation
    await db.insert(auditLogs).values({
      claimId: claim.id,
      userId: "system",
      action: "claim_created",
      fieldChanged: null,
      oldValue: null,
      newValue: claimRef,
      reasonCategory: null,
      notes: "Seed data - claim imported",
    });

    // Add some sample signals for high-value claims
    if (Number(claimData.claimAmount) > 15000) {
      await db.insert(llmSignals).values({
        claimId: claim.id,
        signalType: "Cost Analysis",
        description: "Claim amount represents a significant proportion of the vehicle's estimated value",
        evidence: `Claim: £${claimData.claimAmount} vs Vehicle Value: £${claimData.vehicleDetails.estimatedValue.toLocaleString()}`,
        confidence: "0.72",
        sourceDocument: null,
      });
    }

    if (claimData.claimantHistory.previousClaims > 2) {
      await db.insert(llmSignals).values({
        claimId: claim.id,
        signalType: "History Pattern",
        description: "Claimant has submitted multiple claims over a relatively short period",
        evidence: `${claimData.claimantHistory.previousClaims} previous claims totalling £${claimData.claimantHistory.totalPreviousAmount.toLocaleString()}`,
        confidence: "0.65",
        sourceDocument: null,
      });
    }

    // Add rule triggers for certain claims
    if (claimData.accidentType === "fire") {
      await db.insert(ruleTriggers).values({
        claimId: claim.id,
        ruleId: "fire_damage",
        ruleName: "Fire Damage Claim",
        ruleDescription: "Claim type is fire (higher risk category)",
        weight: 10,
        triggered: "Fire damage claims require thorough investigation",
      });

      // Score this claim higher
      await db.update(claims)
        .set({ 
          fraudScore: 75, 
          riskBand: "high", 
          status: "scored",
          scoredAt: new Date(),
        })
        .where(sql`${claims.id} = ${claim.id}`);
    } else if (claimData.claimantHistory.previousClaims > 2) {
      await db.insert(ruleTriggers).values({
        claimId: claim.id,
        ruleId: "multiple_previous_claims",
        ruleName: "Multiple Previous Claims",
        ruleDescription: "Claimant has 3 or more previous claims",
        weight: 10,
        triggered: `Claimant has ${claimData.claimantHistory.previousClaims} previous claims`,
      });

      await db.update(claims)
        .set({ 
          fraudScore: 62, 
          riskBand: "medium", 
          status: "scored",
          scoredAt: new Date(),
        })
        .where(sql`${claims.id} = ${claim.id}`);
    } else {
      // Low risk scores
      const randomScore = 15 + Math.floor(Math.random() * 20);
      await db.update(claims)
        .set({ 
          fraudScore: randomScore, 
          riskBand: "low", 
          status: "scored",
          scoredAt: new Date(),
        })
        .where(sql`${claims.id} = ${claim.id}`);
    }
  }

  console.log(`Seeded ${sampleClaims.length} sample claims`);
}
