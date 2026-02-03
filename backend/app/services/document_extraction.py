import os
import json
import base64
from typing import Dict, Any, Optional
from openai import AzureOpenAI

def get_azure_openai_client() -> AzureOpenAI:
    endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
    api_key = os.environ.get("AZURE_OPENAI_KEY")
    
    if not endpoint or not api_key:
        raise ValueError("Azure OpenAI credentials not configured. Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_KEY.")
    
    endpoint = endpoint.strip().strip('"').strip("'")
    api_key = api_key.strip().strip('"').strip("'")
    
    return AzureOpenAI(
        azure_endpoint=endpoint,
        api_key=api_key,
        api_version="2024-02-15-preview"
    )

def get_deployment_name() -> str:
    """Get the Azure OpenAI deployment name from env or use default."""
    return os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4.1").strip().strip('"').strip("'")

EXTRACTION_PROMPT = '''You are a document analysis assistant for UK motor insurance claims.
Extract the following fields from the uploaded document image. Be accurate and extract only what you can clearly see.

Required fields to extract:
- claimant_name: Full name of the claimant/policyholder
- policy_id: Policy number/ID
- num_previous_claims: Number of previous claims (integer, default 0 if not visible)
- total_previous_claims_gbp: Total amount of previous claims in GBP (float, default 0.0 if not visible)
- vehicle_make: Vehicle manufacturer (e.g., BMW, Ford, Toyota)
- vehicle_model: Vehicle model (e.g., 3 Series, Focus, Corolla)
- vehicle_year: Year of manufacture (integer)
- vehicle_registration: UK vehicle registration number
- vehicle_estimated_value_gbp: Estimated vehicle value in GBP (float)
- accident_date: Date of accident (YYYY-MM-DD format)
- accident_type: One of: Collision, Rear-End, Side Impact, Rollover, Hit and Run, Parking Damage, Theft, Vandalism, Fire, Flood Damage
- accident_location: Location where accident occurred
- claim_amount_gbp: Claimed amount in GBP (float)
- accident_description: Description of the accident/incident

Return ONLY valid JSON in this exact format:
{
  "claimant_name": "string or null",
  "policy_id": "string or null",
  "num_previous_claims": 0,
  "total_previous_claims_gbp": 0.0,
  "vehicle_make": "string or null",
  "vehicle_model": "string or null",
  "vehicle_year": 2024,
  "vehicle_registration": "string or null",
  "vehicle_estimated_value_gbp": 0.0,
  "accident_date": "YYYY-MM-DD or null",
  "accident_type": "type or null",
  "accident_location": "string or null",
  "claim_amount_gbp": 0.0,
  "accident_description": "string or null",
  "extraction_confidence": 0.0-1.0,
  "extraction_notes": "Any notes about what could/couldn't be extracted"
}

Return ONLY the JSON, no other text.'''

async def extract_fields_from_document(
    file_content: bytes,
    content_type: str,
    filename: str
) -> Dict[str, Any]:
    import asyncio
    
    try:
        client = get_azure_openai_client()
        deployment_name = get_deployment_name()
        
        base64_content = base64.b64encode(file_content).decode("utf-8")
        
        if content_type.startswith("image/"):
            media_type = content_type
        elif content_type == "application/pdf":
            media_type = "application/pdf"
        else:
            media_type = "image/png"
        
        messages = [
            {
                "role": "system",
                "content": "You are a document analysis assistant. Extract structured data from documents. Respond only with valid JSON."
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": EXTRACTION_PROMPT
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{media_type};base64,{base64_content}"
                        }
                    }
                ]
            }
        ]
        
        max_retries = 3
        retry_delay = 2
        last_error = None
        
        for attempt in range(max_retries):
            try:
                response = client.chat.completions.create(
                    model=deployment_name,
                    messages=messages,
                    temperature=0.1,
                    max_tokens=1500
                )
                break
            except Exception as e:
                error_str = str(e)
                last_error = e
                if "DeploymentNotFound" in error_str or "404" in error_str:
                    if attempt < max_retries - 1:
                        print(f"Deployment not found, retrying in {retry_delay}s (attempt {attempt + 1}/{max_retries})")
                        await asyncio.sleep(retry_delay)
                        retry_delay *= 2
                        continue
                    else:
                        return {
                            "error": f"OpenAI deployment '{deployment_name}' not found after {max_retries} retries. Check Azure portal and set AZURE_OPENAI_DEPLOYMENT_NAME.",
                            "extraction_confidence": 0.0
                        }
                else:
                    raise e
        
        if last_error and 'response' not in dir():
            return {"error": str(last_error), "extraction_confidence": 0.0}
        
        content = response.choices[0].message.content.strip()
        
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        content = content.strip()
        
        extracted = json.loads(content)
        
        return {
            "claimant_name": extracted.get("claimant_name"),
            "policy_id": extracted.get("policy_id"),
            "num_previous_claims": int(extracted.get("num_previous_claims", 0) or 0),
            "total_previous_claims_gbp": float(extracted.get("total_previous_claims_gbp", 0) or 0),
            "vehicle_make": extracted.get("vehicle_make"),
            "vehicle_model": extracted.get("vehicle_model"),
            "vehicle_year": int(extracted.get("vehicle_year", 2024) or 2024),
            "vehicle_registration": extracted.get("vehicle_registration"),
            "vehicle_estimated_value_gbp": float(extracted.get("vehicle_estimated_value_gbp", 0) or 0),
            "accident_date": extracted.get("accident_date"),
            "accident_type": extracted.get("accident_type"),
            "accident_location": extracted.get("accident_location"),
            "claim_amount_gbp": float(extracted.get("claim_amount_gbp", 0) or 0),
            "accident_description": extracted.get("accident_description"),
            "extraction_confidence": float(extracted.get("extraction_confidence", 0.5) or 0.5),
            "extraction_notes": extracted.get("extraction_notes", "")
        }
        
    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}")
        return {"error": "Failed to parse extraction results", "extraction_confidence": 0.0}
    except Exception as e:
        error_str = str(e)
        print(f"Document extraction error: {error_str}")
        
        if "DeploymentNotFound" in error_str or "404" in error_str:
            return {
                "error": f"OpenAI deployment not found. Check Azure portal and set AZURE_OPENAI_DEPLOYMENT_NAME (current: {get_deployment_name()})",
                "extraction_confidence": 0.0
            }
        
        return {"error": error_str, "extraction_confidence": 0.0}
