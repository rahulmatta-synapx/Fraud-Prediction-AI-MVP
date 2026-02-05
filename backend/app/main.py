import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables if present
load_dotenv()

from .routers import auth, claims

app = FastAPI(
    title="FraudGuard AI API",
    description="UK Motor Insurance Fraud Prediction Agent - Azure Native",
    version="2.0.0"
)

# Explicitly allow your frontend URL to make requests to this API
# Using ["*"] is okay for development, but listing the URL is safer for production
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://thankful-forest-080eaad03.6.azurestaticapps.net",
        "http://localhost:5000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers for different modules
app.include_router(auth.router)
app.include_router(claims.router)

@app.get("/")
async def root():
    return {
        "name": "FraudGuard AI API",
        "version": "2.0.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    # Use the port assigned by Azure (usually 80 or 8080 internally) or default to 8000
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)