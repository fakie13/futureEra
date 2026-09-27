import json
import os
import re
import sqlite3
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

        # 3. Create search indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_blueprints_lookup ON career_blueprints(lookup_key);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_blueprints_role ON career_blueprints(target_role);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_blueprints_stream ON career_blueprints(stream);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_suggestions_lookup ON profession_suggestions(lookup_key);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_suggestions_stream ON profession_suggestions(stream);")
        
        # 4. Seed initial rich blueprints and suggestions if tables are empty
        seed_initial_data_if_empty(conn)
        
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
    """Returns database telemetry and count of stored blueprints and suggestions."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) AS total FROM career_blueprints;")
            b_count = cursor.fetchone()["total"]
            cursor.execute("SELECT COUNT(*) AS total FROM profession_suggestions;")
            s_count = cursor.fetchone()["total"]
            return {
                "status": "healthy",
                "database_path": DB_PATH,
                "total_blueprints_cached": b_count,
                "total_suggestions_cached": s_count
            }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "database_path": DB_PATH
        }


