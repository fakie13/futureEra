import hashlib
import json
import os
import re
import secrets
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple, List

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "career_repository.sqlite")


def get_db_connection() -> sqlite3.Connection:
    """Creates a thread-safe connection to the SQLite database with WAL mode."""
    conn = sqlite3.connect(DB_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    return conn


def init_db():
    """Initializes the SQLite database tables and indexes."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # 1. Table for complete career blueprints
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS career_blueprints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lookup_key TEXT UNIQUE NOT NULL,
            student_type TEXT NOT NULL,
            stream TEXT,
            interests TEXT,
            target_role TEXT,
            degree_major TEXT,
            degree_years INTEGER DEFAULT 4,
            blueprint_json TEXT NOT NULL,
            hit_count INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 2. Table for eligible profession suggestions
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS profession_suggestions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lookup_key TEXT UNIQUE NOT NULL,
            stream TEXT NOT NULL,
            interests TEXT NOT NULL,
            degree_years INTEGER DEFAULT 4,
            suggestions_json TEXT NOT NULL,
            hit_count INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 3. Community Users table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            stage TEXT DEFAULT '12th_pass',
            stream_or_degree TEXT DEFAULT '',
            target_role TEXT DEFAULT '',
            bio TEXT DEFAULT '',
            avatar_color TEXT DEFAULT '#0d9488',
            avatar_emoji TEXT DEFAULT '🚀',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 4. User Interests table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_interests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            interest TEXT NOT NULL,
            UNIQUE(user_id, interest)
        );
        """)

        # 5. User Sessions table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP
        );
        """)

        # 6. Squads table (4-Member Pods)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS squads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            squad_name TEXT NOT NULL,
            invite_code TEXT UNIQUE NOT NULL,
            track_name TEXT NOT NULL,
            stage TEXT NOT NULL,
            created_by INTEGER NOT NULL REFERENCES users(id),
            max_members INTEGER DEFAULT 4,
            status TEXT DEFAULT 'forming',
            sprint_goal TEXT DEFAULT 'Sprint 1: Architecture & System Setup',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 7. Squad Members table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS squad_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            squad_id INTEGER NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role TEXT DEFAULT 'member',
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(squad_id, user_id)
        );
        """)

        # 8. Squad Messages / Chat table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS squad_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            squad_id INTEGER NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
            sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            message TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 9. Squad Direct Invites table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS squad_invites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            squad_id INTEGER NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
            from_user_id INTEGER NOT NULL REFERENCES users(id),
            to_user_id INTEGER NOT NULL REFERENCES users(id),
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 10. Squad Progress Uploads table (Images & Videos max 300MB)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS squad_progress_uploads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            squad_id INTEGER NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title TEXT,
            file_url TEXT NOT NULL,
            file_type TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            original_filename TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # Column migrations for squad_messages
        try:
            cursor.execute("ALTER TABLE squad_messages ADD COLUMN media_url TEXT;")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE squad_messages ADD COLUMN media_type TEXT;")
        except Exception:
            pass

        # 11. User Friends table (Peer Network)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_friends (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, friend_id)
        );
        """)

        # Create search indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_blueprints_lookup ON career_blueprints(lookup_key);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_blueprints_role ON career_blueprints(target_role);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_blueprints_stream ON career_blueprints(stream);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_suggestions_lookup ON profession_suggestions(lookup_key);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_suggestions_stream ON profession_suggestions(stream);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_interests_user ON user_interests(user_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_interests_tag ON user_interests(interest);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_squads_code ON squads(invite_code);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_squad_members_squad ON squad_members(squad_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_squad_members_user ON squad_members(user_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_squad_msg_squad ON squad_messages(squad_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_progress_squad ON squad_progress_uploads(squad_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_progress_user ON squad_progress_uploads(user_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_friends_user ON user_friends(user_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_friends_friend ON user_friends(friend_id);")
        
        # Seed initial rich blueprints, suggestions, and community data
        seed_initial_data_if_empty(conn)
        seed_community_data_if_empty(conn)
        
        conn.commit()


def normalize_text(text: Optional[str]) -> str:
    """Normalizes string for robust lookup matching."""
    if not text:
        return ""
    clean = re.sub(r"[^\w\s]", " ", text.lower())
    tokens = [t.strip() for t in clean.split() if t.strip()]
    return " ".join(tokens)


def make_blueprint_lookup_key(data: dict) -> str:
    """Generates a normalized deterministic lookup key for a blueprint query."""
    student_type = (data.get("student_type") or "12th_pass").strip().lower()
    
    if student_type == "final_year":
        role = normalize_text(data.get("target_role"))
        degree = normalize_text(data.get("degree_major"))
        return f"final_year|{role}|{degree}"
    else:
        stream = normalize_text(data.get("stream"))
        preferred = normalize_text(data.get("preferred_careers"))
        years = str(data.get("degree_years") or 4)
        if preferred:
            return f"12th_pass|{stream}|{preferred}|{years}"
        interests = normalize_text(data.get("interests"))
        return f"12th_pass|{stream}|{interests}|{years}"


def make_suggestions_lookup_key(data: dict) -> str:
    """Generates a normalized deterministic lookup key for profession suggestions."""
    stream = normalize_text(data.get("stream"))
    interests = normalize_text(data.get("interests"))
    return f"{stream}|{interests}"


def save_blueprint_to_db(data: dict, blueprint: dict) -> bool:
    """
    Saves an AI-generated career blueprint into SQLite database.
    If lookup_key exists, increments hit_count and updates timestamp.
    """
    if not isinstance(blueprint, dict) or not blueprint.get("is_valid", True):
        return False
        
    try:
        lookup_key = make_blueprint_lookup_key(data)
        student_type = data.get("student_type") or "12th_pass"
        stream = data.get("stream")
        interests = data.get("interests")
        degree_major = data.get("degree_major")
        degree_years = data.get("degree_years") or 4
        
        target_role = (
            data.get("preferred_careers") 
            or data.get("target_role") 
            or (blueprint.get("field_intelligence") or {}).get("field_title")
            or (blueprint.get("recommended_roles") or ["Custom Architecture"])[0]
        )

        blueprint_json_str = json.dumps(blueprint, ensure_ascii=False)

        with get_db_connection() as conn:
            conn.execute("""
            INSERT INTO career_blueprints (
                lookup_key, student_type, stream, interests, 
                target_role, degree_major, degree_years, blueprint_json, hit_count, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
            ON CONFLICT(lookup_key) DO UPDATE SET
                hit_count = hit_count + 1,
                blueprint_json = excluded.blueprint_json,
                updated_at = CURRENT_TIMESTAMP;
            """, (
                lookup_key, student_type, stream, interests,
                target_role, degree_major, degree_years, blueprint_json_str
            ))
            conn.commit()
            return True
    except Exception as e:
        print(f"[DB Warning] Could not save blueprint to database: {e}")
        return False


def get_blueprint_from_db(data: dict) -> Optional[Dict[str, Any]]:
    """
    Retrieves a cached blueprint from SQLite database.
    Uses multi-stage fallback:
    1. Exact lookup_key match
    2. Target role match
    3. Stream match for 12th pass
    4. General match for student_type
    """
    try:
        lookup_key = make_blueprint_lookup_key(data)
        student_type = data.get("student_type") or "12th_pass"
        target_role = data.get("preferred_careers") or data.get("target_role") or ""
        stream = data.get("stream") or ""

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # 1. Exact lookup key
            cursor.execute("SELECT blueprint_json FROM career_blueprints WHERE lookup_key = ? LIMIT 1;", (lookup_key,))
            row = cursor.fetchone()
            if row and row["blueprint_json"]:
                parsed = json.loads(row["blueprint_json"])
                parsed["_cached_from_db"] = True
                return parsed

            # 2. Match by target role
            if target_role:
                norm_role = f"%{normalize_text(target_role)}%"
                cursor.execute("""
                SELECT blueprint_json FROM career_blueprints 
                WHERE LOWER(target_role) LIKE ? 
                ORDER BY hit_count DESC, id DESC LIMIT 1;
                """, (norm_role,))
                row = cursor.fetchone()
                if row and row["blueprint_json"]:
                    parsed = json.loads(row["blueprint_json"])
                    parsed["_cached_from_db"] = True
                    return parsed

            # 3. Match by stream for 12th pass
            if student_type == "12th_pass" and stream:
                norm_stream = f"%{normalize_text(stream)}%"
                cursor.execute("""
                SELECT blueprint_json FROM career_blueprints 
                WHERE student_type = '12th_pass' AND LOWER(stream) LIKE ? 
                ORDER BY hit_count DESC, id DESC LIMIT 1;
                """, (norm_stream,))
                row = cursor.fetchone()
                if row and row["blueprint_json"]:
                    parsed = json.loads(row["blueprint_json"])
                    parsed["_cached_from_db"] = True
                    return parsed

            # 4. Fallback to latest valid blueprint for student_type
            cursor.execute("""
            SELECT blueprint_json FROM career_blueprints 
            WHERE student_type = ? 
            ORDER BY hit_count DESC, id DESC LIMIT 1;
            """, (student_type,))
            row = cursor.fetchone()
            if row and row["blueprint_json"]:
                parsed = json.loads(row["blueprint_json"])
                parsed["_cached_from_db"] = True
                return parsed

    except Exception as e:
        print(f"[DB Warning] Error querying blueprint from database: {e}")
        
    return None


def save_suggestions_to_db(data: dict, suggestions_resp: dict) -> bool:
    """
    Saves an AI-generated profession suggestions response into SQLite database.
    """
    if not isinstance(suggestions_resp, dict) or not suggestions_resp.get("is_valid", True):
        return False
        
    try:
        lookup_key = make_suggestions_lookup_key(data)
        stream = data.get("stream") or "PCM"
        interests = data.get("interests") or ""
        degree_years = data.get("degree_years") or 4
        suggestions_json_str = json.dumps(suggestions_resp, ensure_ascii=False)

        with get_db_connection() as conn:
            conn.execute("""
            INSERT INTO profession_suggestions (
                lookup_key, stream, interests, degree_years, 
                suggestions_json, hit_count, updated_at
            ) VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
            ON CONFLICT(lookup_key) DO UPDATE SET
                hit_count = hit_count + 1,
                suggestions_json = excluded.suggestions_json,
                updated_at = CURRENT_TIMESTAMP;
            """, (lookup_key, stream, interests, degree_years, suggestions_json_str))
            conn.commit()
            return True
    except Exception as e:
        print(f"[DB Warning] Could not save suggestions to database: {e}")
        return False


def get_suggestions_from_db(data: dict) -> Optional[Dict[str, Any]]:
    """
    Retrieves cached profession suggestions from SQLite database.
    Uses multi-stage fallback:
    1. Exact lookup_key match
    2. Stream match
    3. Any existing suggestions
    """
    try:
        lookup_key = make_suggestions_lookup_key(data)
        stream = data.get("stream") or ""

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # 1. Exact lookup key
            cursor.execute("SELECT suggestions_json FROM profession_suggestions WHERE lookup_key = ? LIMIT 1;", (lookup_key,))
            row = cursor.fetchone()
            if row and row["suggestions_json"]:
                parsed = json.loads(row["suggestions_json"])
                parsed["_cached_from_db"] = True
                return parsed

            # 2. Match by stream
            if stream:
                norm_stream = f"%{normalize_text(stream)}%"
                cursor.execute("""
                SELECT suggestions_json FROM profession_suggestions 
                WHERE LOWER(stream) LIKE ? 
                ORDER BY hit_count DESC, id DESC LIMIT 1;
                """, (norm_stream,))
                row = cursor.fetchone()
                if row and row["suggestions_json"]:
                    parsed = json.loads(row["suggestions_json"])
                    parsed["_cached_from_db"] = True
                    return parsed

            # 3. Any suggestions in DB
            cursor.execute("SELECT suggestions_json FROM profession_suggestions ORDER BY hit_count DESC, id DESC LIMIT 1;")
            row = cursor.fetchone()
            if row and row["suggestions_json"]:
                parsed = json.loads(row["suggestions_json"])
                parsed["_cached_from_db"] = True
                return parsed

    except Exception as e:
        print(f"[DB Warning] Error querying suggestions from database: {e}")

    return None


def seed_initial_data_if_empty(conn: sqlite3.Connection):
    """Pre-seeds SQLite database with rich baseline blueprints & suggestions if empty."""
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) AS c FROM career_blueprints;")
    if cursor.fetchone()["c"] > 0:
        return

    # Seed baseline suggestions
    from app.services.gemini_service import get_curated_fallback_suggestions
    
    streams_interests = [
        ("PCM (Maths)", "Coding & Tech", 4),
        ("PCB (Biology)", "Healthcare & Bio", 4),
        ("Commerce (Maths)", "Finance & Markets", 4),
        ("Humanities / Arts", "UI/UX & Design", 4),
        ("Vocational & Tech", "Robotics & Hardware", 4)
    ]

    for stream, interests, years in streams_interests:
        suggestions_list = get_curated_fallback_suggestions(stream, interests)
        payload = {"stream": stream, "interests": interests, "degree_years": years}
        lookup_key = make_suggestions_lookup_key(payload)
        resp_obj = {
            "is_valid": True,
            "data_source": "database_cache",
            "stream": stream,
            "interests": interests,
            "suggestions": suggestions_list
        }
        cursor.execute("""
        INSERT OR IGNORE INTO profession_suggestions (lookup_key, stream, interests, degree_years, suggestions_json, hit_count)
        VALUES (?, ?, ?, ?, ?, 1);
        """, (lookup_key, stream, interests, years, json.dumps(resp_obj, ensure_ascii=False)))

    # Seed 1: AI & Machine Learning Systems Architect
    ai_blueprint = {
        "is_valid": True,
        "data_source": "database_cache",
        "profile_summary": "High-leverage engineering trajectory focused on neural architectures, production LLM pipelines, distributed model training, and low-latency inference systems in 2026 enterprise scale.",
        "field_intelligence": {
            "field_title": "AI & Machine Learning Systems Architect",
            "industry_reality_2026": "Value in 2026 has transitioned from simple model training to end-to-end MLOps, vector database retrieval boundaries, autonomous agent evaluation loops, and hardware GPU acceleration orchestration.",
            "compensation_benchmarks": {
                "entry_level": "₹9 - ₹18 LPA ($95,000 - $130,000 Remote/Global)",
                "mid_level": "₹22 - ₹42 LPA ($145,000 - $210,000 Remote/Global)",
                "senior_staff": "₹50 - ₹95+ LPA ($240,000 - $380,000+ Staff/Principal)"
            },
            "top_hiring_companies": ["OpenAI", "Google DeepMind", "Anthropic", "NVIDIA", "Meta AI", "Microsoft", "Databricks"],
            "key_specializations": [
                "Foundation Model Distillation & Quantization",
                "Agentic Workflow & Multi-Agent Orchestration",
                "High-Throughput Vector Indexing & Hybrid Search",
                "On-Device Edge Neural Processing"
            ],
            "critical_architectural_principles": [
                "Model Latency vs. Perplexity Trade-Off Governance",
                "Deterministic Boundary Enforcement over Probabilistic LLMs",
                "Context Window Memory Caching & Semantic Compression",
                "Zero-Data Leakage AI Privacy & Vector Role-Based Access"
            ],
            "high_value_certifications": [
                "AWS Certified Machine Learning - Specialty",
                "Google Cloud Professional Machine Learning Engineer",
                "DeepLearning.AI Production Machine Learning Systems (MLeP)"
            ]
        },
        "ai_analysis": {
            "threat_level": "Low (Architectural Resilient)",
            "why_ai_wont_replace_this": [
                "Architecting high-concurrency model inference pipelines requires deep OS-level kernel tuning and GPU memory allocation judgement AI cannot self-orchestrate.",
                "Real-world data pipelines have high semantic ambiguity, regulatory boundaries, and compliance risks needing human executive sign-off.",
                "Autonomous debugging of model degradation, hallucinations, and distribution drift requires deep mathematical and domain intuition."
            ],
            "ai_tools_to_master": [
                "Cursor IDE & Claude 3.5 Sonnet for kernel shader and tensor optimization",
                "Weights & Biases / Langfuse for LLM observability and automated regression traces",
                "vLLM & TensorRT-LLM for high-throughput continuous batching inference"
            ]
        },
        "market_tech_radar": {
            "in_demand_technologies": ["PyTorch 2.4+", "vLLM", "Qdrant / Milvus", "LangGraph", "Docker / Triton", "CUDA / Triton Kernels"],
            "outdated_or_deprioritized": ["Standalone Scikit-Learn for NLP", "Static Rule-Based Chatbots", "Manual Hyperparameter Grid Search"]
        },
        "timeline_roadmap": [
            {
                "period": "Year 1: Foundations & Systems Architecture",
                "focus_theme": "Algorithmic Foundations, Systems Programming & Mathematical Core",
                "milestone_goals": [
                    "Master Linear Algebra, Multivariable Calculus, and Probability for Machine Learning",
                    "Build solid Data Structures & Algorithms proficiency in Modern Python and C++",
                    "Understand Linux OS internals, process memory layout, and concurrency"
                ],
                "skills_to_acquire": ["Python 3.12+", "C++20", "NumPy & Vectorization", "Linux Shell & Git", "Algorithmic Thinking"],
                "capstone_project": {
                    "title": "Custom Vector Space Search Engine from Scratch",
                    "description": "Production-grade in-memory vector indexing engine with HNSW graph indexing, cosine/dot-product SIMD instructions, and REST API.",
                    "tech_stack": ["Python", "FastAPI", "NumPy", "Docker"],
                    "key_engineering_challenges": [
                        "Optimizing high-dimensional nearest-neighbor graph traversal without external ML libraries",
                        "Ensuring sub-10ms query latency over 100,000 embedding vectors"
                    ],
                    "portfolio_outcome": "Complete GitHub repository with unit tests, benchmark suite, and Dockerfile."
                },
                "career_action_item": "Solve 100 LeetCode Mediums; set up technical GitHub portfolio; contribute to 1 open-source Python tool.",
                "ai_copilot_workflow": "Use Claude/Cursor for syntax clarification and test generation, but write vector algorithms by hand.",
                "free_learning_resources": ["3Blue1Brown Essence of Linear Algebra", "CS50 Introduction to Computer Science (Harvard)", "MIT 6.006 Algorithms"]
            },
            {
                "period": "Year 2: Deep Learning & Production Microservices",
                "focus_theme": "Neural Architectures, Transformers & Scalable Backend Systems",
                "milestone_goals": [
                    "Implement Multilayer Perceptrons, CNNs, and Self-Attention Transformer mechanisms from scratch",
                    "Design high-throughput asynchronous REST & gRPC microservices",
                    "Deploy models using containerized microservices and automated CI/CD"
                ],
                "skills_to_acquire": ["PyTorch", "Hugging Face Ecosystem", "FastAPI / gRPC", "PostgreSQL & pgvector", "Docker & GitHub Actions"],
                "capstone_project": {
                    "title": "Enterprise Knowledge Graph RAG Engine",
                    "description": "Hybrid vector and graph-augmented generation pipeline with semantic chunking, re-ranking, and citation tracking.",
                    "tech_stack": ["PyTorch", "FastAPI", "Neo4j", "Qdrant", "Docker"],
                    "key_engineering_challenges": [
                        "Preventing hallucination using strict confidence-threshold re-ranking",
                        "Managing async concurrency for simultaneous document ingestion"
                    ],
                    "portfolio_outcome": "Live hosted demo with automated CI/CD and production architecture design doc."
                },
                "career_action_item": "Compete in 2 Kaggle/HuggingFace hackathons; build a technical engineering blog explaining attention mechanisms.",
                "ai_copilot_workflow": "Use Copilot for boilerplate API routing, but focus human energy on prompt evaluations and embedding schema design.",
                "free_learning_resources": ["Fast.ai Practical Deep Learning", "Stanford CS224N Natural Language Processing", "Full Stack Deep Learning Course"]
            },
            {
                "period": "Year 3: Production MLOps & Distributed Serving",
                "focus_theme": "High-Throughput Serving, Agentic Workflows & Model Fine-Tuning",
                "milestone_goals": [
                    "Master LoRA/QLoRA parameter-efficient fine-tuning on open-weight LLMs",
                    "Implement multi-agent collaborative workflows with structured tool execution",
                    "Deploy distributed inference using vLLM and TensorRT on GPU cloud clusters"
                ],
                "skills_to_acquire": ["vLLM / Ollama", "Unsloth / LoRA", "LangGraph / CrewAI", "Kubernetes & Helm", "Weights & Biases"],
                "capstone_project": {
                    "title": "Autonomous DevOps SRE Incident Remediation Agent",
                    "description": "Multi-agent autonomous system that ingests live Kubernetes logs, identifies root-cause errors, writes safe patches, and generates PRs.",
                    "tech_stack": ["Python", "vLLM", "LangGraph", "Kubernetes", "Prometheus"],
                    "key_engineering_challenges": [
                        "Implementing deterministic sandboxing so the AI agent cannot execute destructive cluster commands",
                        "Streaming real-time reasoning tokens to an interactive dashboard"
                    ],
                    "portfolio_outcome": "Open-source GitHub release with 100+ stars potential, comprehensive documentation, and video demo."
                },
                "career_action_item": "Secure 6-month AI Engineering Internship; participate in Google Summer of Code or major OSS project.",
                "ai_copilot_workflow": "Orchestrate multi-agent copilots to auto-review pull requests and generate integration test suites.",
                "free_learning_resources": ["DeepLearning.AI LangChain / LangGraph Courses", "vLLM Official Documentation", "Chip Huyen Designing Machine Learning Systems"]
            },
            {
                "period": "Year 4: Enterprise Scale, Security & Placement Launch",
                "focus_theme": "Architectural Leadership, Zero-Trust AI Security & High-Yield Placements",
                "milestone_goals": [
                    "Design fault-tolerant, multi-region AI architectures with sub-50ms TTFT (Time to First Token)",
                    "Audit model safety, prompt injection defenses, and compliance with EU AI Act and GDPR",
                    "Clear top-tier technical system design and coding placement interviews"
                ],
                "skills_to_acquire": ["System Design for AI", "Prompt Injection & Red-Teaming", "Distributed Training (DeepSpeed)", "Cloud Cost Optimization"],
                "capstone_project": {
                    "title": "Global Low-Latency Distributed AI Inference Gateway",
                    "description": "Geographically distributed AI proxy gateway featuring semantic caching, multi-provider load balancing, and rate-limiting.",
                    "tech_stack": ["Rust / Go", "Redis", "Cloudflare Workers", "OpenTelemetry"],
                    "key_engineering_challenges": [
                        "Cache hit detection based on semantic vector similarity at wire speed",
                        "Automated fallback routing during provider outages"
                    ],
                    "portfolio_outcome": "Production production-grade repository with automated benchmarking suite, load testing report, and system architecture RFC."
                },
                "career_action_item": "Complete 150+ LeetCode Hard/Mediums; conduct 10 mock system design interviews; secure Tier-1 Product Company AI/ML Engineer offer.",
                "ai_copilot_workflow": "Utilize AI code reviewers to conduct automated vulnerability scans and stress testing.",
                "free_learning_resources": ["Designing Data-Intensive Applications (Kleppmann)", "Alex Xu System Design Interview Vol 1 & 2", "Awesome Production Machine Learning"]
            }
        ],
        "recommended_roles": [
            "AI & Machine Learning Systems Architect",
            "MLOps Platform Engineer",
            "Generative AI Solutions Architect",
            "Applied AI Research Engineer"
        ]
    }

    # Insert for 12th pass
    key_12th_ai = make_blueprint_lookup_key({
        "student_type": "12th_pass",
        "stream": "PCM (Maths)",
        "preferred_careers": "Artificial Intelligence & Machine Learning Architect",
        "degree_years": 4
    })
    cursor.execute("""
    INSERT OR IGNORE INTO career_blueprints (
        lookup_key, student_type, stream, interests, target_role, degree_years, blueprint_json, hit_count
    ) VALUES (?, '12th_pass', 'PCM (Maths)', 'Coding & Tech', 'Artificial Intelligence & Machine Learning Architect', 4, ?, 5);
    """, (key_12th_ai, json.dumps(ai_blueprint, ensure_ascii=False)))

    # Insert for final year
    key_fy_ai = make_blueprint_lookup_key({
        "student_type": "final_year",
        "degree_major": "B.Tech CSE",
        "target_role": "Artificial Intelligence & Machine Learning Architect"
    })
    cursor.execute("""
    INSERT OR IGNORE INTO career_blueprints (
        lookup_key, student_type, stream, interests, target_role, degree_major, degree_years, blueprint_json, hit_count
    ) VALUES (?, 'final_year', 'Engineering', 'Machine Learning', 'Artificial Intelligence & Machine Learning Architect', 'B.Tech CSE', 4, ?, 5);
    """, (key_fy_ai, json.dumps(ai_blueprint, ensure_ascii=False)))

    # Seed 2: Full Stack Cloud & Systems Engineer
    fs_blueprint = {
        "is_valid": True,
        "data_source": "database_cache",
        "profile_summary": "Comprehensive architectural trajectory mastering high-concurrency cloud backends, modern TypeScript frontends, microservices orchestration, and DevOps deployment pipelines for the 2026 market.",
        "field_intelligence": {
            "field_title": "Full Stack Cloud & Distributed Systems Engineer",
            "industry_reality_2026": "Full stack engineering in 2026 is no longer about writing CRUD HTML/CSS. It requires designing resilient distributed state, event-driven microservices, database sharding, and utilizing AI-augmented dev workflows.",
            "compensation_benchmarks": {
                "entry_level": "₹8 - ₹16 LPA ($85,000 - $125,000 Remote/Global)",
                "mid_level": "₹18 - ₹34 LPA ($135,000 - $185,000 Remote/Global)",
                "senior_staff": "₹42 - ₹80+ LPA ($210,000 - $330,000+ Staff/Lead)"
            },
            "top_hiring_companies": ["Google", "Stripe", "Amazon Web Services", "Uber", "Atlassian", "Shopify", "Cloudflare"],
            "key_specializations": [
                "Event-Driven Microservices Architecture (Kafka/RabbitMQ)",
                "High-Throughput Database Sharding & Read-Replicas",
                "Cloud-Native Infrastructure as Code (Terraform/Kubernetes)",
                "Edge Rendering & Real-time WebSockets"
            ],
            "critical_architectural_principles": [
                "Idempotency in Distributed State & Payments",
                "Database ACID Boundaries vs. Eventual Consistency",
                "Cache Invalidation & Stale-While-Revalidate Patterns",
                "Zero-Downtime Blue/Green Deployment Strategies"
            ],
            "high_value_certifications": [
                "AWS Certified Solutions Architect - Associate",
                "Certified Kubernetes Administrator (CKA)",
                "HashiCorp Certified: Terraform Associate"
            ]
        },
        "ai_analysis": {
            "threat_level": "Low (System Architecture Focus)",
            "why_ai_wont_replace_this": [
                "End-to-end integration across multi-cloud distributed networks requires complex security and latency trade-offs that AI cannot autonomously negotiate.",
                "Production outages involve intricate race conditions and database deadlocks across distributed nodes.",
                "Business domain modeling and customer requirements require high human stakeholder alignment."
            ],
            "ai_tools_to_master": [
                "Cursor IDE with Claude 3.5 Sonnet for rapid full-stack scaffolding and type-checking",
                "GitHub Copilot Workspace for multi-file pull request automation",
                "OpenTelemetry & Datadog AI for automated distributed tracing anomaly detection"
            ]
        },
        "market_tech_radar": {
            "in_demand_technologies": ["TypeScript", "Next.js / React 19", "Go / Rust", "PostgreSQL / Redis", "Docker & Kubernetes", "Kafka"],
            "outdated_or_deprioritized": ["jQuery", "Monolithic PHP without frameworks", "Manual FTP Server Deployments", "Unindexed SQL Queries"]
        },
        "timeline_roadmap": [
            {
                "period": "Year 1: Foundations & Systems Architecture",
                "focus_theme": "Modern JavaScript/TypeScript, Web Standards & Database Fundamentals",
                "milestone_goals": [
                    "Master JavaScript ES2024, TypeScript strict typing, and DOM execution loops",
                    "Understand relational database normalization and SQL query indexing",
                    "Build responsive, accessible user interfaces with modern CSS frameworks"
                ],
                "skills_to_acquire": ["TypeScript", "HTML5 & Tailwind CSS", "Node.js", "PostgreSQL", "Git & GitHub"],
                "capstone_project": {
                    "title": "Collaborative Real-Time Workspace Canvas",
                    "description": "Multiplayer real-time collaborative document board with WebSockets, optimistic UI updates, and conflict-free replicated data structures.",
                    "tech_stack": ["TypeScript", "Node.js", "WebSockets", "PostgreSQL", "Tailwind CSS"],
                    "key_engineering_challenges": [
                        "Managing concurrent user updates with sub-20ms synchronization",
                        "Database indexing for fast historic version retrieval"
                    ],
                    "portfolio_outcome": "Live deployed application on Vercel/Render with automated unit testing."
                },
                "career_action_item": "Solve 80 LeetCode problems; publish clean portfolio site on GitHub pages.",
                "ai_copilot_workflow": "Use Claude for CSS and TypeScript type definitions; write database queries manually.",
                "free_learning_resources": ["The Odin Project", "MDN Web Docs", "FullStackOpen (University of Helsinki)"]
            },
            {
                "period": "Year 2: Scalable Backends & Cloud Microservices",
                "focus_theme": "Microservices, Authentication, Distributed Caching & Docker",
                "milestone_goals": [
                    "Design secure OAuth2/JWT authentication systems with refresh token rotation",
                    "Implement multi-layer Redis caching with cache-invalidation strategies",
                    "Containerize application services with Docker and Docker Compose"
                ],
                "skills_to_acquire": ["Docker", "Redis", "Next.js App Router", "REST & GraphQL", "Linux Server Administration"],
                "capstone_project": {
                    "title": "High-Throughput E-Commerce Flash Sale Platform",
                    "description": "Scalable checkout engine capable of handling 5,000 orders/second with Redis inventory locking and message queue worker pools.",
                    "tech_stack": ["Next.js", "Node.js / Express", "Redis", "BullMQ", "PostgreSQL"],
                    "key_engineering_challenges": [
                        "Preventing race condition overselling under concurrent load spikes",
                        "Decoupling checkout flow using asynchronous worker queues"
                    ],
                    "portfolio_outcome": "Benchmarked load-test report using k6 showing zero overselling under 10,000 concurrent virtual users."
                },
                "career_action_item": "Build full portfolio of 3 full-stack systems; participate in 2 national hackathons.",
                "ai_copilot_workflow": "Use AI to generate mock test data and edge-case unit test scenarios.",
                "free_learning_resources": ["Docker Getting Started Guide", "Redis University", "Pragmatic Programmer"]
            },
            {
                "period": "Year 3: Distributed Systems, DevOps & Kubernetes",
                "focus_theme": "Event-Driven Architecture, Infrastructure as Code & CI/CD",
                "milestone_goals": [
                    "Deploy applications onto Kubernetes clusters with ingress routing and auto-scaling",
                    "Implement event streaming pipelines using Apache Kafka or RabbitMQ",
                    "Automate infrastructure provisioning using Terraform and GitHub Actions"
                ],
                "skills_to_acquire": ["Kubernetes", "Apache Kafka", "Terraform", "AWS (EC2, S3, RDS, CloudFront)", "CI/CD Pipelines"],
                "capstone_project": {
                    "title": "Distributed Cloud Video Transcoding & Streaming Engine",
                    "description": "Event-driven video pipeline that chunks, transcodes into HLS formats, and streams via CDN with auto-scaling worker nodes.",
                    "tech_stack": ["Go", "Kafka", "FFmpeg", "AWS S3", "Docker", "Kubernetes"],
                    "key_engineering_challenges": [
                        "Scaling CPU-intensive worker pods based on queue depth metrics",
                        "Secure signed-URL streaming authorization"
                    ],
                    "portfolio_outcome": "Complete open-source repository with Terraform scripts and architectural RFC."
                },
                "career_action_item": "Secure 6-month Software Engineering Internship; clear AWS Certified Solutions Architect Associate.",
                "ai_copilot_workflow": "Use AI to review Terraform configurations and generate CI/CD YAML pipelines.",
                "free_learning_resources": ["Kubernetes The Hard Way (Kelsey Hightower)", "Kafka: The Definitive Guide", "Terraform Official Tutorials"]
            },
            {
                "period": "Year 4: Enterprise Scale, Security & Placement Launch",
                "focus_theme": "High-Yield Interview Preparation, System Design Mastery & SDE Placements",
                "milestone_goals": [
                    "Master distributed system design concepts (CAP theorem, consistent hashing, rate limiters)",
                    "Audit web application security (OWASP Top 10, SQLi, XSS, CSRF)",
                    "Ace Data Structures & Algorithms placement interviews at Tier-1 tech firms"
                ],
                "skills_to_acquire": ["System Design", "Web Security (OWASP)", "Performance Profiling", "Site Reliability Engineering (SRE)"],
                "capstone_project": {
                    "title": "Enterprise API Gateway & Rate-Limiter",
                    "description": "High-performance edge reverse-proxy with sliding-window rate limiting, JWT validation, and real-time observability telemetry.",
                    "tech_stack": ["Go / Rust", "Redis", "Prometheus", "Grafana", "Docker"],
                    "key_engineering_challenges": [
                        "Atomic sliding-window counter execution with sub-millisecond overhead",
                        "Graceful degradation and circuit breaking under upstream failure"
                    ],
                    "portfolio_outcome": "High-throughput production system with detailed performance benchmarks and comprehensive API documentation."
                },
                "career_action_item": "Complete 150+ LeetCode Medium/Hard problems; participate in 10 mock technical interviews; secure Tier-1 SDE offer.",
                "ai_copilot_workflow": "Use AI to simulate technical coding interview questions and critique system design trade-offs.",
                "free_learning_resources": ["Designing Data-Intensive Applications", "System Design Primer (GitHub)", "NeetCode 150 DSA"]
            }
        ],
        "recommended_roles": [
            "Full Stack Cloud & Distributed Systems Engineer",
            "Backend Systems Engineer",
            "Platform DevOps Engineer",
            "Cloud Solutions Architect"
        ]
    }

    key_12th_fs = make_blueprint_lookup_key({
        "student_type": "12th_pass",
        "stream": "PCM (Maths)",
        "preferred_careers": "Full Stack Cloud & Distributed Systems Engineer",
        "degree_years": 4
    })
    cursor.execute("""
    INSERT OR IGNORE INTO career_blueprints (
        lookup_key, student_type, stream, interests, target_role, degree_years, blueprint_json, hit_count
    ) VALUES (?, '12th_pass', 'PCM (Maths)', 'Coding & Tech', 'Full Stack Cloud & Distributed Systems Engineer', 4, ?, 5);
    """, (key_12th_fs, json.dumps(fs_blueprint, ensure_ascii=False)))

    key_fy_fs = make_blueprint_lookup_key({
        "student_type": "final_year",
        "degree_major": "B.Tech CSE",
        "target_role": "Full Stack Cloud & Distributed Systems Engineer"
    })
    cursor.execute("""
    INSERT OR IGNORE INTO career_blueprints (
        lookup_key, student_type, stream, interests, target_role, degree_major, degree_years, blueprint_json, hit_count
    ) VALUES (?, 'final_year', 'Engineering', 'Coding & Tech', 'Full Stack Cloud & Distributed Systems Engineer', 'B.Tech CSE', 4, ?, 5);
    """, (key_fy_fs, json.dumps(fs_blueprint, ensure_ascii=False)))


def get_database_stats() -> Dict[str, Any]:
    """Returns database telemetry and count of stored blueprints, suggestions, users, and squads."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) AS total FROM career_blueprints;")
            b_count = cursor.fetchone()["total"]
            cursor.execute("SELECT COUNT(*) AS total FROM profession_suggestions;")
            s_count = cursor.fetchone()["total"]
            cursor.execute("SELECT COUNT(*) AS total FROM users;")
            u_count = cursor.fetchone()["total"]
            cursor.execute("SELECT COUNT(*) AS total FROM squads;")
            sq_count = cursor.fetchone()["total"]
            return {
                "status": "healthy",
                "database_path": DB_PATH,
                "total_blueprints_cached": b_count,
                "total_suggestions_cached": s_count,
                "total_community_users": u_count,
                "total_squads_active": sq_count
            }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "database_path": DB_PATH
        }


