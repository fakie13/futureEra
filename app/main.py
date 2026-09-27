import os
import time
import uuid
import re
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Header, Query, Request, Response, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.config import GEMINI_API_KEY
from app.schemas import (
    AnalyzeRequest, 
    CareerBlueprintResponse, 
    SuggestProfessionsRequest, 
    SuggestProfessionsResponse,
    UserSignUpRequest,
    UserLoginRequest,
    UserResponse,
    PeerProfile,
    CreateSquadRequest,
    JoinSquadRequest,
    SquadDetailResponse,
    SquadMessageRequest,
    SquadMessageItem,
    AddFriendRequest
)
from app.services.gemini_service import generate_career_blueprint, suggest_eligible_professions
from app.services.validation import validate_career_request, is_gibberish_or_fake
from app.database import (
    init_db,
    save_blueprint_to_db,
    get_blueprint_from_db,
    save_suggestions_to_db,
    get_suggestions_from_db,
    get_database_stats,
    create_user,
    authenticate_user,
    create_session,
    get_user_by_session,
    delete_session,
    get_user_by_id,
    get_user_by_username,
    get_matched_peers,
    create_squad,
    join_squad_by_code,
    get_squad_details,
    get_user_squad,
    get_all_squads,
    send_squad_message,
    get_squad_messages,
    update_squad_sprint_goal,
    leave_squad,
    save_squad_progress_upload,
    get_squad_progress_uploads,
    add_friend,
    remove_friend,
    get_user_friends,
    is_friend
)

