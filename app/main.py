import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.config import GEMINI_API_KEY
from app.schemas import (
    AnalyzeRequest, 
    CareerBlueprintResponse, 
    SuggestProfessionsRequest, 
    SuggestProfessionsResponse
)
from app.services.gemini_service import generate_career_blueprint, suggest_eligible_professions
from app.services.validation import validate_career_request, is_gibberish_or_fake
from app.database import (
    init_db,
    save_blueprint_to_db,
    get_blueprint_from_db,
    save_suggestions_to_db,
    get_suggestions_from_db,
    get_database_stats
)

app = FastAPI(
    title="Future Era",
    description="The GenX Era - Future-proof career intelligence & market tech engine powered by FastAPI & Gemini",
    version="1.0.0"
)

# Enable CORS for flexible local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

# Mount static folder
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Initialize database
init_db()


NO_CACHE_HEADERS = {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0"
}


@app.get("/")
async def serve_index():
    """Serves the Future Era landing page."""
    return FileResponse(os.path.join(STATIC_DIR, "index.html"), headers=NO_CACHE_HEADERS)


@app.get("/console")
async def serve_console():
    """Serves the Career Architecture Console page."""
    return FileResponse(os.path.join(STATIC_DIR, "console.html"), headers=NO_CACHE_HEADERS)


@app.get("/stage")
@app.get("/select-stage")
async def serve_stage():
    """Serves the Stage Selection middle page."""
    return FileResponse(os.path.join(STATIC_DIR, "stage.html"), headers=NO_CACHE_HEADERS)


@app.get("/privacy")
async def serve_privacy():
    """Serves the privacy policy page."""
    return FileResponse(os.path.join(STATIC_DIR, "privacy.html"))


@app.get("/terms")
async def serve_terms():
    """Serves the terms and conditions page."""
    return FileResponse(os.path.join(STATIC_DIR, "terms.html"))


@app.get("/favicon.ico")
async def serve_favicon():
    """Serves the SVG favicon."""
    return FileResponse(os.path.join(STATIC_DIR, "favicon.svg"), media_type="image/svg+xml")


@app.get("/api/status")
async def check_status():
    """Checks whether an API key is configured on the server."""
    return {
        "has_server_api_key": bool(GEMINI_API_KEY),
        "status": "ready" if GEMINI_API_KEY else "needs_api_key"
    }


@app.get("/api/db/stats")
async def db_stats():
    """Returns database telemetry and count of cached blueprints & suggestions."""
    return get_database_stats()


@app.post("/api/analyze", response_model=CareerBlueprintResponse)
async def analyze_career(request: AnalyzeRequest):
    """
    Main endpoint: Generates future-proof roadmap, AI analysis, 
    and 2026 tech radar for either 12th-pass or final-year students.
    Every generated detail is persisted to the SQLite database.
    If the AI API is offline or unavailable, data is fetched from the database cache.
    """
    data = request.model_dump()
    
    # 1. Heuristic and sanity check for fake/empty/gibberish details
    is_valid, validation_msg = validate_career_request(data)
    if not is_valid:
        raise HTTPException(status_code=400, detail=validation_msg)

    # 2. Attempt AI Generation
    try:
        result = await generate_career_blueprint(data, client_api_key=request.api_key)
        
        # Check if AI detected fake or non-existent details
        if not result.get("is_valid", True):
            err_msg = result.get("error_message") or "Blueprint doesn't exist. Please check the entered data and provide legitimate educational degrees, skills, or career roles."
            raise HTTPException(status_code=400, detail=err_msg)

        # Save to database for permanent offline caching
        result["data_source"] = "ai"
        save_blueprint_to_db(data, result)
        return result

    except HTTPException:
        raise
    except Exception as ai_err:
        # 3. If Gemini API is offline/unavailable/failing -> Fetch from Database Vault!
        print(f"[Database Fallback] Gemini API unavailable: {ai_err}. Querying SQLite database...")
        cached_blueprint = get_blueprint_from_db(data)
        if cached_blueprint and cached_blueprint.get("is_valid", True):
            cached_blueprint["data_source"] = "database_cache"
            return cached_blueprint
            
        raise HTTPException(
            status_code=500, 
            detail=f"AI API is currently unavailable and no matching blueprint is cached in the database. Please try again shortly. (Error: {str(ai_err)})"
        )


@app.post("/api/suggest-professions", response_model=SuggestProfessionsResponse)
async def suggest_professions_endpoint(request: SuggestProfessionsRequest):
    """
    Analyzes 12th stream and favorite subjects/interests to provide
    multiple eligible career professions so the student can pick one.
    Every generated response is saved to the SQLite database.
    If the AI API is offline, suggestions are fetched from the database.
    """
    data = request.model_dump()
    interests = (data.get("interests") or "").strip()
    
    # 1. Validation for fake/gibberish details
    if not interests:
        raise HTTPException(
            status_code=400, 
            detail="Please choose an interest from the suggested topics above or describe your favorite subjects."
        )
    if is_gibberish_or_fake(interests):
        raise HTTPException(
            status_code=400, 
            detail=f"'{interests}' does not look like valid subjects or interests. Please choose from the suggested topics above or enter your genuine interests."
        )
        
    # 2. Attempt AI Generation
    try:
        result = await suggest_eligible_professions(data, client_api_key=request.api_key)
        
        if not result.get("is_valid", True):
            err_msg = result.get("error_message") or "Blueprint doesn't exist for the entered details. Please check the entered data."
            raise HTTPException(status_code=400, detail=err_msg)

        # Save to database for permanent offline caching
        result["data_source"] = "ai"
        save_suggestions_to_db(data, result)
        return result

    except HTTPException:
        raise
    except Exception as ai_err:
        # 3. If Gemini API is offline -> Fetch from Database Vault!
        print(f"[Database Fallback] Gemini API unavailable: {ai_err}. Querying SQLite database for suggestions...")
        cached_suggestions = get_suggestions_from_db(data)
        if cached_suggestions and cached_suggestions.get("is_valid", True):
            cached_suggestions["data_source"] = "database_cache"
            return cached_suggestions

        raise HTTPException(
            status_code=500, 
            detail=f"AI API is currently unavailable and no suggestions found in the database. (Error: {str(ai_err)})"
        )


