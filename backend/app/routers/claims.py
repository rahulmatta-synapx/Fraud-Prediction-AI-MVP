from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, status
from typing import List, Optional
from datetime import datetime
import uuid
import json

from ..models import (
    Claim, ClaimCreate, ClaimUpdate, ClaimFieldsUpdate, OverrideRequest, 
    DecisionRequest, RescoreRequest, AuditLog, ExtractedFields, StatsResponse
)
from ..services.auth import get_current_user, TokenData
from ..services.rules_engine import run_rules_engine, calculate_risk_band
from ..services.llm_analyzer import analyze_claim_signals
from ..services.document_extraction import extract_fields_from_document
from ..services.blob_storage import upload_document, generate_sas_url
from ..services.justification import generate_justification, _generate_fallback_justification
from ..db.cosmos import get_cosmos_db

router = APIRouter(prefix="/api", tags=["Claims"])

def normalize_value(value):
    """Normalize a value for comparison - handles numeric type differences."""
    if value is None:
        return None
    
    str_val = str(value).strip()
    
    try:
        float_val = float(str_val)
        if float_val == int(float_val):
            return int(float_val)
        return float_val
    except (ValueError, TypeError):
        return str_val

def values_are_equal(val1, val2) -> bool:
    """Compare two values after normalization to avoid false positives from type differences."""
    norm1 = normalize_value(val1)
    norm2 = normalize_value(val2)
    return norm1 == norm2

def generate_claim_id() -> str:
    return f"CLM-{datetime.utcnow().strftime('%Y')}-{uuid.uuid4().hex[:8].upper()}"

@router.get("/claims", response_model=List[dict])
async def list_claims(
    current_user: TokenData = Depends(get_current_user),
    last_24h: bool = False
):
    db = get_cosmos_db()
    if last_24h:
        claims = db.list_claims_last_24h()
    else:
        claims = db.list_claims()
    return claims

