from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime
import uuid

AccidentType = Literal[
    "Collision", "Rear-End", "Side Impact", "Rollover", "Hit and Run",
    "Parking Damage", "Theft", "Vandalism", "Fire", "Flood Damage"
]

ActionType = Literal[
    "SCORE_GENERATED", "OVERRIDE", "FIELD_EDIT", "STATUS_CHANGE", 
    "CLAIM_CREATED", "DOCUMENT_UPLOADED", "RESCORE", "APPROVE", "REJECT"
]

ReasonCategory = Literal[
    "false_positive", "additional_evidence", "disagree_with_signal", 
    "manual_review_complete", "low_risk_confirmed", "evidence_supports",
    "high_risk_siu_referral", "insufficient_evidence", "other"
]

RiskBand = Literal["high", "medium", "low"]

ClaimStatus = Literal["needs_review", "in_review", "rescored", "approved", "rejected"]

class User(BaseModel):
    username: str
    full_name: str

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User

class VehicleDetails(BaseModel):
    make: str
    model: str
    year: int
    registration: str
    estimated_value_gbp: float

class ClaimantHistory(BaseModel):
    previous_claims: int = 0
    total_previous_amount_gbp: float = 0.0
    last_claim_date: Optional[str] = None

class FieldEdit(BaseModel):
    field_name: str
    original_value: Optional[str] = None
    edited_value: str
    edited_by: str
    edited_at: datetime
    reason: Optional[str] = None