# ==========================================
# AUTHENTICATION & PASSWORD HELPERS
# ==========================================

def hash_password(password: str) -> Tuple[str, str]:
    """Generates salt and hashes password using PBKDF2 HMAC SHA-256."""
    salt = secrets.token_hex(16)
    pw_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000).hex()
    return salt, pw_hash


def verify_password(password: str, salt: str, expected_hash: str) -> bool:
    """Verifies a password against the stored salt and hash."""
    pw_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000).hex()
    return secrets.compare_digest(pw_hash, expected_hash)


def seed_community_data_if_empty(conn: sqlite3.Connection):
    """Seeds initial peer profiles and starter squad if community is empty."""
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) AS c FROM users;")
    if cursor.fetchone()["c"] > 0:
        return

    sample_peers = [
        {
            "username": "aarav_dev",
            "full_name": "Aarav Sharma",
            "email": "aarav@example.com",
            "password": "Password@123",
            "stage": "final_year",
            "stream_or_degree": "B.Tech Computer Science (4th Year)",
            "target_role": "Full Stack Cloud Systems Engineer",
            "bio": "Building distributed backends with FastAPI, Go and Docker. Passionate about system design and cloud deployments.",
            "avatar_color": "#0d9488",
            "avatar_emoji": "💻",
            "interests": ["Coding & Tech", "Cloud & DevOps", "AI & Machine Learning"]
        },
        {
            "username": "priya_ai",
            "full_name": "Priya Patel",
            "email": "priya@example.com",
            "password": "Password@123",
            "stage": "final_year",
            "stream_or_degree": "B.Tech AI & Data Science (4th Year)",
            "target_role": "AI & MLOps Systems Architect",
            "bio": "Researching model quantization, vector retrieval, and autonomous agents. Leading Neural Vanguard squad.",
            "avatar_color": "#8b5cf6",
            "avatar_emoji": "🧠",
            "interests": ["AI & Machine Learning", "Coding & Tech", "Data Science & Analytics"]
        },
        {
            "username": "rohan_sec",
            "full_name": "Rohan Verma",
            "email": "rohan@example.com",
            "password": "Password@123",
            "stage": "12th_pass",
            "stream_or_degree": "PCM (Maths & Physics)",
            "target_role": "Cloud Security Architect",
            "bio": "12th graduate planning for cybersecurity & network infrastructure. Looking for hackathon partners.",
            "avatar_color": "#ef4444",
            "avatar_emoji": "🛡️",
            "interests": ["Cybersecurity", "Coding & Tech", "Cloud & DevOps"]
        },
        {
            "username": "ananya_design",
            "full_name": "Ananya Iyer",
            "email": "ananya@example.com",
            "password": "Password@123",
            "stage": "final_year",
            "stream_or_degree": "B.Des Product & UI/UX Design",
            "target_role": "Lead Product Designer & Design Systems Engineer",
            "bio": "Crafting high-conversion glassmorphic interfaces, micro-interactions, and design tokens.",
            "avatar_color": "#f59e0b",
            "avatar_emoji": "🎨",
            "interests": ["UI/UX & Product Design", "Coding & Tech", "Human-Computer Interaction"]
        },
        {
            "username": "karthik_robotics",
            "full_name": "Karthik Nair",
            "email": "karthik@example.com",
            "password": "Password@123",
            "stage": "12th_pass",
            "stream_or_degree": "PCM (Maths, Electronics & CS)",
            "target_role": "Autonomous Robotics & Embedded Systems Engineer",
            "bio": "Programming microcontrollers (ESP32/STM32) and ROS2 navigation nodes. Keen on embedded AI.",
            "avatar_color": "#06b6d4",
            "avatar_emoji": "🤖",
            "interests": ["Robotics & IoT", "Coding & Tech", "AI & Machine Learning"]
        },
        {
            "username": "sneha_fintech",
            "full_name": "Sneha Mukherjee",
            "email": "sneha@example.com",
            "password": "Password@123",
            "stage": "final_year",
            "stream_or_degree": "B.Com FinTech & Financial Modeling",
            "target_role": "Quantitative Risk & FinTech Systems Analyst",
            "bio": "Exploring algorithmic trading execution, risk modeling, and financial data pipelines with Python.",
            "avatar_color": "#10b981",
            "avatar_emoji": "📈",
            "interests": ["Finance & Markets", "AI & Machine Learning", "Coding & Tech"]
        },
        {
            "username": "vikram_data",
            "full_name": "Vikram Malhotra",
            "email": "vikram@example.com",
            "password": "Password@123",
            "stage": "final_year",
            "stream_or_degree": "B.Tech Information Technology (4th Year)",
            "target_role": "Big Data & Distributed Pipeline Engineer",
            "bio": "Architecting Apache Kafka event streams, Spark clusters, and Delta Lake storage engines for real-time analytics.",
            "avatar_color": "#3b82f6",
            "avatar_emoji": "⚡",
            "interests": ["Data Science & Analytics", "Cloud & DevOps", "Coding & Tech"]
        },
        {
            "username": "diya_frontend",
            "full_name": "Diya Sengupta",
            "email": "diya@example.com",
            "password": "Password@123",
            "stage": "12th_pass",
            "stream_or_degree": "PCM with Computer Science",
            "target_role": "Creative Frontend Engineer & 3D Web Developer",
            "bio": "Passionate about Three.js, WebGL shaders, and high-performance interactive web animations.",
            "avatar_color": "#ec4899",
            "avatar_emoji": "✨",
            "interests": ["UI/UX & Product Design", "Coding & Tech", "Human-Computer Interaction"]
        },
        {
            "username": "aditya_cloud",
            "full_name": "Aditya Rao",
            "email": "aditya@example.com",
            "password": "Password@123",
            "stage": "final_year",
            "stream_or_degree": "B.Tech CSE - Cloud Specialization",
            "target_role": "Platform & Kubernetes SRE Specialist",
            "bio": "Automating multi-cloud Kubernetes clusters with Terraform, Helm, and GitOps CI/CD pipelines.",
            "avatar_color": "#6366f1",
            "avatar_emoji": "☁️",
            "interests": ["Cloud & DevOps", "Cybersecurity", "Coding & Tech"]
        },
        {
            "username": "tanvi_mobile",
            "full_name": "Tanvi Kapoor",
            "email": "tanvi@example.com",
            "password": "Password@123",
            "stage": "12th_pass",
            "stream_or_degree": "PCM (Physics, Chemistry, Maths)",
            "target_role": "Cross-Platform Mobile Application Architect",
            "bio": "Building fluid cross-platform iOS & Android apps with Flutter, Kotlin Multiplatform, and Supabase.",
            "avatar_color": "#14b8a6",
            "avatar_emoji": "📱",
            "interests": ["Coding & Tech", "UI/UX & Product Design", "AI & Machine Learning"]
        }
    ]

    user_ids = {}
    for p in sample_peers:
        salt, pw_hash = hash_password(p["password"])
        cursor.execute("""
        INSERT INTO users (username, full_name, email, password_hash, salt, stage, stream_or_degree, target_role, bio, avatar_color, avatar_emoji)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            p["username"], p["full_name"], p["email"], pw_hash, salt,
            p["stage"], p["stream_or_degree"], p["target_role"], p["bio"],
            p["avatar_color"], p["avatar_emoji"]
        ))
        uid = cursor.lastrowid
        user_ids[p["username"]] = uid
        for interest in p["interests"]:
            cursor.execute("""
            INSERT OR IGNORE INTO user_interests (user_id, interest) VALUES (?, ?);
            """, (uid, interest))

    # Standard 10 Project Squads
    sample_squads = [
        {
            "squad_name": "Neural Vanguard",
            "invite_code": "NV-2026",
            "track_name": "AI & Distributed Cloud Systems",
            "stage": "final_year",
            "creator": "priya_ai",
            "sprint_goal": "Sprint 1: Distributed Inference Architecture & Real-Time Telemetry",
            "members": [("priya_ai", "leader"), ("aarav_dev", "architect"), ("ananya_design", "design_lead")],
            "messages": [
                ("priya_ai", "Welcome team! Our Sprint 1 objective is to complete the distributed inference pipeline and system specs."),
                ("aarav_dev", "I've drafted the FastAPI orchestration router and Redis cache layer. Everything is running with sub-10ms response times."),
                ("ananya_design", "Designing the live telemetry dashboard wireframes now! We still have 1 open seat for a 4th teammate to join."),
                ("priya_ai", "Anyone matching AI or Cloud interests can use invite code NV-2026 to take our final open seat! 🚀")
            ]
        },
        {
            "squad_name": "Cloud Sentinels",
            "invite_code": "FE-E4B4",
            "track_name": "Cloud Architecture & Zero-Trust Security",
            "stage": "final_year",
            "creator": "aditya_cloud",
            "sprint_goal": "Sprint 1: VPC Network Topology & Terraform Infrastructure as Code",
            "members": [("aditya_cloud", "leader"), ("rohan_sec", "security_analyst")],
            "messages": [
                ("aditya_cloud", "Cloud Sentinels assembled! Deploying automated AWS Multi-AZ infrastructure with Terraform."),
                ("rohan_sec", "Running security scans across IAM roles and VPC ingress rules. Open for 2 more members!")
            ]
        },
        {
            "squad_name": "Quantum Leap",
            "invite_code": "QL-7140",
            "track_name": "Data Engineering & Real-Time Streaming",
            "stage": "final_year",
            "creator": "vikram_data",
            "sprint_goal": "Sprint 1: Kafka Event Streams & Delta Lake Analytics Lakehouse",
            "members": [("vikram_data", "leader")],
            "messages": [
                ("vikram_data", "Setting up our real-time streaming pipeline. 3 open seats available for data enthusiasts!")
            ]
        },
        {
            "squad_name": "ByteCraft Studio",
            "invite_code": "BC-5519",
            "track_name": "Interactive WebGL & Design Systems",
            "stage": "12th_pass",
            "creator": "diya_frontend",
            "sprint_goal": "Sprint 1: 3D Landing Page Canvas & Component Token Library",
            "members": [("diya_frontend", "leader")],
            "messages": [
                ("diya_frontend", "Creating interactive 3D web experiences with Three.js! Looking for 3 creative devs to join.")
            ]
        },
        {
            "squad_name": "CyberShield Ops",
            "invite_code": "CO-9023",
            "track_name": "Offensive Security & Penetration Testing",
            "stage": "12th_pass",
            "creator": "rohan_sec",
            "sprint_goal": "Sprint 1: Network Threat Emulation Lab & Automated Vulnerability Scanner",
            "members": [("rohan_sec", "leader")],
            "messages": [
                ("rohan_sec", "Building automated network auditing tools for ethical hacking. Join with code CO-9023!")
            ]
        }
    ]

    for sq in sample_squads:
        creator_id = user_ids.get(sq["creator"], 1)
        cursor.execute("""
        INSERT INTO squads (squad_name, invite_code, track_name, stage, created_by, max_members, status, sprint_goal)
        VALUES (?, ?, ?, ?, ?, 4, 'forming', ?);
        """, (sq["squad_name"], sq["invite_code"], sq["track_name"], sq["stage"], creator_id, sq["sprint_goal"]))
        squad_id = cursor.lastrowid

        for u_name, role in sq["members"]:
            u_id = user_ids.get(u_name)
            if u_id:
                cursor.execute("INSERT OR IGNORE INTO squad_members (squad_id, user_id, role) VALUES (?, ?, ?);", (squad_id, u_id, role))

        for sender_name, msg_text in sq["messages"]:
            s_id = user_ids.get(sender_name)
            if s_id:
                cursor.execute("INSERT INTO squad_messages (squad_id, sender_id, message) VALUES (?, ?, ?);", (squad_id, s_id, msg_text))


# ==========================================
# USER PROFILE & AUTH FUNCTIONS
# ==========================================

def create_user(
    username: str,
    full_name: str,
    email: str,
    password: str,
    stage: str = "12th_pass",
    stream_or_degree: str = "",
    target_role: str = "",
    bio: str = "",
    interests: Optional[List[str]] = None,
    avatar_color: str = "#0d9488",
    avatar_emoji: str = "🚀"
) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
    """Registers a new student user and associates their core interests."""
    username = username.strip().lower()
    email = email.strip().lower()
    full_name = full_name.strip()
    
    if not username or len(username) < 3:
        return False, "Username must be at least 3 characters long.", None
    if not re.match(r"^[a-zA-Z0-9_]+$", username):
        return False, "Username can only contain letters, numbers, and underscores.", None
    if not email or "@" not in email:
        return False, "Please provide a valid email address.", None
    if not password or len(password) < 6:
        return False, "Password must be at least 6 characters long.", None
    if not interests or len(interests) < 3:
        return False, "Please select at least 3 core interests to enable peer matchmaking.", None

    salt, pw_hash = hash_password(password)

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1;", (username, email))
            existing = cursor.fetchone()
            if existing:
                return False, "A user with this username or email already exists.", None

            cursor.execute("""
            INSERT INTO users (username, full_name, email, password_hash, salt, stage, stream_or_degree, target_role, bio, avatar_color, avatar_emoji)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (username, full_name, email, pw_hash, salt, stage, stream_or_degree, target_role, bio, avatar_color, avatar_emoji))
            
            user_id = cursor.lastrowid
            
            for interest in interests:
                cursor.execute("INSERT OR IGNORE INTO user_interests (user_id, interest) VALUES (?, ?);", (user_id, interest.strip()))
                
            conn.commit()
            return True, "User registered successfully!", get_user_by_id(user_id)
    except Exception as e:
        return False, f"Failed to register user: {str(e)}", None