@router.get("/claims/{claim_id}")
async def get_claim(
    claim_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    db = get_cosmos_db()
    claim = db.get_claim(claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    audit_logs = db.get_audit_logs(claim_id)
    claim["audit_logs"] = audit_logs
    
    for doc in claim.get("documents", []):
        if doc.get("blob_path"):
            doc["blob_url"] = generate_sas_url(doc["blob_path"])
    
    if claim.get("fraud_score") is not None and not claim.get("justification"):
        try:
            justification = await generate_justification(claim)
            claim["justification"] = justification
        except Exception:
            claim["justification"] = _generate_fallback_justification(claim)
    
    return claim

@router.post("/claims")
async def create_claim(
    claim_data: ClaimCreate,
    current_user: TokenData = Depends(get_current_user)
):
    db = get_cosmos_db()
    
    claim_id = generate_claim_id()
    
    claim = {
        "id": str(uuid.uuid4()),
        "claim_id": claim_id,
        "claimant_name": claim_data.claimant_name,
        "policy_id": claim_data.policy_id,
        "num_previous_claims": claim_data.num_previous_claims,
        "total_previous_claims_gbp": claim_data.total_previous_claims_gbp,
        "vehicle_make": claim_data.vehicle_make,
        "vehicle_model": claim_data.vehicle_model,
        "vehicle_year": claim_data.vehicle_year,
        "vehicle_registration": claim_data.vehicle_registration,
        "vehicle_estimated_value_gbp": claim_data.vehicle_estimated_value_gbp,
        "accident_date": claim_data.accident_date,
        "accident_type": claim_data.accident_type,
        "accident_location": claim_data.accident_location,
        "claim_amount_gbp": claim_data.claim_amount_gbp,
        "accident_description": claim_data.accident_description,
        "documents": [],
        "signals": [],
        "rule_triggers": [],
        "field_edits": [],
        "fraud_score": None,
        "risk_band": None,
        "status": "needs_review",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "scored_at": None,
        "created_by": current_user.username,
        "decision_reason": None,
        "decision_notes": None,
        "decided_by": None,
        "decided_at": None
    }
    
    if claim_data.ai_extracted_fields:
        ai_fields = claim_data.ai_extracted_fields
        for field_name, ai_value in ai_fields.items():
            if field_name in ["extraction_confidence", "extraction_notes", "error"]:
                continue
            current_value = getattr(claim_data, field_name, None)
            if current_value is not None and ai_value is not None:
                if not values_are_equal(current_value, ai_value):
                    claim["field_edits"].append({
                        "field_name": field_name,
                        "original_value": str(ai_value),
                        "edited_value": str(current_value),
                        "edited_by": current_user.full_name,
                        "edited_at": datetime.utcnow().isoformat(),
                        "reason": "User edited AI-extracted value"
                    })
                    db.save_audit_log({
                        "id": str(uuid.uuid4()),
                        "claim_id": claim_id,
                        "user_name": current_user.full_name,
                        "action_type": "FIELD_EDIT",
                        "field_changed": field_name,
                        "old_value": str(ai_value),
                        "new_value": str(current_value),
                        "timestamp": datetime.utcnow().isoformat()
                    })
    
    saved_claim = db.save_claim(claim)
    
    db.save_audit_log({
        "id": str(uuid.uuid4()),
        "claim_id": claim_id,
        "user_name": current_user.full_name,
        "action_type": "CLAIM_CREATED",
        "new_value": claim_id,
        "notes": f"Claim created by {current_user.full_name}",
        "timestamp": datetime.utcnow().isoformat()
    })
    
    try:
        signals = await analyze_claim_signals(claim)
        saved_claim["signals"] = signals
        
        rules_result = run_rules_engine(claim, signals)
        saved_claim["fraud_score"] = rules_result["fraud_score"]
        saved_claim["risk_band"] = rules_result["risk_band"]
        saved_claim["rule_triggers"] = rules_result["triggered_rules"]
        saved_claim["scored_at"] = datetime.utcnow().isoformat()
        
        db.save_claim(saved_claim)
        
        db.save_audit_log({
            "id": str(uuid.uuid4()),
            "claim_id": claim_id,
            "user_name": "system",
            "action_type": "SCORE_GENERATED",
            "new_value": str(rules_result["fraud_score"]),
            "notes": f"AI scored claim as {rules_result['risk_band']} risk ({rules_result['fraud_score']}/100)",
            "timestamp": datetime.utcnow().isoformat()
        })
    except Exception as e:
        print(f"Error scoring claim: {e}")
    
    return saved_claim

@router.patch("/claims/{claim_id}/fields")
async def update_claim_fields(
    claim_id: str,
    update: ClaimFieldsUpdate,
    current_user: TokenData = Depends(get_current_user)
):
    """Update claim fields - DISABLED: Claims are read-only after submission."""
    raise HTTPException(
        status_code=403, 
        detail="Claims are read-only after submission and cannot be edited"
    )

@router.post("/claims/{claim_id}/rescore")
async def rescore_claim(
    claim_id: str,
    request: Optional[RescoreRequest] = None,
    current_user: TokenData = Depends(get_current_user)
):
    """Rescore claim - DISABLED: Claims are read-only after submission."""
    raise HTTPException(
        status_code=403, 
        detail="Claims are read-only after submission and cannot be rescored"
    )

@router.post("/claims/{claim_id}/approve")
async def approve_claim(
    claim_id: str,
    request: DecisionRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """Approve the claim with mandatory reason and notes."""
    db = get_cosmos_db()
    claim = db.get_claim(claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    if claim.get("status") in ["approved", "rejected"]:
        raise HTTPException(
            status_code=400, 
            detail="Claim has already been decided"
        )
    
    old_status = claim.get("status")
    
    claim["status"] = "approved"
    claim["decision_reason"] = request.reason
    claim["decision_notes"] = request.notes
    claim["decided_by"] = current_user.full_name
    claim["decided_at"] = datetime.utcnow().isoformat()
    claim["updated_at"] = datetime.utcnow().isoformat()
    
    db.save_claim(claim)
    
    db.save_audit_log({
        "id": str(uuid.uuid4()),
        "claim_id": claim_id,
        "user_name": current_user.full_name,
        "action_type": "APPROVE",
        "field_changed": "status",
        "old_value": old_status,
        "new_value": "approved",
        "reason_category": request.reason,
        "notes": request.notes,
        "timestamp": datetime.utcnow().isoformat()
    })
    
    audit_logs = db.get_audit_logs(claim_id)
    claim["audit_logs"] = audit_logs
    
    return claim

@router.post("/claims/{claim_id}/mark-in-review")
async def mark_in_review(
    claim_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Mark a claim as 'in_review' - any user can do this."""
    db = get_cosmos_db()
    claim = db.get_claim(claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    if claim.get("status") != "needs_review":
        raise HTTPException(
            status_code=400, 
            detail="Only claims with 'needs_review' status can be marked as in review"
        )
    
    old_status = claim.get("status")
    
    claim["status"] = "in_review"
    claim["in_review_by"] = current_user.full_name
    claim["in_review_at"] = datetime.utcnow().isoformat()
    claim["updated_at"] = datetime.utcnow().isoformat()
    
    db.save_claim(claim)
    
    db.save_audit_log({
        "id": str(uuid.uuid4()),
        "claim_id": claim_id,
        "user_name": current_user.full_name,
        "action_type": "STATUS_CHANGE",
        "field_changed": "status",
        "old_value": old_status,
        "new_value": "in_review",
        "reason_category": None,
        "notes": f"Claim marked as in review by {current_user.full_name}",
        "timestamp": datetime.utcnow().isoformat()
    })
    
    audit_logs = db.get_audit_logs(claim_id)
    claim["audit_logs"] = audit_logs
    
    return claim

@router.post("/claims/{claim_id}/reject")
async def reject_claim(
    claim_id: str,
    request: DecisionRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """Reject the claim with mandatory reason and notes."""
    db = get_cosmos_db()
    claim = db.get_claim(claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    if claim.get("status") in ["approved", "rejected"]:
        raise HTTPException(
            status_code=400, 
            detail="Claim has already been decided"
        )
    
    old_status = claim.get("status")
    
    claim["status"] = "rejected"
    claim["decision_reason"] = request.reason
    claim["decision_notes"] = request.notes
    claim["decided_by"] = current_user.full_name
    claim["decided_at"] = datetime.utcnow().isoformat()
    claim["updated_at"] = datetime.utcnow().isoformat()
    
    db.save_claim(claim)
    
    db.save_audit_log({
        "id": str(uuid.uuid4()),
        "claim_id": claim_id,
        "user_name": current_user.full_name,
        "action_type": "REJECT",
        "field_changed": "status",
        "old_value": old_status,
        "new_value": "rejected",
        "reason_category": request.reason,
        "notes": request.notes,
        "timestamp": datetime.utcnow().isoformat()
    })
    
    audit_logs = db.get_audit_logs(claim_id)
    claim["audit_logs"] = audit_logs
    
    return claim

@router.post("/claims/{claim_id}/override")
async def override_score(
    claim_id: str,
    override: OverrideRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """Override score - DISABLED: Claims are read-only after submission."""
    raise HTTPException(
        status_code=403, 
        detail="Claims are read-only after submission and cannot be overridden"
    )

@router.patch("/claims/{claim_id}/status")
async def update_status(
    claim_id: str,
    update: ClaimUpdate,
    current_user: TokenData = Depends(get_current_user)
):
    """Update status - DISABLED: Claims are read-only after submission."""
    raise HTTPException(
        status_code=403, 
        detail="Claims are read-only after submission and cannot be modified"
    )

@router.post("/extract-fields")
async def extract_fields(
    file: UploadFile = File(...),
    current_user: TokenData = Depends(get_current_user)
):
    content = await file.read()
    
    extracted = await extract_fields_from_document(
        file_content=content,
        content_type=file.content_type or "application/octet-stream",
        filename=file.filename or "document"
    )
    
    return extracted

@router.post("/claims/{claim_id}/upload")
async def upload_claim_document(
    claim_id: str,
    file: UploadFile = File(...),
    current_user: TokenData = Depends(get_current_user)
):
    db = get_cosmos_db()
    claim = db.get_claim(claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    content = await file.read()
    
    blob_path, blob_url = await upload_document(
        file_content=content,
        filename=file.filename or "document",
        content_type=file.content_type or "application/octet-stream",
        claim_id=claim_id,
        user_name=current_user.username
    )
    
    doc_info = {
        "blob_path": blob_path,
        "blob_url": blob_url,
        "filename": file.filename or "document",
        "content_type": file.content_type or "application/octet-stream",
        "uploaded_at": datetime.utcnow().isoformat(),
        "uploaded_by": current_user.username
    }
    
    if "documents" not in claim:
        claim["documents"] = []
    claim["documents"].append(doc_info)
    claim["updated_at"] = datetime.utcnow().isoformat()
    
    db.save_claim(claim)
    
    db.save_audit_log({
        "id": str(uuid.uuid4()),
        "claim_id": claim_id,
        "user_name": current_user.full_name,
        "action_type": "DOCUMENT_UPLOADED",
        "new_value": file.filename,
        "notes": f"Document uploaded by {current_user.full_name}",
        "timestamp": datetime.utcnow().isoformat()
    })
    
    return {"success": True, "document": doc_info}

@router.get("/stats", response_model=StatsResponse)
async def get_stats(
    current_user: TokenData = Depends(get_current_user)
):
    db = get_cosmos_db()
    stats = db.get_stats()
    return StatsResponse(**stats)

@router.get("/claims/{claim_id}/audit-logs")
async def get_claim_audit_logs(
    claim_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    db = get_cosmos_db()
    logs = db.get_audit_logs(claim_id)
    return logs
