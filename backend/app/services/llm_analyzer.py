import os
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid
from openai import AzureOpenAI

def get_azure_openai_client() -> AzureOpenAI:
    endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
    api_key = os.environ.get("AZURE_OPENAI_KEY")
    
    if not endpoint or not api_key:
        raise ValueError("Azure OpenAI credentials not configured")
    
    return AzureOpenAI(
        azure_endpoint=endpoint,
        api_key=api_key,
        api_version="2024-02-15-preview"
    )

SIGNAL_DETECTION_PROMPT = '''You are a neutral claims analysis assistant for UK motor insurance.
Analyze the following claim details and identify any factual observations that may be relevant for review.

IMPORTANT GUIDELINES:
- Use ONLY neutral, non-judgmental language
- Do NOT use words like: suspicious, fraudulent, deceptive, dishonest, false, fake, or scam
- Focus on factual observations and data patterns only
- Each observation should describe what you notice, not what you suspect

Claim Details:
- Claimant: {claimant_name}
- Policy ID: {policy_id}
- Previous Claims: {num_previous_claims} (Total: £{total_previous_claims_gbp})
- Vehicle: {vehicle_year} {vehicle_make} {vehicle_model} ({vehicle_registration})
- Vehicle Value: £{vehicle_estimated_value_gbp}
- Accident Date: {accident_date}
- Accident Type: {accident_type}
- Location: {accident_location}
- Claim Amount: £{claim_amount_gbp}
- Description: {accident_description}

Provide 0-5 observations in this exact JSON format:
{{
  "signals": [
    {{
      "signal_type": "Category (e.g., Cost Analysis, Timeline Observation, Documentation Gap, Pattern Note)",
      "description": "Neutral factual observation",
      "confidence": 0.0-1.0
    }}
  ],
  "summary": "Brief neutral summary of observations"
}}

Return ONLY valid JSON, no other text.'''

async def analyze_claim_signals(claim: Dict[str, Any]) -> List[Dict[str, Any]]:
    try:
        client = get_azure_openai_client()
        
        prompt = SIGNAL_DETECTION_PROMPT.format(
            claimant_name=claim.get("claimant_name", "Unknown"),
            policy_id=claim.get("policy_id", "Unknown"),
            num_previous_claims=claim.get("num_previous_claims", 0),
            total_previous_claims_gbp=claim.get("total_previous_claims_gbp", 0),
            vehicle_year=claim.get("vehicle_year", "Unknown"),
            vehicle_make=claim.get("vehicle_make", "Unknown"),
            vehicle_model=claim.get("vehicle_model", "Unknown"),
            vehicle_registration=claim.get("vehicle_registration", "Unknown"),
            vehicle_estimated_value_gbp=claim.get("vehicle_estimated_value_gbp", 0),
            accident_date=claim.get("accident_date", "Unknown"),
            accident_type=claim.get("accident_type", "Unknown"),
            accident_location=claim.get("accident_location", "Unknown"),
            claim_amount_gbp=claim.get("claim_amount_gbp", 0),
            accident_description=claim.get("accident_description", "No description provided")
        )
        
        response = client.chat.completions.create(
            model="gpt-4.1",
            messages=[
                {"role": "system", "content": "You are a neutral claims analysis assistant. Respond only with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=1000
        )
        
        content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        
        result = json.loads(content)
        signals = result.get("signals", [])
        
        formatted_signals = []
        for signal in signals:
            formatted_signals.append({
                "id": str(uuid.uuid4()),
                "signal_type": signal.get("signal_type", "General Observation"),
                "description": signal.get("description", ""),
                "confidence": float(signal.get("confidence", 0.5)),
                "detected_at": datetime.utcnow().isoformat()
            })
        
        return formatted_signals
        
    except Exception as e:
        print(f"Error analyzing claim: {e}")
        return []
