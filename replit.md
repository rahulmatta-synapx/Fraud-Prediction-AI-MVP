# FraudGuard AI - UK Motor Insurance Fraud Prediction Agent

## Overview
A human-in-the-loop AI decision support system for UK motor insurance fraud analysts. The system provides risk score recommendations (0-100) but all final decisions are made by qualified human investigators.

**Key Principles:**
- AI provides recommendations only - humans make all final decisions
- Score overrides require mandatory reason and notes for audit compliance
- All changes are logged in an immutable audit trail
- Neutral, non-judgmental language in AI analysis

## Technology Stack
- **Frontend:** React 18 + TypeScript, Wouter routing, TailwindCSS, Shadcn/UI
- **Backend:** Express.js, PostgreSQL (Drizzle ORM)
- **AI:** OpenAI GPT-5-mini via Replit AI Integrations
- **Port:** 5000 (frontend and API)

## Project Structure
```
├── client/src/
│   ├── components/       # UI components (risk badges, forms, tables)
│   ├── pages/           # Route pages (dashboard, claims, stats)
│   └── App.tsx          # Main app with sidebar layout
├── server/
│   ├── routes.ts        # API endpoints
│   ├── storage.ts       # Database operations
│   ├── llm-analyzer.ts  # OpenAI integration for signal detection
│   ├── rules-engine.ts  # Configurable scoring rules
│   └── seed.ts          # Sample UK claims data
└── shared/
    └── schema.ts        # Drizzle schema and Zod validation
```

## Risk Scoring System
- **Score Range:** 0-100
- **Risk Bands:**
  - High Risk: 70-100 (red)
  - Medium Risk: 40-69 (amber)
  - Low Risk: 0-39 (green)

## Rules Engine
10 configurable rules with weighted scoring:
- High claim-to-value ratio (+15)
- Claim exceeds vehicle value (+25)
- Multiple previous claims (+10)
- High historical claim amount (+12)
- New policy pattern (+8)
- Old vehicle high claim (+10)
- Theft claim type (+8)
- Fire damage claim (+10)
- AI high-confidence signals (+15)
- Multiple AI observations (+12)

## API Endpoints
- `GET /api/claims` - List all claims (sorted by score)
- `GET /api/claims/:id` - Get claim with signals, rules, audit logs
- `POST /api/claims` - Create new claim (triggers async scoring)
- `POST /api/claims/:id/rescore` - Re-run AI analysis and rules
- `POST /api/claims/:id/override` - Override score with reason/notes
- `PATCH /api/claims/:id/status` - Update claim status
- `GET /api/stats` - Dashboard statistics

## Database Schema
- **users** - Analysts and system accounts
- **claims** - Motor insurance claim records
- **llm_signals** - AI-detected patterns (neutral observations)
- **rule_triggers** - Which rules fired for each claim
- **audit_logs** - Immutable change trail

## LLM Signal Detection
Uses GPT-5-mini with strict prompting for neutral language:
- No words like "suspicious", "fraudulent", "deceptive"
- Focus on factual observations only
- Confidence scores (0.0-1.0) for each signal
- Signal types: Date Mismatch, Cost Anomaly, Description Gap, etc.

## Override Workflow
1. Analyst reviews claim and AI recommendations
2. Clicks "Override Score" button
3. Adjusts score via slider (0-100)
4. Selects mandatory reason category:
   - False Positive
   - Additional Evidence
   - Disagree with Signal
   - Manual Review Complete
   - Other
5. Provides required notes explaining decision
6. System logs change to audit trail

## Recent Changes
- 2026-02-02: Initial implementation complete
  - Full schema with claims, signals, rules, audit logs
  - Professional dark navy sidebar with cyan accents
  - Complete CRUD operations for claims
  - LLM integration for neutral signal detection
  - Rules engine with 10 configurable rules
  - Override form with mandatory reason/notes
  - Immutable audit trail
  - 7 seed claims for UK motor insurance scenarios
