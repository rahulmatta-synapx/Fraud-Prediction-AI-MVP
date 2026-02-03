import os
import uuid
from datetime import datetime, timedelta
from typing import Optional, Tuple
from azure.storage.blob import BlobServiceClient, generate_blob_sas, BlobSasPermissions

CONTAINER_NAME = "claims-docs"

def get_blob_service_client() -> BlobServiceClient:
    connection_string = os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
    if not connection_string:
        raise ValueError("AZURE_STORAGE_CONNECTION_STRING environment variable is required")
    return BlobServiceClient.from_connection_string(connection_string)

async def upload_document(
    file_content: bytes,
    filename: str,
    content_type: str,
    claim_id: str,
    user_name: str
) -> Tuple[str, str]:
    client = get_blob_service_client()
    container_client = client.get_container_client(CONTAINER_NAME)
    
    try:
        container_client.create_container()
    except Exception:
        pass
    
    ext = filename.split(".")[-1] if "." in filename else "bin"
    unique_filename = f"{claim_id}/{uuid.uuid4()}.{ext}"
    
    blob_client = container_client.get_blob_client(unique_filename)
    
    blob_client.upload_blob(
        file_content,
        content_type=content_type,
        overwrite=True,
        metadata={
            "original_filename": filename,
            "claim_id": claim_id,
            "uploaded_by": user_name,
            "uploaded_at": datetime.utcnow().isoformat()
        }
    )
    
    blob_url = blob_client.url
    
    return unique_filename, blob_url

def generate_sas_url(blob_path: str, expiry_hours: int = 24) -> str:
    client = get_blob_service_client()
    
    account_name = client.account_name
    account_key = None
    
    connection_string = os.environ.get("AZURE_STORAGE_CONNECTION_STRING", "")
    for part in connection_string.split(";"):
        if part.startswith("AccountKey="):
            account_key = part.split("=", 1)[1]
            break
    
    if not account_key:
        container_client = client.get_container_client(CONTAINER_NAME)
        blob_client = container_client.get_blob_client(blob_path)
        return blob_client.url
    
    sas_token = generate_blob_sas(
        account_name=account_name,
        container_name=CONTAINER_NAME,
        blob_name=blob_path,
        account_key=account_key,
        permission=BlobSasPermissions(read=True),
        expiry=datetime.utcnow() + timedelta(hours=expiry_hours)
    )
    
    return f"https://{account_name}.blob.core.windows.net/{CONTAINER_NAME}/{blob_path}?{sas_token}"

async def delete_document(blob_path: str) -> bool:
    try:
        client = get_blob_service_client()
        container_client = client.get_container_client(CONTAINER_NAME)
        blob_client = container_client.get_blob_client(blob_path)
        blob_client.delete_blob()
        return True
    except Exception as e:
        print(f"Error deleting blob: {e}")
        return False
