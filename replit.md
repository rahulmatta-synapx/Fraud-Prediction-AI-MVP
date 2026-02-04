# FraudGuard AI - UK Motor Insurance Fraud Prediction Agent

## Overview
A human-in-the-loop AI decision support system for UK motor insurance fraud analysts. The system provides risk score recommendations (0-100) for analysis purposes. Claims are read-only after submission to ensure data integrity.

**Key Principles:**
- AI provides risk analysis recommendations only
- Claims are permanently locked after submission (no editing, rescoring, or decisions)
- Confirmation modal warns users before final claim submission
- All changes logged in immutable audit trail
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

### Disabled Endpoints (return HTTP 403)
All mutation endpoints are disabled - claims are read-only after submission:
- `PATCH /api/claims/:id/fields` - DISABLED
- `POST /api/claims/:id/rescore` - DISABLED
- `POST /api/claims/:id/approve` - DISABLED
- `POST /api/claims/:id/reject` - DISABLED
- `POST /api/claims/:id/override` - DISABLED
- `PATCH /api/claims/:id/status` - DISABLED

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

## Claim Status (Read-Only)
Claims are permanently locked after submission:
- **needs_review** - Default status after creation
- Claims cannot be edited, rescored, approved, or rejected after submission
- Fraud score is calculated once at submission time and cannot be changed

### Workflow:
1. User fills out claim form (optionally using AI document extraction)
2. User reviews all fields before submission
3. Confirmation modal warns about read-only nature
4. User confirms → Claim submitted and permanently locked
5. AI scores claim with rules engine
6. Analyst reviews claim and AI recommendations (read-only view)

## Document Upload & Preview
- Supports PDF and image uploads
- Live preview: PDF shown in iframe, images shown as img tags
- AI extracts claim fields from uploaded documents using GPT-4.1
- User can edit extracted values before submission
- After submission, all values are locked

## Dashboard Features
- Clickable claim cards with rich information display
- Cards show: fraud score (color-coded), status badge, claim amount, accident type, vehicle registration, submission date
- Cards have color-coded backgrounds based on risk level
- High Risk Priority panel for quick access to high-risk claims

## Recent Changes
- 2026-02-04: Read-only claims implementation
  - Claims are now permanently locked after submission
  - Removed all editing, rescoring, approval/rejection functionality
  - Added confirmation modal before claim submission warning users
  - Enhanced document upload with live PDF/image preview
  - Improved dashboard with clickable claim cards showing rich info
  - Backend enforces read-only with HTTP 403 on all mutation endpoints
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