app = FastAPI(
    title="Future Era",
    description="The GenX Era - Future-proof career intelligence, peer matchmaking & 4-member squad engine",
    version="1.1.0"
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
@app.get("/explore-stage")
@app.get("/explore-stages")
async def serve_stage():
    """Serves the Stage Selection middle page."""
    return FileResponse(os.path.join(STATIC_DIR, "stage.html"), headers=NO_CACHE_HEADERS)


@app.get("/community")
async def serve_community():
    """Serves the Peer Community, Matchmaking & 4-Member Squad Hub."""
    return FileResponse(os.path.join(STATIC_DIR, "community.html"), headers=NO_CACHE_HEADERS)


@app.get("/signin")
@app.get("/signup")
@app.get("/login")
async def serve_auth_page():
    """Serves the unified Sign In and Sign Up page."""
    return FileResponse(os.path.join(STATIC_DIR, "signin.html"), headers=NO_CACHE_HEADERS)



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


# ==========================================
# AUTH & COMMUNITY HELPERS
# ==========================================

def extract_auth_user(authorization: Optional[str] = Header(None), x_session_token: Optional[str] = Header(None)) -> Optional[Dict[str, Any]]:
    """Extracts authenticated user from Bearer header or X-Session-Token."""
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()
    elif x_session_token:
        token = x_session_token.strip()
    if token:
        return get_user_by_session(token)
    return None


def require_auth_user(authorization: Optional[str] = Header(None), x_session_token: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Requires user authentication; raises 401 if missing or invalid."""
    user = extract_auth_user(authorization, x_session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required. Please sign in to join or manage a squad.")
    return user


# ==========================================
# AUTHENTICATION ENDPOINTS
# ==========================================

@app.post("/api/auth/signup")
@app.post("/api/auth/register")
async def signup(request: UserSignUpRequest):
    """Registers a new student user with their core interests."""
    success, msg, user = create_user(
        username=request.username,
        full_name=request.full_name,
        email=request.email,
        password=request.password,
        stage=request.stage or "12th_pass",
        stream_or_degree=request.stream_or_degree or "",
        target_role=request.target_role or "",
        bio=request.bio or "",
        interests=request.interests,
        avatar_color=request.avatar_color or "#0d9488",
        avatar_emoji=request.avatar_emoji or "🚀"
    )
    if not success:
        raise HTTPException(status_code=400, detail=msg)
        
    token = create_session(user["id"])
    return {
        "success": True,
        "message": msg,
        "token": token,
        "user": user
    }


@app.post("/api/auth/login")
async def login(request: UserLoginRequest):
    """Authenticates a user and returns a 30-day session token."""
    user = authenticate_user(request.username_or_email, request.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username/email or password. Please try again.")
        
    token = create_session(user["id"])
    return {
        "success": True,
        "message": "Welcome back!",
        "token": token,
        "user": user
    }


@app.post("/api/auth/logout")
async def logout(authorization: Optional[str] = Header(None), x_session_token: Optional[str] = Header(None)):
    """Logs out user and invalidates their session token."""
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()
    elif x_session_token:
        token = x_session_token.strip()
    if token:
        delete_session(token)
    return {"success": True, "message": "Successfully logged out."}


@app.get("/api/auth/me")
async def get_me(authorization: Optional[str] = Header(None), x_session_token: Optional[str] = Header(None)):
    """Returns profile of currently logged-in user."""
    user = extract_auth_user(authorization, x_session_token)
    if not user:
        return {"authenticated": False, "user": None}
    return {"authenticated": True, "user": user}


# ==========================================
# PEER MATCHMAKING ENDPOINTS
# ==========================================

@app.get("/api/community/peers")
async def list_matched_peers(
    search: str = Query("", description="Search by name, role, or interest"),
    stage: str = Query("", description="Filter by stage: 12th_pass, final_year, or all"),
    min_overlap: int = Query(0, description="Minimum shared interests overlap"),
    guest_interests: Optional[str] = Query(None, description="Comma-separated interests for guest matchmaking"),
    authorization: Optional[str] = Header(None),
    x_session_token: Optional[str] = Header(None)
):
    """
    Returns peer list calculated against user interests.
    Ranks >= 2 shared interests first as 'Strong Matches'.
    """
    user = extract_auth_user(authorization, x_session_token)
    current_user_id = user["id"] if user else None
    
    parsed_guest_interests = None
    if not current_user_id and guest_interests:
        parsed_guest_interests = [i.strip() for i in guest_interests.split(",") if i.strip()]
        
    peers = get_matched_peers(
        current_user_id=current_user_id,
        search_query=search,
        filter_stage=stage,
        min_overlap=min_overlap,
        guest_interests=parsed_guest_interests
    )
    
    return {
        "success": True,
        "total_peers": len(peers),
        "current_user_id": current_user_id,
        "peers": peers
    }


@app.get("/api/community/user/{user_id}")
async def get_user_profile(
    user_id: int,
    authorization: Optional[str] = Header(None),
    x_session_token: Optional[str] = Header(None)
):
    """Retrieves full profile of a peer with viewer friendship context."""
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
        
    current_user = extract_auth_user(authorization, x_session_token)
    user["is_friend"] = False
    user["is_self"] = False
    if current_user:
        user["is_self"] = (current_user["id"] == user_id)
        user["is_friend"] = is_friend(current_user["id"], user_id)
    return user


# ==========================================
# FRIEND MANAGEMENT & PEER NETWORK ENDPOINTS
# ==========================================

@app.get("/api/friends")
async def list_friends_endpoint(
    authorization: Optional[str] = Header(None),
    x_session_token: Optional[str] = Header(None)
):
    """Returns the authenticated user's friend list."""
    user = require_auth_user(authorization, x_session_token)
    friends = get_user_friends(user["id"])
    return {
        "success": True,
        "total_friends": len(friends),
        "friends": friends
    }


@app.post("/api/friends/add")
async def add_friend_endpoint(
    request: AddFriendRequest,
    authorization: Optional[str] = Header(None),
    x_session_token: Optional[str] = Header(None)
):
    """Adds a friend to authenticated user's friend list by username or user ID."""
    user = require_auth_user(authorization, x_session_token)
    target = request.username.strip() if (request.username and request.username.strip()) else request.friend_id
    if target is None or target == "":
        raise HTTPException(status_code=400, detail="Please provide a valid username or friend_id.")
        
    success, msg, friend = add_friend(user["id"], target)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
        
    return {
        "success": True,
        "message": msg,
        "friend": friend
    }


@app.delete("/api/friends/{friend_id}")
@app.post("/api/friends/{friend_id}/remove")
async def remove_friend_endpoint(
    friend_id: int,
    authorization: Optional[str] = Header(None),
    x_session_token: Optional[str] = Header(None)
):
    """Removes a friend from authenticated user's friend list."""
    user = require_auth_user(authorization, x_session_token)
    success, msg = remove_friend(user["id"], friend_id)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {
        "success": True,
        "message": msg
    }



# ==========================================
# 4-MEMBER SQUAD ENDPOINTS ("RULE OF 4")
# ==========================================

@app.get("/api/squads/all")
async def list_all_squads():
    """Returns public directory of all active and forming squads."""
    squads = get_all_squads()
    return {
        "success": True,
        "total_squads": len(squads),
        "squads": squads
    }


@app.get("/api/squads/my-squad")
async def get_my_squad(authorization: Optional[str] = Header(None), x_session_token: Optional[str] = Header(None)):
    """Returns the authenticated user's current squad details."""
    user = require_auth_user(authorization, x_session_token)
    squad = get_user_squad(user["id"])
    return {
        "in_squad": bool(squad),
        "squad": squad
    }


@app.get("/api/squads/{squad_id}")
async def get_squad(squad_id: int):
    """Returns squad details and all 4 seat states by squad ID."""
    squad = get_squad_details(squad_id)
    if not squad:
        raise HTTPException(status_code=404, detail="Squad not found.")
    return squad


@app.post("/api/squads/create")
async def create_new_squad(
    request: CreateSquadRequest,
    authorization: Optional[str] = Header(None),
    x_session_token: Optional[str] = Header(None)
):
    """Creates a new squad strictly capped at 4 members."""
    user = require_auth_user(authorization, x_session_token)
    success, msg, squad = create_squad(
        user_id=user["id"],
        squad_name=request.squad_name,
        track_name=request.track_name,
        stage=request.stage or "final_year",
        sprint_goal=request.sprint_goal or "Sprint 1: Architecture & System Setup"
    )
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {
        "success": True,
        "message": msg,
        "squad": squad
    }


@app.post("/api/squads/join")
async def join_squad(
    request: JoinSquadRequest,
    authorization: Optional[str] = Header(None),
    x_session_token: Optional[str] = Header(None)
):
    """Joins an existing squad by invite code with max 4 members validation."""
    user = require_auth_user(authorization, x_session_token)
    success, msg, squad = join_squad_by_code(user["id"], request.invite_code)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {
        "success": True,
        "message": msg,
        "squad": squad
    }


@app.post("/api/squads/{squad_id}/leave")
async def leave_squad_endpoint(
    squad_id: int,
    authorization: Optional[str] = Header(None),
    x_session_token: Optional[str] = Header(None)
):
    """Leaves a squad cleanly."""
    user = require_auth_user(authorization, x_session_token)
    success, msg = leave_squad(user["id"], squad_id)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"success": True, "message": msg}


@app.get("/api/squads/{squad_id}/messages")
async def get_messages(squad_id: int, limit: int = Query(50, le=100)):
    """Returns conversation history for squad war room chat."""
    messages = get_squad_messages(squad_id, limit=limit)
    return {
        "success": True,
        "squad_id": squad_id,
        "messages": messages
    }


@app.post("/api/squads/{squad_id}/messages")
async def post_message(
    squad_id: int,
    request: SquadMessageRequest,
    authorization: Optional[str] = Header(None),
    x_session_token: Optional[str] = Header(None)
):
    """Posts a new message to the squad war room."""
    user = require_auth_user(authorization, x_session_token)
    success, msg, message_obj = send_squad_message(squad_id, user["id"], request.message)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {
        "success": True,
        "message_item": message_obj
    }


@app.post("/api/squads/{squad_id}/sprint-goal")
async def update_sprint_goal(
    squad_id: int,
    request: SquadMessageRequest,
    authorization: Optional[str] = Header(None),
    x_session_token: Optional[str] = Header(None)
):
    """Updates the squad's sprint goal."""
    user = require_auth_user(authorization, x_session_token)
    success, msg = update_squad_sprint_goal(squad_id, user["id"], request.message)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"success": True, "message": msg}