def authenticate_user(username_or_email: str, password: str) -> Optional[Dict[str, Any]]:
    """Authenticates a user by username or email and password."""
    identifier = username_or_email.strip().lower()
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ? LIMIT 1;
            """, (identifier, identifier))
            row = cursor.fetchone()
            if not row:
                return None
                
            if verify_password(password, row["salt"], row["password_hash"]):
                return get_user_by_id(row["id"])
            return None
    except Exception as e:
        print(f"[Auth Error] {e}")
        return None


def create_session(user_id: int) -> str:
    """Creates a 30-day session token for an authenticated user."""
    token = secrets.token_urlsafe(32)
    expires = (datetime.utcnow() + timedelta(days=30)).isoformat()
    with get_db_connection() as conn:
        conn.execute("INSERT INTO user_sessions (token, user_id, expires_at) VALUES (?, ?, ?);", (token, user_id, expires))
        conn.commit()
    return token


def get_user_by_session(token: str) -> Optional[Dict[str, Any]]:
    """Looks up user from valid session token."""
    if not token:
        return None
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT user_id FROM user_sessions WHERE token = ? LIMIT 1;", (token.strip(),))
            row = cursor.fetchone()
            if row:
                return get_user_by_id(row["user_id"])
    except Exception as e:
        print(f"[Session Error] {e}")
    return None


def delete_session(token: str) -> bool:
    """Terminates a session token upon user logout."""
    try:
        with get_db_connection() as conn:
            conn.execute("DELETE FROM user_sessions WHERE token = ?;", (token.strip(),))
            conn.commit()
        return True
    except Exception:
        return False


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """Retrieves full user profile, interests, and squad membership."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE id = ?;", (user_id,))
            u = cursor.fetchone()
            if not u:
                return None
            
            cursor.execute("SELECT interest FROM user_interests WHERE user_id = ? ORDER BY id;", (user_id,))
            interests = [r["interest"] for r in cursor.fetchall()]
            
            cursor.execute("""
            SELECT s.id, s.squad_name, sm.role 
            FROM squad_members sm 
            JOIN squads s ON s.id = sm.squad_id 
            WHERE sm.user_id = ? LIMIT 1;
            """, (user_id,))
            squad_row = cursor.fetchone()
            
            return {
                "id": u["id"],
                "username": u["username"],
                "full_name": u["full_name"],
                "email": u["email"],
                "stage": u["stage"],
                "stream_or_degree": u["stream_or_degree"],
                "target_role": u["target_role"],
                "bio": u["bio"],
                "avatar_color": u["avatar_color"],
                "avatar_emoji": u["avatar_emoji"],
                "created_at": str(u["created_at"]),
                "interests": interests,
                "squad_id": squad_row["id"] if squad_row else None,
                "squad_name": squad_row["squad_name"] if squad_row else None,
                "squad_role": squad_row["role"] if squad_row else None
            }
    except Exception as e:
        print(f"[DB Error] get_user_by_id: {e}")
        return None


