# FraudGuard AI - UK Motor Insurance Fraud Prediction Agent

## Overview
A human-in-the-loop AI decision support system for UK motor insurance fraud analysts. The system provides risk score recommendations (0-100) but all final decisions are made by qualified human investigators.

**Key Principles:**
- AI provides recommendations only - humans make all final decisions
- Score overrides require mandatory reason and notes for audit compliance
- All changes are logged in an immutable audit trail
- Neutral, non-judgmental language in AI analysis

## Technology Stack
- **Frontend:** React 18 + TypeScript, Wouter routing, TailwindCSS, Shadcn/UI (Port 5000)
- **Backend:** Python FastAPI with Azure services (Port 8000, proxied through Express)
- **Database:** Azure Cosmos DB
- **AI:** Azure OpenAI GPT-4.1 for document extraction and signal detection
- **Storage:** Azure Blob Storage for document uploads
- **Authentication:** JWT with hardcoded users

## Project Structure
```
├── client/src/
│   ├── components/       # UI components (risk badges, forms, tables)
│   ├── pages/           # Route pages (dashboard, claims, stats, login)
│   ├── lib/             # Auth context, API client
│   └── App.tsx          # Main app with sidebar layout
├── server/
│   └── index.ts         # Express proxy server (routes to FastAPI)
├── backend/
│   └── app/
│       ├── main.py      # FastAPI application entry point
│       ├── models.py    # Pydantic models
│       ├── routers/     # API route handlers (auth, claims)
│       ├── services/    # Business logic (auth, document extraction, rules)
│       └── db/          # Cosmos DB service
└── shared/
    └── schema.ts        # TypeScript types for frontend
```

## Required Environment Variables (Secrets)
Configure these in Replit Secrets for full functionality:
- `COSMOS_CONNECTION_STRING` - Azure Cosmos DB connection string
- `AZURE_OPENAI_ENDPOINT` - Azure OpenAI service endpoint URL
- `AZURE_OPENAI_KEY` - Azure OpenAI API key
- `AZURE_STORAGE_CONNECTION_STRING` - Azure Blob Storage connection string
- `JWT_SECRET` - Secret key for JWT signing (default provided for dev)

## Test Credentials (Hardcoded)
- Username: `jake`, Password: `password123` → Jake Thompson
- Username: `rahul`, Password: `password123` → Rahul Patel
- Username: `navsheen`, Password: `password123` → Navsheen Singh

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

### Authentication
- `POST /auth/login` - Login with username/password, returns JWT token
- `GET /auth/me` - Get current authenticated user info

### Claims (require JWT authentication)
- `GET /api/claims` - List all claims (sorted by score)
- `GET /api/claims/:id` - Get claim with signals, rules, audit logs
- `POST /api/claims` - Create new claim (triggers async scoring)
- `POST /api/claims/:id/rescore` - Re-run AI analysis and rules
- `POST /api/claims/:id/override` - Override score with reason/notes
- `PATCH /api/claims/:id/status` - Update claim status
- `GET /api/stats` - Dashboard statistics

### Document Processing
- `POST /api/documents/extract` - Upload document and extract claim data with GPT-4o

## Database Schema (Cosmos DB)
- **claims** - Motor insurance claim records with fraud scores
- **audit-logs** - Immutable change trail

## LLM Signal Detection
Uses GPT-4o with strict prompting for neutral language:
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

## Field Edit Tracking
When AI auto-fills claim forms from documents:
- Original AI-extracted values are stored
- User edits are tracked and flagged
- Audit trail shows all field modifications

## Recent Changes
- 2026-02-03: Migrated to Azure-native architecture
  - Python FastAPI backend replacing Express/TypeScript
  - Azure Cosmos DB for data storage
  - Azure OpenAI GPT-4o for document extraction and signals
  - Azure Blob Storage for document uploads
  - JWT authentication with 3 hardcoded users
  - Express proxy server routing to FastAPI
  - Updated frontend for snake_case API responses
  - Login page with auth context
  - Document extraction in Submit Claim form
- 2026-02-02: Initial implementation complete
  - Full schema with claims, signals, rules, audit logs
  - Professional dark navy sidebar with cyan accents
  - Complete CRUD operations for claims
  - Rules engine with 10 configurable rules
  - Override form with mandatory reason/notes
  - Immutable audit trail
