from typing import List, Optional
from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    student_type: str = Field(..., description="'12th_pass' or 'final_year'")
    api_key: Optional[str] = Field(None, description="Optional Gemini API key passed directly from client")
    
    # 12th Pass student fields
    stream: Optional[str] = Field(None, description="Stream: PCM, PCB, Commerce (Maths), Commerce, Humanities, Vocational")
    interests: Optional[str] = Field(None, description="Core interests, favorite subjects, hobbies")
    degree_years: Optional[int] = Field(4, description="Target duration: 3, 4, or 5 years")
    preferred_careers: Optional[str] = Field(None, description="Optional target career or curiosity")
    
    # Final Year student fields
    degree_major: Optional[str] = Field(None, description="Current degree and branch, e.g., B.Tech CSE, BCA")
    current_skills: Optional[str] = Field(None, description="Skills, languages, or tools currently known")
    target_role: Optional[str] = Field(None, description="Target job title or industry role")


class AIAnalysis(BaseModel):
    threat_level: str
    why_ai_wont_replace_this: List[str]
    ai_tools_to_master: List[str]


class MarketTechRadar(BaseModel):
    in_demand_technologies: List[str]
    outdated_or_deprioritized: List[str]


class CompensationBenchmarks(BaseModel):
    entry_level: Optional[str] = None
    mid_level: Optional[str] = None
    senior_staff: Optional[str] = None


class FieldIntelligence(BaseModel):
    field_title: str
    industry_reality_2026: str
    compensation_benchmarks: Optional[CompensationBenchmarks] = None
    top_hiring_companies: List[str] = []
    key_specializations: List[str] = []
    critical_architectural_principles: List[str] = []
    high_value_certifications: List[str] = []


class CapstoneProject(BaseModel):
    title: str
    description: str
    tech_stack: List[str] = []
    key_engineering_challenges: List[str] = []
    portfolio_outcome: Optional[str] = None


class TimelineRoadmapItem(BaseModel):
    period: str
    focus_theme: str
    milestone_goals: List[str] = []
    skills_to_acquire: List[str] = []
    capstone_project: Optional[CapstoneProject] = None
    action_project: Optional[str] = None
    career_action_item: Optional[str] = None
    ai_copilot_workflow: Optional[str] = None
    free_learning_resources: List[str] = []


class CareerBlueprintResponse(BaseModel):
    is_valid: bool = True
    error_message: Optional[str] = None
    data_source: Optional[str] = "ai"  # "ai" or "database_cache"
    profile_summary: Optional[str] = None
    field_intelligence: Optional[FieldIntelligence] = None
    ai_analysis: Optional[AIAnalysis] = None
    market_tech_radar: Optional[MarketTechRadar] = None
    timeline_roadmap: Optional[List[TimelineRoadmapItem]] = None
    recommended_roles: Optional[List[str]] = None


class ProfessionSuggestion(BaseModel):
    id: str
    title: str
    match_score: str
    recommended_degrees: List[str] = []
    why_it_fits: str
    market_outlook: str
    salary_range: str
    key_skills: List[str] = []


class SuggestProfessionsRequest(BaseModel):
    stream: str = Field(..., description="12th stream: PCM, PCB, Commerce (Maths), Commerce, Humanities, Vocational")
    interests: str = Field(..., description="Favorite subjects, interests, hobbies")
    degree_years: Optional[int] = Field(4, description="Target duration: 3, 4, or 5 years")
    api_key: Optional[str] = Field(None, description="Optional Gemini API key")


class SuggestProfessionsResponse(BaseModel):
    is_valid: bool = True
    error_message: Optional[str] = None
    data_source: Optional[str] = "ai"  # "ai" or "database_cache"
    stream: str
    interests: str
    suggestions: List[ProfessionSuggestion] = []


# ==========================================
# COMMUNITY, AUTH & SQUAD SCHEMAS
# ==========================================

class UserSignUpRequest(BaseModel):
    username: str
    full_name: str
    email: str
    password: str
    stage: Optional[str] = "12th_pass"
    stream_or_degree: Optional[str] = ""
    target_role: Optional[str] = ""
    bio: Optional[str] = ""
    interests: List[str] = Field(..., min_length=3, description="At least 3 core interests required")
    avatar_color: Optional[str] = "#0d9488"
    avatar_emoji: Optional[str] = ""


class UserLoginRequest(BaseModel):
    username_or_email: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    full_name: str
    email: str
    stage: str
    stream_or_degree: str
    target_role: str
    bio: str
    interests: List[str]
    avatar_color: str
    avatar_emoji: str
    created_at: str
    squad_id: Optional[int] = None
    squad_name: Optional[str] = None


class PeerProfile(BaseModel):
    id: int
    username: str
    full_name: str
    stage: str
    stream_or_degree: str
    target_role: str
    bio: str
    interests: List[str]
    avatar_color: str
    avatar_emoji: str
    shared_interests: List[str] = []
    overlap_count: int = 0
    match_percentage: int = 0
    is_strong_match: bool = False
    in_squad: bool = False
    squad_name: Optional[str] = None


class CreateSquadRequest(BaseModel):
    squad_name: str
    track_name: str
    stage: Optional[str] = "final_year"
    sprint_goal: Optional[str] = "Sprint 1: Architecture & System Setup"


class JoinSquadRequest(BaseModel):
    invite_code: str


class SquadMemberInfo(BaseModel):
    user_id: int
    username: str
    full_name: str
    role: str  # 'leader' or 'member'
    target_role: str
    avatar_color: str
    avatar_emoji: str
    interests: List[str] = []
    joined_at: str


class SquadDetailResponse(BaseModel):
    id: int
    squad_name: str
    invite_code: str
    track_name: str
    stage: str
    created_by: int
    created_by_username: str
    max_members: int = 4
    current_members_count: int
    open_seats: int
    status: str
    sprint_goal: str
    created_at: str
    members: List[SquadMemberInfo] = []


class SquadMessageRequest(BaseModel):
    message: str


class SquadMessageItem(BaseModel):
    id: int
    squad_id: int
    sender_id: int
    sender_username: str
    sender_name: str
    sender_avatar_color: str
    sender_avatar_emoji: str
    message: str
    created_at: str