# ==========================================
# PEER MATCHMAKING ENGINE (>= 2 OVERLAP)
# ==========================================

def get_matched_peers(
    current_user_id: Optional[int] = None, 
    search_query: str = "", 
    filter_stage: str = "",
    min_overlap: int = 0,
    guest_interests: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """
    Peer Matchmaking Engine:
    Identifies peers based on interest overlap.
    If 2 or more interests match: highlights as 'Strong Match' (is_strong_match=True).
    Ranks strong matches first, followed by overlap count and match percentage.
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            base_interests = []
            if current_user_id:
                cursor.execute("SELECT interest FROM user_interests WHERE user_id = ?;", (current_user_id,))
                base_interests = [r["interest"] for r in cursor.fetchall()]
            elif guest_interests:
                base_interests = guest_interests
                
            base_set = set(base_interests)
            
            if current_user_id:
                cursor.execute("""
                SELECT * FROM users 
                WHERE id != ? 
                  AND username != 'dev_test'
                  AND username NOT LIKE 'testuser_%' 
                  AND username NOT LIKE 'member_%' 
                  AND username NOT LIKE 'solo_%' 
                  AND username NOT LIKE 'sizetester_%'
                ORDER BY id ASC;
                """, (current_user_id,))
            else:
                cursor.execute("""
                SELECT * FROM users 
                WHERE username NOT LIKE 'testuser_%' 
                  AND username NOT LIKE 'member_%' 
                  AND username NOT LIKE 'solo_%' 
                  AND username NOT LIKE 'sizetester_%'
                  AND username != 'dev_test'
                ORDER BY id ASC;
                """)
                
            all_users = cursor.fetchall()
            results = []
            q = search_query.strip().lower()
            
            for u in all_users:
                uid = u["id"]
                cursor.execute("SELECT interest FROM user_interests WHERE user_id = ?;", (uid,))
                peer_interests = [r["interest"] for r in cursor.fetchall()]
                peer_set = set(peer_interests)
                
                cursor.execute("""
                SELECT s.id, s.squad_name FROM squad_members sm 
                JOIN squads s ON s.id = sm.squad_id 
                WHERE sm.user_id = ? LIMIT 1;
                """, (uid,))
                sq = cursor.fetchone()
                
                shared = [i for i in peer_interests if i in base_set]
                overlap_count = len(shared)
                total_union = len(base_set | peer_set)
                match_pct = round((overlap_count / total_union) * 100) if total_union > 0 else 0
                is_strong = overlap_count >= 2
                
                # Search filtering
                if q:
                    user_str = f"{u['username']} {u['full_name']} {u['stream_or_degree']} {u['target_role']} {u['bio']} {' '.join(peer_interests)}".lower()
                    if q not in user_str:
                        continue
                        
                # Stage filtering
                if filter_stage and filter_stage != "all":
                    if u["stage"] != filter_stage:
                        continue
                        
                # Minimum overlap filtering
                if min_overlap > 0 and overlap_count < min_overlap:
                    continue
                    
                results.append({
                    "id": uid,
                    "username": u["username"],
                    "full_name": u["full_name"],
                    "stage": u["stage"],
                    "stream_or_degree": u["stream_or_degree"],
                    "target_role": u["target_role"],
                    "bio": u["bio"],
                    "interests": peer_interests,
                    "avatar_color": u["avatar_color"],
                    "avatar_emoji": u["avatar_emoji"],
                    "shared_interests": shared,
                    "overlap_count": overlap_count,
                    "match_percentage": match_pct,
                    "is_strong_match": is_strong,
                    "in_squad": bool(sq),
                    "squad_name": sq["squad_name"] if sq else None
                })
                
            # Strong matches (>= 2 shared) first, then highest overlap, then match percentage
            results.sort(key=lambda x: (1 if x["is_strong_match"] else 0, x["overlap_count"], x["match_percentage"]), reverse=True)
            return results
    except Exception as e:
        print(f"[Matchmaking Error] {e}")
        return []


# ==========================================
# 4-MEMBER SQUAD ENGINE ("THE RULE OF 4")
# ==========================================

def create_squad(
    user_id: int, 
    squad_name: str, 
    track_name: str, 
    stage: str = "final_year", 
    sprint_goal: str = ""
) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
    """Creates a new squad capped strictly at 4 members."""
    squad_name = squad_name.strip()
    track_name = track_name.strip()
    sprint_goal = (sprint_goal or "Sprint 1: Architecture & System Setup").strip()
    
    if not squad_name:
        return False, "Squad name is required.", None
    if not track_name:
        return False, "Track or focus domain is required.", None
        
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("SELECT squad_id FROM squad_members WHERE user_id = ? LIMIT 1;", (user_id,))
            if cursor.fetchone():
                return False, "You are already a member of a squad. Leave your current squad before creating a new one.", None
                
            # Generate unique clean invite code e.g. FE-8K2N
            code = ""
            for _ in range(20):
                code = f"FE-{secrets.token_hex(2).upper()}"
                cursor.execute("SELECT id FROM squads WHERE invite_code = ?;", (code,))
                if not cursor.fetchone():
                    break
                    
            cursor.execute("""
            INSERT INTO squads (squad_name, invite_code, track_name, stage, created_by, max_members, status, sprint_goal)
            VALUES (?, ?, ?, ?, ?, 4, 'forming', ?);
            """, (squad_name, code, track_name, stage, user_id, sprint_goal))
            
            squad_id = cursor.lastrowid
            
            cursor.execute("""
            INSERT INTO squad_members (squad_id, user_id, role)
            VALUES (?, ?, 'leader');
            """, (squad_id, user_id))
            
            cursor.execute("""
            INSERT INTO squad_messages (squad_id, sender_id, message)
            VALUES (?, ?, ?);
            """, (squad_id, user_id, f"🚀 Squad '{squad_name}' created! Share invite code '{code}' to recruit 3 more teammates."))
            
            conn.commit()
            return True, "Squad successfully created!", get_squad_details(squad_id)
    except Exception as e:
        return False, f"Failed to create squad: {str(e)}", None


def join_squad_by_code(user_id: int, invite_code: str) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
    """Joins a squad using unique invite code; strictly enforces 4-member limit."""
    code = invite_code.strip().upper()
    if not code:
        return False, "Please enter a valid Squad Invite Code.", None
        
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("SELECT * FROM squads WHERE invite_code = ? LIMIT 1;", (code,))
            squad = cursor.fetchone()
            if not squad:
                return False, f"No squad found with invite code '{code}'. Please check the code and try again.", None
                
            squad_id = squad["id"]
            
            cursor.execute("SELECT id FROM squad_members WHERE squad_id = ? AND user_id = ?;", (squad_id, user_id))
            if cursor.fetchone():
                return True, "You are already in a team.", get_squad_details(squad_id)
                
            cursor.execute("SELECT s.squad_name FROM squad_members sm JOIN squads s ON s.id = sm.squad_id WHERE sm.user_id = ?;", (user_id,))
            existing_squad = cursor.fetchone()
            if existing_squad:
                return False, f"You are already in a team ({existing_squad['squad_name']}). Please leave that squad first before joining another.", None
                
            # Strictly enforce 4-member limit
            cursor.execute("SELECT COUNT(*) AS c FROM squad_members WHERE squad_id = ?;", (squad_id,))
            current_count = cursor.fetchone()["c"]
            if current_count >= squad["max_members"]:
                return False, f"This squad has already reached maximum capacity ({squad['max_members']}/{squad['max_members']} members).", None
                
            cursor.execute("""
            INSERT INTO squad_members (squad_id, user_id, role)
            VALUES (?, ?, 'member');
            """, (squad_id, user_id))
            
            if current_count + 1 >= squad["max_members"]:
                cursor.execute("UPDATE squads SET status = 'ready' WHERE id = ?;", (squad_id,))
                
            cursor.execute("SELECT full_name FROM users WHERE id = ?;", (user_id,))
            u = cursor.fetchone()
            uname = u["full_name"] if u else "New Member"
            cursor.execute("""
            INSERT INTO squad_messages (squad_id, sender_id, message)
            VALUES (?, ?, ?);
            """, (squad_id, user_id, f"🎉 {uname} joined the squad! ({current_count + 1}/{squad['max_members']} seats filled)"))
            
            conn.commit()
            return True, f"Successfully joined {squad['squad_name']}!", get_squad_details(squad_id)
    except Exception as e:
        return False, f"Failed to join squad: {str(e)}", None


def get_squad_details(squad_id: int) -> Optional[Dict[str, Any]]:
    """Retrieves full details of a squad with all 4 seat states."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT s.*, u.username AS leader_username, u.full_name AS leader_name 
            FROM squads s 
            JOIN users u ON u.id = s.created_by 
            WHERE s.id = ?;
            """, (squad_id,))
            sq = cursor.fetchone()
            if not sq:
                return None
                
            cursor.execute("""
            SELECT sm.role, sm.joined_at, u.id AS user_id, u.username, u.full_name, u.target_role, u.avatar_color, u.avatar_emoji
            FROM squad_members sm 
            JOIN users u ON u.id = sm.user_id 
            WHERE sm.squad_id = ? 
            ORDER BY CASE WHEN sm.role = 'leader' THEN 0 ELSE 1 END, sm.joined_at ASC;
            """, (squad_id,))
            members_rows = cursor.fetchall()
            
            members = []
            for m in members_rows:
                cursor.execute("SELECT interest FROM user_interests WHERE user_id = ?;", (m["user_id"],))
                m_interests = [r["interest"] for r in cursor.fetchall()]
                members.append({
                    "user_id": m["user_id"],
                    "username": m["username"],
                    "full_name": m["full_name"],
                    "role": m["role"],
                    "target_role": m["target_role"],
                    "avatar_color": m["avatar_color"],
                    "avatar_emoji": m["avatar_emoji"],
                    "interests": m_interests,
                    "joined_at": str(m["joined_at"])
                })
                
            count = len(members)
            open_seats = max(0, sq["max_members"] - count)
            
            return {
                "id": sq["id"],
                "squad_name": sq["squad_name"],
                "invite_code": sq["invite_code"],
                "track_name": sq["track_name"],
                "stage": sq["stage"],
                "created_by": sq["created_by"],
                "created_by_username": sq["leader_username"],
                "max_members": sq["max_members"],
                "current_members_count": count,
                "open_seats": open_seats,
                "status": "ready" if count >= sq["max_members"] else sq["status"],
                "sprint_goal": sq["sprint_goal"],
                "created_at": str(sq["created_at"]),
                "members": members
            }
    except Exception as e:
        print(f"[DB Error] get_squad_details: {e}")
        return None


def get_user_squad(user_id: int) -> Optional[Dict[str, Any]]:
    """Gets the active squad of a user if any."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT squad_id FROM squad_members WHERE user_id = ? LIMIT 1;", (user_id,))
            row = cursor.fetchone()
            if row:
                return get_squad_details(row["squad_id"])
    except Exception as e:
        print(f"[DB Error] get_user_squad: {e}")
    return None