class LLMSignal(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    signal_type: str
    description: str
    confidence: float
    detected_at: datetime = Field(default_factory=datetime.utcnow)

class RuleTrigger(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    rule_id: str
    rule_name: str
    description: str
    weight: int
    triggered_at: datetime = Field(default_factory=datetime.utcnow)

class DocumentInfo(BaseModel):
    blob_path: str
    blob_url: str
    filename: str
    content_type: str
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    uploaded_by: str

class Claim(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    claim_id: str
    broker_id: str
    claimant_name: str
    policy_id: str
    policy_start_date: Optional[str] = None
    policyholder_address: Optional[str] = None
    num_previous_claims: int = 0
    total_previous_claims_gbp: float = 0.0
    vehicle_make: str
    vehicle_model: str
    vehicle_year: int
    vehicle_registration: str
    vehicle_estimated_value_gbp: float
    accident_date: str
    accident_type: AccidentType
    accident_location: str
    claim_amount_gbp: float
    accident_description: str
    witness_name: Optional[str] = None
    witness_contact: Optional[str] = None
    third_party_name: Optional[str] = None
    third_party_contact: Optional[str] = None
    third_party_vehicle_reg: Optional[str] = None
    third_party_insurance: Optional[str] = None
    documents: List[DocumentInfo] = []
    fraud_score: Optional[int] = None
    risk_band: Optional[RiskBand] = None
    status: ClaimStatus = "needs_review"
    signals: List[LLMSignal] = []
    rule_triggers: List[RuleTrigger] = []
    field_edits: List[FieldEdit] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    scored_at: Optional[datetime] = None
    created_by: str = "system"
    in_review_by: Optional[str] = None
    in_review_at: Optional[datetime] = None
    decision_reason: Optional[str] = None
    decision_notes: Optional[str] = None
    decided_by: Optional[str] = None
    decided_at: Optional[datetime] = None

class ClaimCreate(BaseModel):
    claimant_name: str
    broker_id: Optional[str] = ""
    policy_id: str
    policy_start_date: Optional[str] = None
    policyholder_address: Optional[str] = None
    num_previous_claims: int = 0
    total_previous_claims_gbp: float = 0.0
    vehicle_make: str
    vehicle_model: str
    vehicle_year: int
    vehicle_registration: str
    vehicle_estimated_value_gbp: float
    accident_date: str
    accident_type: AccidentType
    accident_location: str
    claim_amount_gbp: float
    accident_description: str
    witness_name: Optional[str] = None
    witness_contact: Optional[str] = None
    third_party_name: Optional[str] = None
    third_party_contact: Optional[str] = None
    third_party_vehicle_reg: Optional[str] = None
    third_party_insurance: Optional[str] = None
    ai_extracted_fields: Optional[dict] = None

class ClaimFieldsUpdate(BaseModel):
    claimant_name: Optional[str] = None
    broker_id: Optional[str] = None
    policy_id: Optional[str] = None
    policy_start_date: Optional[str] = None
    policyholder_address: Optional[str] = None
    num_previous_claims: Optional[int] = None
    total_previous_claims_gbp: Optional[float] = None
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_year: Optional[int] = None
    vehicle_registration: Optional[str] = None
    vehicle_estimated_value_gbp: Optional[float] = None
    accident_date: Optional[str] = None
    accident_type: Optional[AccidentType] = None
    accident_location: Optional[str] = None
    claim_amount_gbp: Optional[float] = None
    accident_description: Optional[str] = None
    witness_name: Optional[str] = None
    witness_contact: Optional[str] = None
    third_party_name: Optional[str] = None
    third_party_contact: Optional[str] = None
    third_party_vehicle_reg: Optional[str] = None
    third_party_insurance: Optional[str] = None

class ClaimUpdate(BaseModel):
    claimant_name: Optional[str] = None
    status: Optional[ClaimStatus] = None

class OverrideRequest(BaseModel):
    new_score: int = Field(ge=0, le=100)
    reason_category: ReasonCategory
    notes: str = Field(min_length=1)

class RescoreRequest(BaseModel):
    notes: Optional[str] = None

class DecisionRequest(BaseModel):
    reason: str
    notes: str = Field(min_length=1)

class AuditLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    claim_id: str
    user_name: str
    action_type: ActionType
    field_changed: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    reason_category: Optional[str] = None
    notes: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ExtractedFields(BaseModel):
    claimant_name: Optional[str] = None
    policy_id: Optional[str] = None
    num_previous_claims: Optional[int] = None
    total_previous_claims_gbp: Optional[float] = None
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_year: Optional[int] = None
    vehicle_registration: Optional[str] = None
    vehicle_estimated_value_gbp: Optional[float] = None
    accident_date: Optional[str] = None
    accident_type: Optional[str] = None
    accident_location: Optional[str] = None
    claim_amount_gbp: Optional[float] = None
    accident_description: Optional[str] = None
    extraction_confidence: float = 0.0
    extraction_notes: Optional[str] = None

class StatsResponse(BaseModel):
    total_claims: int
    high_risk_claims: int
    medium_risk_claims: int
    low_risk_claims: int
    pending_review: int
    needs_review_count: Optional[int] = None
    approved_count: Optional[int] = None
    rejected_count: Optional[int] = None
    decisions_made: Optional[int] = None
    claims_this_month: Optional[int] = None
    claims_last_24h: Optional[int] = None
    average_score: Optional[float] = None
    total_value_gbp: Optional[float] = None


# ============================================================================
# MULTI-TENANT MODELS
# ============================================================================

SubscriptionStatus = Literal["active", "trial", "suspended", "cancelled"]
SubscriptionTier = Literal["free", "enterprise"]

class Organization(BaseModel):
    org_id: str
    org_name: str
    azure_tenant_id: str
    subscription_status: SubscriptionStatus = "trial"
    subscription_tier: SubscriptionTier = "free"
    claims_count: int = 0
    users_count: int = 0
    trial_started_at: Optional[str] = None
    trial_days: int = 14
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class UserDB(BaseModel):
    user_id: str
    org_id: str
    azure_ad_object_id: str
    email: Optional[str] = None
    full_name: str = ""
    role: str = "user"
    created_at: Optional[str] = None
    last_login: Optional[str] = None

class UserWithOrg(BaseModel):
    user_id: str
    email: Optional[str] = None
    full_name: str = ""
    role: str = "user"
    org_id: str
    organization: Organization
