"""
AI Justification Service for generating structured risk explanations using Azure OpenAI GPT-4.1
"""
import os
import json
from typing import Dict, Any, Optional

JUSTIFICATION_SYSTEM_PROMPT = """
You are a claims review summarization assistant for a UK motor insurer.
Your role is to explain, in neutral and professional language, WHY this claim has been assigned its current risk classification, based on:
- Factual claim data
- AI-generated observations
- Deterministic rules triggered by the system

IMPORTANT CONSTRAINTS:
- You do NOT determine fraud.
- You do NOT recommend denial or approval.
- You do NOT speculate beyond provided data.
- You must clearly separate facts, observations, and system logic.
- Use insurer-appropriate language suitable for audit, regulator review, or court disclosure.

INPUTS:
1. Claim summary (JSON of fields)
2. AI signals
3. Triggered rules with weights
4. Final fraud score and risk band

YOUR TASK:
Produce structured JSON explaining:
- What factual elements stood out
- Which system rules were triggered and why
- How these factors contributed to the assigned risk band
- What aspects may warrant closer human review (if any)

OUTPUT FORMAT (STRICT JSON):
{
  "risk_overview": {
    "risk_band": "low | medium | high",
    "fraud_score": number,
    "system_interpretation": "Neutral explanation of what this score represents"
  },
  "key_factors": [
    {
      "type": "Rule | AI Observation | Claim Data",
      "name": "Short label",
      "explanation": "Plain-English explanation grounded in evidence"
    }
  ],
  "analyst_guidance": {
    "review_focus": ["Specific aspects an analyst may want to verify"],
    "missing_or_uncertain_information": ["Any gaps or ambiguities in the available data"]
  },
  "confidence_note": "Brief note on system confidence and limitations"
}

Tone: Neutral, Professional, Non-accusatory, Suitable for internal audit review
Return ONLY valid JSON.
"""

async def generate_justification(claim: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Generate a structured justification for the claim's risk assessment using Azure OpenAI.
    """
    try:
        from openai import AzureOpenAI
        
        endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
        api_key = os.environ.get("AZURE_OPENAI_KEY")
        
        if not endpoint or not api_key:
            return _generate_fallback_justification(claim)
        
        client = AzureOpenAI(
            azure_endpoint=endpoint,
            api_key=api_key,
            api_version="2024-02-15-preview"
        )
        
        claim_summary = {
            "claim_id": claim.get("claim_id"),
            "claimant_name": claim.get("claimant_name"),
            "policy_id": claim.get("policy_id"),
            "claim_amount_gbp": claim.get("claim_amount_gbp"),
            "accident_date": claim.get("accident_date"),
            "accident_type": claim.get("accident_type"),
            "accident_location": claim.get("accident_location"),
            "vehicle_registration": claim.get("vehicle_registration"),
            "vehicle_make": claim.get("vehicle_make"),
            "vehicle_model": claim.get("vehicle_model"),
            "vehicle_year": claim.get("vehicle_year"),
            "vehicle_estimated_value_gbp": claim.get("vehicle_estimated_value_gbp"),
            "num_previous_claims": claim.get("num_previous_claims"),
            "accident_description": claim.get("accident_description"),
        }
        
        signals = claim.get("signals", [])
        rule_triggers = claim.get("rule_triggers", [])
        fraud_score = claim.get("fraud_score", 0)
        risk_band = claim.get("risk_band", "low")
        
        user_message = f"""
Please analyze this claim and provide a structured justification for its risk classification.

CLAIM SUMMARY:
{json.dumps(claim_summary, indent=2)}

AI SIGNALS DETECTED:
{json.dumps(signals, indent=2) if signals else "No AI signals detected"}

TRIGGERED RULES:
{json.dumps(rule_triggers, indent=2) if rule_triggers else "No rules triggered"}

FINAL ASSESSMENT:
- Fraud Score: {fraud_score}
- Risk Band: {risk_band}
"""
        
        response = client.chat.completions.create(
            model="gpt-4.1",
            messages=[
                {"role": "system", "content": JUSTIFICATION_SYSTEM_PROMPT},
                {"role": "user", "content": user_message}
            ],
            temperature=0.3,
            max_tokens=1500,
            response_format={"type": "json_object"}
        )
        
        content = response.choices[0].message.content
        justification = json.loads(content)
        
        return justification
        
    except Exception as e:
        print(f"Error generating justification: {e}")
        return _generate_fallback_justification(claim)


def _generate_fallback_justification(claim: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate a fallback justification when Azure OpenAI is not available.
    Uses deterministic logic based on triggered rules and claim data.
    """
    fraud_score = claim.get("fraud_score", 0)
    risk_band = claim.get("risk_band", "low")
    rule_triggers = claim.get("rule_triggers", [])
    signals = claim.get("signals", [])
    
    if risk_band == "high":
        system_interpretation = "This claim has been classified as high risk based on multiple indicators that warrant careful review by a fraud analyst."
    elif risk_band == "medium":
        system_interpretation = "This claim shows some indicators that may require additional verification before proceeding."
    else:
        system_interpretation = "This claim shows no significant risk indicators based on the automated analysis."
    
    key_factors = []
    
    for rule in rule_triggers:
        key_factors.append({
            "type": "Rule",
            "name": rule.get("rule_name", "Unknown Rule"),
            "explanation": rule.get("description", f"Rule triggered with weight +{rule.get('weight', 0)}")
        })
    
    for signal in signals:
        key_factors.append({
            "type": "AI Observation",
            "name": signal.get("signal_type", "Observation"),
            "explanation": signal.get("description", "AI-detected pattern in claim data")
        })
    
    if not key_factors:
        key_factors.append({
            "type": "Claim Data",
            "name": "Standard Processing",
            "explanation": "No significant risk indicators were detected in the claim data."
        })
    
    review_focus = []
    missing_info = []
    
    if fraud_score > 60:
        review_focus.append("Verify all supporting documentation")
        review_focus.append("Cross-reference claimant history")
    elif fraud_score > 30:
        review_focus.append("Review incident details for consistency")
    
    if not claim.get("accident_location") or claim.get("accident_location") == "":
        missing_info.append("Accident location is missing or incomplete")
    
    if not claim.get("documents") or len(claim.get("documents", [])) == 0:
        missing_info.append("No supporting documents have been uploaded")
    
    return {
        "risk_overview": {
            "risk_band": risk_band,
            "fraud_score": fraud_score,
            "system_interpretation": system_interpretation
        },
        "key_factors": key_factors,
        "analyst_guidance": {
            "review_focus": review_focus if review_focus else ["Standard review procedures apply"],
            "missing_or_uncertain_information": missing_info if missing_info else ["All required information is present"]
        },
        "confidence_note": "This assessment is generated using deterministic rules and pattern analysis. Final decisions should be made by qualified fraud analysts."
    }