def get_all_squads() -> List[Dict[str, Any]]:
    """Returns directory of all squads with seats and status."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT id FROM squads 
            WHERE squad_name NOT LIKE 'Pod_%' 
              AND squad_name NOT LIKE 'SizeSquad_%'
            ORDER BY id ASC;
            """)
            rows = cursor.fetchall()
            result = []
            for r in rows:
                sq = get_squad_details(r["id"])
                if sq:
                    result.append(sq)
            return result
    except Exception as e:
        print(f"[DB Error] get_all_squads: {e}")
        return []


def send_squad_message(squad_id: int, sender_id: int, message: str) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
    """Posts a message to the squad war room chat."""
    msg = message.strip()
    if not msg:
        return False, "Message cannot be empty.", None
    if len(msg) > 1000:
        return False, "Message is too long (max 1000 characters).", None
        
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM squad_members WHERE squad_id = ? AND user_id = ?;", (squad_id, sender_id))
            if not cursor.fetchone():
                return False, "You must be a member of this squad to send messages.", None
                
            cursor.execute("""
            INSERT INTO squad_messages (squad_id, sender_id, message)
            VALUES (?, ?, ?);
            """, (squad_id, sender_id, msg))
            msg_id = cursor.lastrowid
            conn.commit()
            
            cursor.execute("""
            SELECT sm.*, u.username, u.full_name, u.avatar_color, u.avatar_emoji 
            FROM squad_messages sm 
            JOIN users u ON u.id = sm.sender_id 
            WHERE sm.id = ?;
            """, (msg_id,))
            row = cursor.fetchone()
            return True, "Message sent.", {
                "id": row["id"],
                "squad_id": row["squad_id"],
                "sender_id": row["sender_id"],
                "sender_username": row["username"],
                "sender_name": row["full_name"],
                "sender_avatar_color": row["avatar_color"],
                "sender_avatar_emoji": row["avatar_emoji"],
                "message": row["message"],
                "created_at": str(row["created_at"])
            }
    except Exception as e:
        return False, f"Failed to send message: {str(e)}", None