MAX_PROGRESS_FILE_SIZE = 300 * 1024 * 1024  # 300 MB limit
ALLOWED_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"}
ALLOWED_VIDEO_EXTS = {".mp4", ".webm", ".mov", ".mkv", ".avi", ".ogv", ".m4v"}


@app.post("/api/squads/{squad_id}/upload-progress")
async def upload_squad_progress(
    squad_id: int,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    authorization: Optional[str] = Header(None),
    x_session_token: Optional[str] = Header(None)
):
    """Uploads an image or video progress demo for teammates (max 300MB)."""
    user = require_auth_user(authorization, x_session_token)

    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No file selected for upload.")

    ext = os.path.splitext(file.filename)[1].lower()
    content_type = (file.content_type or "").lower()

    if ext in ALLOWED_IMAGE_EXTS or content_type.startswith("image/"):
        file_type = "image"
    elif ext in ALLOWED_VIDEO_EXTS or content_type.startswith("video/"):
        file_type = "video"
    else:
        raise HTTPException(
            status_code=400,
            detail="Unsupported format. Allowed: images (png, jpg, webp, gif) or videos (mp4, webm, mov, mkv)."
        )

    uploads_dir = os.path.join(STATIC_DIR, "uploads", "progress", str(squad_id))
    os.makedirs(uploads_dir, exist_ok=True)

    safe_base = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', os.path.splitext(file.filename)[0])[:30]
    unique_filename = f"{int(time.time())}_{uuid.uuid4().hex[:8]}_{safe_base}{ext}"
    dest_path = os.path.join(uploads_dir, unique_filename)

    bytes_written = 0
    try:
        with open(dest_path, "wb") as f_out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                bytes_written += len(chunk)
                if bytes_written > MAX_PROGRESS_FILE_SIZE:
                    f_out.close()
                    if os.path.exists(dest_path):
                        os.remove(dest_path)
                    raise HTTPException(
                        status_code=413,
                        detail=f"File exceeds strict maximum allowed size of 300MB."
                    )
                f_out.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        if os.path.exists(dest_path):
            try:
                os.remove(dest_path)
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

    if bytes_written == 0:
        if os.path.exists(dest_path):
            os.remove(dest_path)
        raise HTTPException(status_code=400, detail="Uploaded file cannot be empty.")

    clean_title = (title or "").strip() or file.filename
    file_url = f"/static/uploads/progress/{squad_id}/{unique_filename}"

    success, msg, upload_obj = save_squad_progress_upload(
        squad_id=squad_id,
        user_id=user["id"],
        title=clean_title,
        file_url=file_url,
        file_type=file_type,
        file_size=bytes_written,
        original_filename=file.filename
    )

    if not success:
        if os.path.exists(dest_path):
            os.remove(dest_path)
        raise HTTPException(status_code=400, detail=msg)

    return {
        "success": True,
        "message": msg,
        "progress": upload_obj
    }


@app.get("/api/squads/{squad_id}/progress")
async def get_progress_list(squad_id: int):
    """Retrieves all uploaded progress artifacts for a squad."""
    uploads = get_squad_progress_uploads(squad_id)
    return {
        "success": True,
        "squad_id": squad_id,
        "total": len(uploads),
        "uploads": uploads
    }




