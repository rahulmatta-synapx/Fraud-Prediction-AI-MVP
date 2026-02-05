# FraudGuard AI - UK Motor Insurance Fraud Prediction Agent

## Overview
A human-in-the-loop AI decision support system for UK motor insurance fraud analysts. The system provides risk score recommendations (0-100) for analysis purposes. Claims are read-only after submission to ensure data integrity.

**Key Principles:**
- AI provides risk analysis recommendations only (not final decisions)
- Analysts can approve/reject claims with mandatory reason and notes
- Claims become permanently locked after approve/reject decisions
- All changes logged in immutable audit trail
- Neutral, non-judgmental language in AI justification

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
- **Score Range:** 0-100 (sum of triggered rule weights, capped at 100)
- **Risk Bands & Actions:**
  - Low Risk: < 30 (green) → Auto-approve
  - Medium Risk: 30-60 (amber) → Manual review
  - High Risk: > 60 (red) → SIU referral

## Rules Engine
10 configurable UK motor fraud rules with weighted scoring:

| Rule | Weight | Trigger |
|------|--------|---------|
| Late Notification | +20 | Claim submitted >14 days after incident |
| Suspicious Timing | +10 | Claim submitted between 11pm-5am |
| Early Policy Claim | +30 | New policy with incident within 7 days |
| Frequent Claimant | +25 | More than 2 previous claims |
| Vague Location | +15 | Missing or vague incident location |
| Unusual Location | +20 | Accident >100 miles from home |
| Description Mismatch | +30 | Damage description contradicts accident type |
| Invalid Document Timeline | +25 | Document dates precede incident |
| Repeat Third Party | +40 | Same third party in multiple claims |
| Professional Witness | +35 | Same witness in previous claims |

## API Endpoints

### Authentication
- `POST /auth/login` - Login with username/password, returns JWT token
- `GET /auth/me` - Get current authenticated user info

### Claims (require JWT authentication)
- `GET /api/claims` - List all claims (sorted by score)
- `GET /api/claims/:id` - Get claim with signals, rules, audit logs
- `POST /api/claims` - Create new claim (triggers async scoring)
- `GET /api/stats` - Dashboard statistics

### Analyst Decisions (require JWT authentication)
- `POST /api/claims/:id/approve` - Approve claim (requires reason, notes)
- `POST /api/claims/:id/reject` - Reject claim (requires reason, notes)

### Disabled Endpoints (return HTTP 403)
These mutation endpoints remain disabled for data integrity:
- `PATCH /api/claims/:id/fields` - DISABLED (no editing after submission)
- `POST /api/claims/:id/rescore` - DISABLED (score calculated once)
- `POST /api/claims/:id/override` - DISABLED (no score overrides)
- `PATCH /api/claims/:id/status` - DISABLED (use approve/reject instead)

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

## Claim Status
Available statuses:
- **needs_review** - Default status after creation, awaiting analyst decision
- **approved** - Analyst approved the claim
- **rejected** - Analyst rejected the claim

### Workflow:
1. User fills out claim form (optionally using AI document extraction)
2. User reviews all fields before submission
3. Confirmation modal warns about read-only nature
4. User confirms → Claim submitted
5. AI scores claim with rules engine and generates justification
6. Analyst reviews claim, AI risk explanation, and recommendations
7. Analyst makes decision (approve/reject with mandatory reason/notes)
8. Decision is final - claim becomes permanently read-only

## AI Justification
Uses GPT-4.1 to generate structured, audit-compliant risk explanations:
- **risk_overview**: Score interpretation and system assessment
- **key_factors**: List of rules, AI signals, and claim data that contributed to score
- **analyst_guidance**: Review focus points and information gaps
- **confidence_note**: Limitations and confidence disclaimer
- Language is neutral, professional, suitable for court disclosure

## Document Upload & Preview
- Supports PDF and image uploads
- Live preview: PDF shown in iframe, images shown as img tags
- AI extracts claim fields from uploaded documents using GPT-4.1
- User can edit extracted values before submission
- After submission, all values are locked

## Dashboard Features
- Table/list format with sortable rows showing all claims
- Columns: Claim ID, Score, Risk Band, Status, Amount, Type, Registration, Date
- Clickable rows navigate to claim detail page
- High Risk Priority panel for quick access to high-risk claims
- Real-time statistics cards (Total Claims, High Risk, Needs Review, Decisions Made)

## Statistics Page
Real-time aggregated data from Cosmos DB:
- Total claims, high/medium/low risk distribution
- Needs review, approved, rejected counts
- Claims this month, last 24 hours
- Average fraud score, total claim value
- Visual progress bars for risk and status distributions

## Recent Changes
- 2026-02-05: Re-enabled approve/reject with AI justification
  - Analysts can now approve/reject claims with mandatory reason dropdown and notes
  - Added AI Justification service using GPT-4.1 for structured risk explanations
  - Justification includes: risk overview, key factors, analyst guidance, confidence note
  - Decision modal with 7 reason options (Low risk confirmed, High risk - SIU referral, etc.)
  - Claims become permanently read-only after approve/reject decisions
  - Dashboard now uses table/list format with clickable rows
  - Statistics page shows real-time aggregated data (approved/rejected counts, claims this month, etc.)
  - Updated status badges to show: needs_review, approved, rejected
  - Enhanced stats endpoint with detailed metrics
- 2026-02-04: Read-only claims implementation
  - Claims are permanently locked after submission (no editing, rescoring, override)
  - Added confirmation modal before claim submission warning users
  - Enhanced document upload with live PDF/image preview
  - Backend enforces read-only with HTTP 403 on mutation endpoints
  - Added normalize_value() function to prevent false FIELD_EDIT logs
- 2026-02-03: Updated fraud detection rules engine
  - New 10 UK motor fraud rules with specific weights (10-40 points each)
  - Updated risk thresholds: <30 Low, 30-60 Medium, >60 High
  - Added Help/Manual page at /help with comprehensive documentation
  - Fixed 404 bug: Claims now link using claim_id (CLM-xxx) instead of UUID
- 2026-02-03: Migrated to Azure-native architecture
  - Python FastAPI backend replacing Express/TypeScript
  - Azure Cosmos DB for data storage
  - Azure OpenAI GPT-4.1 for document extraction and signals
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