def get_squad_messages(squad_id: int, limit: int = 60) -> List[Dict[str, Any]]:
    """Fetches real-time conversation messages for a squad."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT sm.*, u.username, u.full_name, u.avatar_color, u.avatar_emoji 
            FROM squad_messages sm 
            JOIN users u ON u.id = sm.sender_id 
            WHERE sm.squad_id = ? 
            ORDER BY sm.id ASC 
            LIMIT ?;
            """, (squad_id, limit))
            rows = cursor.fetchall()
            return [
                {
                    "id": r["id"],
                    "squad_id": r["squad_id"],
                    "sender_id": r["sender_id"],
                    "sender_username": r["username"],
                    "sender_name": r["full_name"],
                    "sender_avatar_color": r["avatar_color"],
                    "sender_avatar_emoji": r["avatar_emoji"],
                    "message": r["message"],
                    "media_url": r["media_url"] if "media_url" in r.keys() else None,
                    "media_type": r["media_type"] if "media_type" in r.keys() else None,
                    "created_at": str(r["created_at"])
                }
                for r in rows
            ]
    except Exception as e:
        print(f"[DB Error] get_squad_messages: {e}")
        return []


def save_squad_progress_upload(
    squad_id: int,
    user_id: int,
    title: str,
    file_url: str,
    file_type: str,
    file_size: int,
    original_filename: str
) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
    """Records an uploaded progress image/video and notifies squad chat."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM squad_members WHERE squad_id = ? AND user_id = ?;", (squad_id, user_id))
            if not cursor.fetchone():
                return False, "You must be a member of this squad to upload progress.", None

            cursor.execute("""
            INSERT INTO squad_progress_uploads (squad_id, user_id, title, file_url, file_type, file_size, original_filename)
            VALUES (?, ?, ?, ?, ?, ?, ?);
            """, (squad_id, user_id, title, file_url, file_type, file_size, original_filename))
            upload_id = cursor.lastrowid

            # Post notification with media into squad chat
            media_label = "video demo" if file_type == "video" else "screenshot"
            caption_part = f": {title}" if title else ""
            chat_msg = f"Shared progress {media_label}{caption_part}"

            cursor.execute("""
            INSERT INTO squad_messages (squad_id, sender_id, message, media_url, media_type)
            VALUES (?, ?, ?, ?, ?);
            """, (squad_id, user_id, chat_msg, file_url, file_type))

            conn.commit()

            cursor.execute("""
            SELECT p.*, u.username, u.full_name, u.avatar_color 
            FROM squad_progress_uploads p
            JOIN users u ON u.id = p.user_id
            WHERE p.id = ?;
            """, (upload_id,))
            r = cursor.fetchone()
            return True, "Progress media shared successfully!", {
                "id": r["id"],
                "squad_id": r["squad_id"],
                "user_id": r["user_id"],
                "username": r["username"],
                "full_name": r["full_name"],
                "avatar_color": r["avatar_color"],
                "title": r["title"],
                "file_url": r["file_url"],
                "file_type": r["file_type"],
                "file_size": r["file_size"],
                "original_filename": r["original_filename"],
                "created_at": str(r["created_at"])
            }
    except Exception as e:
        return False, f"Failed to save progress upload: {str(e)}", None


def get_squad_progress_uploads(squad_id: int) -> List[Dict[str, Any]]:
    """Retrieves all uploaded progress artifacts for a squad."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT p.*, u.username, u.full_name, u.avatar_color 
            FROM squad_progress_uploads p
            JOIN users u ON u.id = p.user_id
            WHERE p.squad_id = ?
            ORDER BY p.id DESC;
            """, (squad_id,))
            rows = cursor.fetchall()
            return [
                {
                    "id": r["id"],
                    "squad_id": r["squad_id"],
                    "user_id": r["user_id"],
                    "username": r["username"],
                    "full_name": r["full_name"],
                    "avatar_color": r["avatar_color"],
                    "title": r["title"],
                    "file_url": r["file_url"],
                    "file_type": r["file_type"],
                    "file_size": r["file_size"],
                    "original_filename": r["original_filename"],
                    "created_at": str(r["created_at"])
                }
                for r in rows
            ]
    except Exception as e:
        print(f"[DB Error] get_squad_progress_uploads: {e}")
        return []


def update_squad_sprint_goal(squad_id: int, user_id: int, sprint_goal: str) -> Tuple[bool, str]:
    """Updates the squad's sprint objective."""
    goal = sprint_goal.strip()
    if not goal:
        return False, "Sprint goal cannot be empty."
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT role FROM squad_members WHERE squad_id = ? AND user_id = ?;", (squad_id, user_id))
            m = cursor.fetchone()
            if not m:
                return False, "You must be a member of this squad to update the sprint goal."
            cursor.execute("UPDATE squads SET sprint_goal = ? WHERE id = ?;", (goal, squad_id))
            conn.commit()
            return True, "Sprint goal updated!"
    except Exception as e:
        return False, f"Failed to update sprint goal: {str(e)}"


