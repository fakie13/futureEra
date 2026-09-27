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


