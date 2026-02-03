from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, status
from typing import List, Optional
from datetime import datetime
import uuid
import json

from ..models import (
    Claim, ClaimCreate, ClaimUpdate, OverrideRequest, 
    AuditLog, ExtractedFields, StatsResponse
)
from ..services.auth import get_current_user, TokenData
from ..services.rules_engine import run_rules_engine, calculate_risk_band
from ..services.llm_analyzer import analyze_claim_signals
from ..services.document_extraction import extract_fields_from_document
from ..services.blob_storage import upload_document, generate_sas_url
from ..db.cosmos import get_cosmos_db

router = APIRouter(prefix="/api", tags=["Claims"])

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
        "status": "pending",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "scored_at": None,
        "created_by": current_user.username
    }
    
    if claim_data.ai_extracted_fields:
        ai_fields = claim_data.ai_extracted_fields
        for field_name, ai_value in ai_fields.items():
            if field_name in ["extraction_confidence", "extraction_notes", "error"]:
                continue
            current_value = getattr(claim_data, field_name, None)
            if current_value is not None and ai_value is not None:
                if str(current_value) != str(ai_value):
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
        saved_claim["status"] = "scored"
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

@router.post("/claims/{claim_id}/override")
async def override_score(
    claim_id: str,
    override: OverrideRequest,
    current_user: TokenData = Depends(get_current_user)
):
    db = get_cosmos_db()
    claim = db.get_claim(claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    old_score = claim.get("fraud_score", 0)
    new_score = override.new_score
    new_risk_band = calculate_risk_band(new_score)
    
    claim["fraud_score"] = new_score
    claim["risk_band"] = new_risk_band
    claim["updated_at"] = datetime.utcnow().isoformat()
    
    db.save_claim(claim)
    
    db.save_audit_log({
        "id": str(uuid.uuid4()),
        "claim_id": claim_id,
        "user_name": current_user.full_name,
        "action_type": "OVERRIDE",
        "field_changed": "fraud_score",
        "old_value": str(old_score),
        "new_value": str(new_score),
        "reason_category": override.reason_category,
        "notes": override.notes,
        "timestamp": datetime.utcnow().isoformat()
    })
    
    audit_logs = db.get_audit_logs(claim_id)
    claim["audit_logs"] = audit_logs
    
    return claim

@router.post("/claims/{claim_id}/rescore")
async def rescore_claim(
    claim_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    db = get_cosmos_db()
    claim = db.get_claim(claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    signals = await analyze_claim_signals(claim)
    rules_result = run_rules_engine(claim, signals)
    
    old_score = claim.get("fraud_score", 0)
    
    claim["signals"] = signals
    claim["fraud_score"] = rules_result["fraud_score"]
    claim["risk_band"] = rules_result["risk_band"]
    claim["rule_triggers"] = rules_result["triggered_rules"]
    claim["scored_at"] = datetime.utcnow().isoformat()
    claim["updated_at"] = datetime.utcnow().isoformat()
    
    db.save_claim(claim)
    
    db.save_audit_log({
        "id": str(uuid.uuid4()),
        "claim_id": claim_id,
        "user_name": current_user.full_name,
        "action_type": "SCORE_GENERATED",
        "field_changed": "fraud_score",
        "old_value": str(old_score),
        "new_value": str(rules_result["fraud_score"]),
        "notes": f"Re-scored by {current_user.full_name}",
        "timestamp": datetime.utcnow().isoformat()
    })
    
    return claim

@router.patch("/claims/{claim_id}/status")
async def update_status(
    claim_id: str,
    update: ClaimUpdate,
    current_user: TokenData = Depends(get_current_user)
):
    db = get_cosmos_db()
    claim = db.get_claim(claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    if update.status:
        old_status = claim.get("status")
        claim["status"] = update.status
        claim["updated_at"] = datetime.utcnow().isoformat()
        
        db.save_claim(claim)
        
        db.save_audit_log({
            "id": str(uuid.uuid4()),
            "claim_id": claim_id,
            "user_name": current_user.full_name,
            "action_type": "STATUS_CHANGE",
            "field_changed": "status",
            "old_value": old_status,
            "new_value": update.status,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    return claim

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