def leave_squad(user_id: int, squad_id: int) -> Tuple[bool, str]:
    """Allows a member or leader to leave a squad cleanly."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT role FROM squad_members WHERE squad_id = ? AND user_id = ?;", (squad_id, user_id))
            m = cursor.fetchone()
            if not m:
                return False, "You are not a member of this squad."
                
            cursor.execute("DELETE FROM squad_members WHERE squad_id = ? AND user_id = ?;", (squad_id, user_id))
            
            cursor.execute("SELECT COUNT(*) AS c FROM squad_members WHERE squad_id = ?;", (squad_id,))
            remaining = cursor.fetchone()["c"]
            if remaining == 0:
                cursor.execute("DELETE FROM squads WHERE id = ?;", (squad_id,))
            else:
                if m["role"] == "leader":
                    cursor.execute("SELECT id FROM squad_members WHERE squad_id = ? ORDER BY joined_at ASC LIMIT 1;", (squad_id,))
                    next_leader = cursor.fetchone()
                    if next_leader:
                        cursor.execute("UPDATE squad_members SET role = 'leader' WHERE id = ?;", (next_leader["id"],))
                cursor.execute("UPDATE squads SET status = 'forming' WHERE id = ?;", (squad_id,))
                
            conn.commit()
            return True, "Successfully left the squad."
    except Exception as e:
        return False, f"Failed to leave squad: {str(e)}"


# ==========================================
# FRIEND MANAGEMENT & PEER NETWORK
# ==========================================

def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    """Retrieves full user profile by username (case-insensitive)."""
    clean_username = username.strip().lstrip("@")
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE LOWER(username) = LOWER(?);", (clean_username,))
            row = cursor.fetchone()
            if not row:
                return None
            return get_user_by_id(row["id"])
    except Exception as e:
        logger.error(f"Error fetching user by username '{username}': {e}")
        return None


def add_friend(user_id: int, friend_identifier: Union[int, str]) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
    """Adds a friend to user's friend list by ID or username."""
    try:
        target_user = None
        if isinstance(friend_identifier, int) or (isinstance(friend_identifier, str) and friend_identifier.isdigit()):
            target_user = get_user_by_id(int(friend_identifier))
        else:
            target_user = get_user_by_username(str(friend_identifier))
            
        if not target_user:
            clean_name = str(friend_identifier).strip()
            return False, f"User '{clean_name}' not found.", None
            
        friend_id = target_user["id"]
        if friend_id == user_id:
            return False, "You cannot add yourself as a friend.", None
            
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM user_friends WHERE user_id = ? AND friend_id = ?;", (user_id, friend_id))
            if cursor.fetchone():
                return False, f"@{target_user['username']} is already in your friend list.", target_user
                
            cursor.execute("""
            INSERT INTO user_friends (user_id, friend_id)
            VALUES (?, ?);
            """, (user_id, friend_id))
            conn.commit()
            
            return True, f"Added @{target_user['username']} to your friends!", target_user
    except Exception as e:
        logger.error(f"Error adding friend {friend_identifier} for user {user_id}: {e}")
        return False, f"Failed to add friend: {str(e)}", None


def remove_friend(user_id: int, friend_id: int) -> Tuple[bool, str]:
    """Removes a friend from user's friend list."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM user_friends WHERE user_id = ? AND friend_id = ?;", (user_id, friend_id))
            conn.commit()
            if cursor.rowcount == 0:
                return False, "User is not in your friend list."
            return True, "Friend removed successfully."
    except Exception as e:
        logger.error(f"Error removing friend {friend_id} for user {user_id}: {e}")
        return False, f"Failed to remove friend: {str(e)}"


def get_user_friends(user_id: int) -> List[Dict[str, Any]]:
    """Returns list of friends for the specified user."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT u.id, u.username, u.full_name, u.stage, u.stream_or_degree, u.target_role, 
                   u.bio, u.avatar_color, u.avatar_emoji, uf.created_at as friended_at
            FROM user_friends uf
            JOIN users u ON u.id = uf.friend_id
            WHERE uf.user_id = ?
            ORDER BY uf.id DESC;
            """, (user_id,))
            rows = cursor.fetchall()
            
            friends = []
            for r in rows:
                f_id = r["id"]
                cursor.execute("SELECT interest FROM user_interests WHERE user_id = ? ORDER BY id;", (f_id,))
                interests = [ir["interest"] for ir in cursor.fetchall()]
                
                cursor.execute("""
                SELECT s.id, s.squad_name, sm.role 
                FROM squad_members sm 
                JOIN squads s ON s.id = sm.squad_id 
                WHERE sm.user_id = ? LIMIT 1;
                """, (f_id,))
                squad_row = cursor.fetchone()
                
                friends.append({
                    "id": f_id,
                    "username": r["username"],
                    "full_name": r["full_name"],
                    "stage": r["stage"],
                    "stream_or_degree": r["stream_or_degree"],
                    "target_role": r["target_role"],
                    "bio": r["bio"],
                    "avatar_color": r["avatar_color"],
                    "avatar_emoji": r["avatar_emoji"],
                    "interests": interests,
                    "squad_id": squad_row["id"] if squad_row else None,
                    "squad_name": squad_row["squad_name"] if squad_row else None,
                    "friended_at": str(r["friended_at"])
                })
            return friends
    except Exception as e:
        logger.error(f"Error retrieving friends for user {user_id}: {e}")
        return []


def is_friend(user_id: int, target_user_id: int) -> bool:
    """Checks if target_user_id is in user_id's friend list."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM user_friends WHERE user_id = ? AND friend_id = ? LIMIT 1;", (user_id, target_user_id))
            return cursor.fetchone() is not None
    except Exception:
        return False


def update_user_profile(
    user_id: int,
    full_name: Optional[str] = None,
    stage: Optional[str] = None,
    stream_or_degree: Optional[str] = None,
    target_role: Optional[str] = None,
    bio: Optional[str] = None,
    interests: Optional[List[str]] = None,
    avatar_color: Optional[str] = None,
    avatar_emoji: Optional[str] = None
) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
    """Updates user profile information, stage, bio, and interests."""
    try:
        user = get_user_by_id(user_id)
        if not user:
            return False, "User not found.", None

        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            updates = []
            params = []
            
            if full_name is not None:
                clean_name = full_name.strip()
                if not clean_name:
                    return False, "Full name cannot be empty.", None
                updates.append("full_name = ?")
                params.append(clean_name)
                
            if stage is not None:
                clean_stage = stage.strip()
                if clean_stage in ["12th_pass", "final_year"]:
                    updates.append("stage = ?")
                    params.append(clean_stage)
                    
            if stream_or_degree is not None:
                updates.append("stream_or_degree = ?")
                params.append(stream_or_degree.strip())
                
            if target_role is not None:
                updates.append("target_role = ?")
                params.append(target_role.strip())
                
            if bio is not None:
                updates.append("bio = ?")
                params.append(bio.strip())
                
            if avatar_color is not None and avatar_color.strip():
                updates.append("avatar_color = ?")
                params.append(avatar_color.strip())
                
            if avatar_emoji is not None and avatar_emoji.strip():
                updates.append("avatar_emoji = ?")
                params.append(avatar_emoji.strip())
                
            if updates:
                params.append(user_id)
                query = f"UPDATE users SET {', '.join(updates)} WHERE id = ?;"
                cursor.execute(query, tuple(params))
                
            if interests is not None:
                cleaned_interests = [i.strip() for i in interests if i and i.strip()]
                if cleaned_interests:
                    cursor.execute("DELETE FROM user_interests WHERE user_id = ?;", (user_id,))
                    for item in cleaned_interests:
                        cursor.execute(
                            "INSERT OR IGNORE INTO user_interests (user_id, interest) VALUES (?, ?);", 
                            (user_id, item)
                        )
                        
            conn.commit()
            
        updated = get_user_by_id(user_id)
        return True, "Profile updated successfully.", updated
    except Exception as e:
        logger.error(f"Error updating user profile for user {user_id}: {e}")
        return False, f"Failed to update profile: {str(e)}", None
