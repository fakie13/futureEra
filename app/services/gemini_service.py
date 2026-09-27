import json
import re
from typing import Dict, Any, Optional
from google import genai
from google.genai import types
from app.config import GEMINI_API_KEY
from app.services.prompts import (
    SYSTEM_PROMPT, 
    build_user_prompt, 
    SYSTEM_PROMPT_SUGGESTIONS, 
    build_suggest_professions_prompt
)


def extract_clean_json(text: str) -> Dict[str, Any]:
    """Helper to extract and parse JSON from model output even if wrapped in markdown codeblocks."""
    text = text.strip()
    # Check for markdown codeblocks
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        raw_json = match.group(1).strip()
    else:
        raw_json = text
    
    parsed = json.loads(raw_json)
    return normalize_blueprint_data(parsed)


def normalize_blueprint_data(parsed: dict) -> dict:
    if not isinstance(parsed, dict):
        return parsed
    
    if not parsed.get("is_valid", True):
        return parsed
        
    timeline = parsed.get("timeline_roadmap")
    if isinstance(timeline, list):
        for item in timeline:
            if isinstance(item, dict):
                cap = item.get("capstone_project")
                if isinstance(cap, str):
                    item["capstone_project"] = {
                        "title": "Applied Capstone Project",
                        "description": cap,
                        "tech_stack": item.get("skills_to_acquire", []),
                        "key_engineering_challenges": [],
                        "portfolio_outcome": "Production Repository & Live System Demo"
                    }
                elif isinstance(cap, dict):
                    cap.setdefault("title", "Applied Capstone System")
                    cap.setdefault("description", "")
                    cap.setdefault("tech_stack", [])
                    cap.setdefault("key_engineering_challenges", [])
                    cap.setdefault("portfolio_outcome", "Production GitHub Repository")
                elif not cap and item.get("action_project"):
                    item["capstone_project"] = {
                        "title": "Applied Production Project",
                        "description": str(item.get("action_project")),
                        "tech_stack": item.get("skills_to_acquire", []),
                        "key_engineering_challenges": [],
                        "portfolio_outcome": "Portfolio Showcase"
                    }
                
                if not item.get("action_project") and isinstance(item.get("capstone_project"), dict):
                    item["action_project"] = item["capstone_project"].get("title", "") + ": " + item["capstone_project"].get("description", "")
                    
    return parsed


async def generate_career_blueprint(data: dict, client_api_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Calls Gemini API using google-genai SDK to generate future-proof career analysis and roadmap.
    Prioritizes client_api_key if provided, otherwise uses server GEMINI_API_KEY.
    """
    api_key = (client_api_key or GEMINI_API_KEY or "").strip()
    if not api_key:
        raise ValueError("Missing Gemini API Key. Please provide a key in your .env file or directly in the application.")

    client = genai.Client(api_key=api_key)
    user_prompt = build_user_prompt(data)

    # List candidate models in order of availability and speed
    candidate_models = [
        "gemini-3-flash-preview",
        "gemini-3.1-flash-lite",
        "gemini-3.8-flash",
        "gemini-flash-latest",
        "gemini-3.5-flash",
        "gemini-pro-latest"
    ]
    last_exception = None

    for model_name in candidate_models:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    temperature=0.7,
                )
            )
            if response.text:
                return extract_clean_json(response.text)
        except Exception as e:
            last_exception = e
            # If model name failed, try next candidate
            continue

    if last_exception:
        raise RuntimeError(f"Gemini API request failed: {str(last_exception)}")
    
    raise RuntimeError("Failed to receive a valid response from Gemini API.")


def get_curated_fallback_suggestions(stream: str, interests: str) -> list:
    s_lower = (stream or "").lower()
    i_lower = (interests or "").lower()

    if "pcb" in s_lower or "bio" in i_lower or "health" in i_lower or "medicine" in i_lower:
        return [
            {
                "id": "bioinformatics_specialist",
                "title": "Bioinformatics & Genomic Data Scientist",
                "match_score": "98% Match",
                "recommended_degrees": ["B.Tech Biotechnology", "B.Sc Bioinformatics / Computational Biology", "B.Sc Genetics"],
                "why_it_fits": "Blends biological sciences with modern computational data pipelines and genetic sequencing algorithms.",
                "market_outlook": "High Growth • 29% Projected Healthcare Tech Expansion",
                "salary_range": "₹7 - ₹16 LPA ($80k - $125k Global)",
                "key_skills": ["Python for Biology", "Genomic Sequencing Tools", "Biostatistics", "Molecular Modeling"]
            },
            {
                "id": "biomedical_engineer",
                "title": "Biomedical Systems & Medical Device Engineer",
                "match_score": "95% Match",
                "recommended_degrees": ["B.Tech Biomedical Engineering", "B.Tech Electronics & Instrumentation", "B.Sc Health Tech"],
                "why_it_fits": "Combines life sciences with hospital-grade hardware, diagnostic sensors, and embedded instrumentation.",
                "market_outlook": "High Demand • Surging Smart Medical Device Ecosystem",
                "salary_range": "₹6 - ₹14 LPA ($75k - $115k Global)",
                "key_skills": ["Biosensors", "Signal Processing", "Embedded C/C++", "FDA Regulatory Compliance"]
            },
            {
                "id": "healthcare_ai_specialist",
                "title": "Healthcare AI & Clinical Informatics Architect",
                "match_score": "92% Match",
                "recommended_degrees": ["B.Tech Computer Science (Health Informatics)", "B.Sc Data Science", "BCA + M.Sc Health Tech"],
                "why_it_fits": "Leverages medical data, patient outcome analysis, and computer vision for automated medical imaging diagnostics.",
                "market_outlook": "Explosive Growth • Modern Hospitals Adopting AI Triage",
                "salary_range": "₹9 - ₹20 LPA ($95k - $140k Global)",
                "key_skills": ["Medical Imaging CNNs", "EHR Standards (HL7/FHIR)", "HIPAA Compliance", "Python"]
            },
            {
                "id": "pharma_tech_analyst",
                "title": "Pharmaceutical Technology & Drug Discovery Analyst",
                "match_score": "89% Match",
                "recommended_degrees": ["B.Pharm", "B.Sc Chemistry / Biochemistry", "B.Tech Chemical Engineering"],
                "why_it_fits": "Applies molecular discovery models and automated bio-assays to accelerate drug synthesis and clinical trials.",
                "market_outlook": "Stable High-Value • Critical Global Pharmaceutical R&D",
                "salary_range": "₹6.5 - ₹15 LPA ($75k - $110k Global)",
                "key_skills": ["Molecular Dynamics", "Chemoinformatics", "Laboratory Automation", "Clinical Trial Protocol"]
            },
            {
                "id": "public_health_data_architect",
                "title": "Epidemiology & Public Health Intelligence Specialist",
                "match_score": "86% Match",
                "recommended_degrees": ["B.Sc Statistics / Data Science", "B.Sc Public Health", "B.Tech Biotechnology"],
                "why_it_fits": "Focuses on global disease patterns, population health modeling, and predictive healthcare analytics.",
                "market_outlook": "High Public & NGO Demand • Global Health Surveillance",
                "salary_range": "₹6 - ₹13 LPA ($70k - $105k Global)",
                "key_skills": ["Epidemiological Modeling", "R & Python", "GIS Spatial Mapping", "Survey Data Pipelines"]
            }
        ]
    elif "commerce" in s_lower or "finan" in i_lower or "market" in i_lower:
        return [
            {
                "id": "fintech_systems_architect",
                "title": "FinTech Systems & Payments Infrastructure Architect",
                "match_score": "98% Match",
                "recommended_degrees": ["B.Tech Computer Science / IT", "BCA + MCA", "B.Com + Tech Certification"],
                "why_it_fits": "Combines financial transaction models with ultra-reliable banking ledgers, UPI systems, and payment gateways.",
                "market_outlook": "Massive Growth • High Transaction Volumes Globally",
                "salary_range": "₹9 - ₹22 LPA ($90k - $145k Global)",
                "key_skills": ["Distributed Ledgers", "Microservices & Kafka", "PCI-DSS Security", "Database ACID Transactions"]
            },
            {
                "id": "quant_risk_analyst",
                "title": "Quantitative Financial Analyst & Risk Modeler",
                "match_score": "96% Match",
                "recommended_degrees": ["B.Sc Mathematics & Computing", "B.Sc Statistics / Data Science", "B.Com (Honours) + CFA"],
                "why_it_fits": "Direct synergy with mathematics and commerce logic to forecast market volatility and derivative strategies.",
                "market_outlook": "Top-Tier Prestige • High Compensation Ceiling in Investment Banks",
                "salary_range": "₹12 - ₹30+ LPA ($120k - $190k Global)",
                "key_skills": ["Financial Econometrics", "Python / R", "Monte Carlo Simulations", "Stochastic Calculus"]
            },
            {
                "id": "business_intelligence_architect",
                "title": "Business Intelligence & Revenue Operations Architect",
                "match_score": "93% Match",
                "recommended_degrees": ["BBA (Analytics)", "B.Com / B.Sc Data Analytics", "BCA"],
                "why_it_fits": "Bridges corporate financial balance sheets with automated SQL data pipelines and executive KPI intelligence.",
                "market_outlook": "High Demand • Every Scaled Enterprise Requires RevOps",
                "salary_range": "₹7 - ₹16 LPA ($80k - $115k Global)",
                "key_skills": ["Advanced SQL & dbt", "Tableau / PowerBI", "Financial Accounting", "Data Warehousing (Snowflake)"]
            },
            {
                "id": "corporate_investment_strategist",
                "title": "Corporate Finance & M&A Strategy Analyst",
                "match_score": "90% Match",
                "recommended_degrees": ["B.Com (Honours)", "BBA Finance", "Integrated BBA-MBA"],
                "why_it_fits": "Leverages commerce principles to value acquisitions, manage corporate balance sheets, and raise venture capital.",
                "market_outlook": "High Prestige • Private Equity & Investment Banking Focus",
                "salary_range": "₹8 - ₹20 LPA ($85k - $130k Global)",
                "key_skills": ["Financial Modeling (DCF/LBO)", "Corporate Valuation", "Capital Structure", "Pitch Deck Strategy"]
            },
            {
                "id": "blockchain_defi_developer",
                "title": "Decentralized Finance (DeFi) & Web3 Protocol Developer",
                "match_score": "87% Match",
                "recommended_degrees": ["B.Tech Computer Science", "BCA + MCA", "B.Sc Information Technology"],
                "why_it_fits": "Integrates financial mechanics with smart contract architecture, cryptographic verification, and tokenomics.",
                "market_outlook": "Specialized High-Yield • Institutional Tokenization Surge",
                "salary_range": "₹10 - ₹24 LPA ($100k - $160k Global)",
                "key_skills": ["Solidity / Rust", "Smart Contract Auditing", "Cryptographic Primitives", "Automated Market Makers"]
            }
        ]
    elif "humanities" in s_lower or "art" in s_lower or "design" in i_lower or "law" in i_lower or "ui" in i_lower:
        return [
            {
                "id": "ui_ux_design_architect",
                "title": "UI/UX & Digital Product Design Architect",
                "match_score": "98% Match",
                "recommended_degrees": ["B.Des (Interaction / Product Design)", "B.Sc Multimedia / Design", "BCA"],
                "why_it_fits": "Unites human psychology, visual aesthetics, and user journey mapping into intuitive digital software experiences.",
                "market_outlook": "Very High Demand • AI Tools Require Human-Centered Design",
                "salary_range": "₹7 - ₹18 LPA ($80k - $130k Global)",
                "key_skills": ["Figma & Design Systems", "User Research & Usability", "Information Architecture", "Design-to-Code Workflows"]
            },
            {
                "id": "ai_ethics_policy_strategist",
                "title": "AI Ethics, Technology Policy & Tech Law Specialist",
                "match_score": "94% Match",
                "recommended_degrees": ["B.A. LL.B (Tech Law)", "B.A. Public Policy / Political Science", "B.A. Philosophy & Tech"],
                "why_it_fits": "Essential for guiding governments and tech giants through AI compliance, intellectual property, and data privacy legislation.",
                "market_outlook": "Exploding Strategic Value • EU AI Act & Global Tech Regulations",
                "salary_range": "₹8 - ₹19 LPA ($85k - $135k Global)",
                "key_skills": ["Global Tech Regulatory Frameworks", "Data Privacy (GDPR/DPDP)", "Algorithmic Bias Auditing", "Legal Drafting"]
            },
            {
                "id": "creative_technology_director",
                "title": "Creative Technologist & Interactive Media Developer",
                "match_score": "91% Match",
                "recommended_degrees": ["B.Des / B.A. Digital Media", "B.Sc Game Design & Animation", "BCA"],
                "why_it_fits": "Connects storytelling, 3D visualization, virtual reality, and generative audio-visual media.",
                "market_outlook": "High Demand in Gaming, Entertainment & Immersive Brand Labs",
                "salary_range": "₹6.5 - ₹16 LPA ($75k - $120k Global)",
                "key_skills": ["Three.js / WebGL", "Generative Creative Tools", "3D Shaders (Blender)", "Interactive Storytelling"]
            },
            {
                "id": "product_management_analyst",
                "title": "Associate Product Manager (APM) & User Strategy",
                "match_score": "88% Match",
                "recommended_degrees": ["B.A. Economics / Psychology", "BBA", "B.Des Product Design"],
                "why_it_fits": "Translates human behavioral insights into product roadmaps, user retention loops, and software features.",
                "market_outlook": "Prestigious Career Track • Direct Line to Executive Product Leadership",
                "salary_range": "₹9 - ₹21 LPA ($90k - $140k Global)",
                "key_skills": ["Product Discovery", "A/B Testing & Metrics", "Stakeholder Alignment", "Agile Roadmap Strategy"]
            },
            {
                "id": "content_systems_architect",
                "title": "Content Intelligence & Narrative Systems Architect",
                "match_score": "85% Match",
                "recommended_degrees": ["B.A. English / Mass Communication", "B.A. Journalism & Media", "B.Sc Visual Communication"],
                "why_it_fits": "Directs brand voice, enterprise knowledge graphs, and editorial strategy powered by modern AI publishing workflows.",
                "market_outlook": "Steady High Demand • Enterprises Needing Authentic Human Voice",
                "salary_range": "₹5.5 - ₹13 LPA ($65k - $100k Global)",
                "key_skills": ["Information Architecture", "Content Strategy & SEO", "Knowledge Management", "AI Content Workflows"]
            }
        ]
    elif "robot" in i_lower or "hardware" in i_lower or "vocational" in s_lower:
        return [
            {
                "id": "robotics_systems_engineer",
                "title": "Robotics & Autonomous Systems Software Engineer",
                "match_score": "98% Match",
                "recommended_degrees": ["B.Tech Robotics & Automation", "B.Tech Mechatronics", "B.Tech Mechanical / ECE"],
                "why_it_fits": "Combines physical mechanics, motor actuation, sensor fusion, and real-time control algorithms.",
                "market_outlook": "Rapid Expansion • Industrial Automation & Warehousing Robotics",
                "salary_range": "₹8 - ₹19 LPA ($85k - $135k Global)",
                "key_skills": ["ROS 2 (Robot Operating System)", "C++ & Python", "Sensor Fusion (LiDAR/IMU)", "Kinematics & Control"]
            },
            {
                "id": "iot_embedded_architect",
                "title": "IoT & Edge Embedded Systems Architect",
                "match_score": "95% Match",
                "recommended_degrees": ["B.Tech Electronics & Communication (ECE)", "B.Tech Electrical & Electronics", "B.Sc Electronics"],
                "why_it_fits": "Bridges microcontrollers (ARM, ESP32, STM32) with wireless protocols, sensor telemetry, and cloud edge nodes.",
                "market_outlook": "High Demand • Smart Cities, Automotive & Industrial IoT",
                "salary_range": "₹7 - ₹17 LPA ($80k - $125k Global)",
                "key_skills": ["Embedded C / Rust", "RTOS & Memory Constraints", "MQTT / BLE / LoRaWAN", "Hardware Debugging"]
            },
            {
                "id": "ev_powertrain_engineer",
                "title": "Electric Vehicle (EV) Systems & Battery Tech Engineer",
                "match_score": "92% Match",
                "recommended_degrees": ["B.Tech Electrical Engineering", "B.Tech Mechanical / Automobile", "B.Tech Mechatronics"],
                "why_it_fits": "Focuses on battery management systems (BMS), regenerative braking, motor controllers, and thermal dissipation.",
                "market_outlook": "Clean Energy Boom • Global Transition to Electromobility",
                "salary_range": "₹7.5 - ₹18 LPA ($80k - $130k Global)",
                "key_skills": ["Battery Management Systems (BMS)", "CAN Bus Protocols", "Thermal Simulation", "Power Electronics"]
            },
            {
                "id": "industrial_automation_engineer",
                "title": "Smart Factory & Industrial Automation Specialist",
                "match_score": "89% Match",
                "recommended_degrees": ["B.Tech Instrumentation & Control", "B.Tech Mechanical", "Polytechnic / Advanced Diploma"],
                "why_it_fits": "Automates manufacturing assembly lines using programmable logic controllers (PLCs), SCADA, and computer vision inspection.",
                "market_outlook": "Essential Core • Manufacturing Supply Chain Modernization",
                "salary_range": "₹6 - ₹14 LPA ($70k - $110k Global)",
                "key_skills": ["PLC Programming (Siemens/Allen-Bradley)", "SCADA / HMI Systems", "Industrial Networking", "Pneumatics"]
            },
            {
                "id": "drone_aerospace_systems_engineer",
                "title": "UAV Drone Systems & Avionics Flight Software Engineer",
                "match_score": "86% Match",
                "recommended_degrees": ["B.Tech Aerospace / Aeronautical", "B.Tech ECE", "B.Tech Mechatronics"],
                "why_it_fits": "Develops autonomous drone flight stacks, computer vision obstacle avoidance, and telemetry communication.",
                "market_outlook": "Booming Commercial Sector • Defense, Agriculture & Logistics Drones",
                "salary_range": "₹8 - ₹18 LPA ($85k - $125k Global)",
                "key_skills": ["PX4 / ArduPilot Flight Stacks", "Computer Vision (OpenCV)", "RF Telemetry", "Aerodynamics & Propulsions"]
            }
        ]
    else:
        # Default / PCM / Coding & Tech
        return [
            {
                "id": "ai_ml_engineer",
                "title": "AI & Machine Learning Systems Architect",
                "match_score": "98% Match",
                "recommended_degrees": ["B.Tech Computer Science & AI", "B.Tech CSE", "B.Sc Data Science & AI"],
                "why_it_fits": "Leverages advanced mathematical foundations from PCM with neural network design, model fine-tuning, and scalable inference.",
                "market_outlook": "Peak Market Growth • Every Global Industry Deploying GenAI & Agents",
                "salary_range": "₹9 - ₹24 LPA ($95k - $160k Global)",
                "key_skills": ["PyTorch & Transformers", "LLM Fine-tuning & RAG", "Vector Databases", "MLOps & Cloud Serving"]
            },
            {
                "id": "full_stack_cloud_engineer",
                "title": "Full Stack Cloud & Distributed Systems Engineer",
                "match_score": "96% Match",
                "recommended_degrees": ["B.Tech Computer Science & Engineering", "BCA + MCA", "B.Sc Information Technology"],
                "why_it_fits": "Directly transforms programming passion into high-performance web systems, resilient backend APIs, and modern frontend interfaces.",
                "market_outlook": "Consistently High Demand • Essential for Tech Companies Worldwide",
                "salary_range": "₹8 - ₹18 LPA ($85k - $135k Global)",
                "key_skills": ["TypeScript & Python", "PostgreSQL & Redis", "Docker & Kubernetes", "Modern Next.js & React"]
            },
            {
                "id": "cloud_devops_architect",
                "title": "Cloud Infrastructure & Platform DevOps Architect",
                "match_score": "94% Match",
                "recommended_degrees": ["B.Tech CSE / IT", "BCA + Cloud Certifications", "B.Sc Computer Science"],
                "why_it_fits": "High leverage on systems design, automation scripts, automated deployment pipelines, and global cloud networks.",
                "market_outlook": "High ROI • Enterprises Moving Entire Workloads to Hybrid Cloud",
                "salary_range": "₹9 - ₹21 LPA ($90k - $145k Global)",
                "key_skills": ["Terraform & Infrastructure as Code", "Kubernetes Orchestration", "AWS / GCP Solutions", "CI/CD & Observability"]
            },
            {
                "id": "cybersecurity_engineer",
                "title": "Cybersecurity & Zero-Trust Defense Engineer",
                "match_score": "91% Match",
                "recommended_degrees": ["B.Tech Information Security", "B.Tech Computer Science", "B.Sc Cybersecurity"],
                "why_it_fits": "Combines network protocols, operating systems, and cryptography to protect mission-critical enterprise systems.",
                "market_outlook": "Critical Shortage • High Job Security & Enterprise Demand",
                "salary_range": "₹8 - ₹19 LPA ($85k - $135k Global)",
                "key_skills": ["Penetration Testing", "Network Cryptography", "Threat Intelligence & SIEM", "Cloud Security Posture"]
            },
            {
                "id": "data_platform_architect",
                "title": "Big Data Platform & Distributed Analytics Engineer",
                "match_score": "88% Match",
                "recommended_degrees": ["B.Tech CSE / Data Engineering", "B.Sc Mathematics & Computing", "BCA + MCA"],
                "why_it_fits": "Handles billions of data records daily using distributed storage engines and real-time streaming pipelines.",
                "market_outlook": "High Demand • Data Is the Core Asset for Modern Decision Making",
                "salary_range": "₹8.5 - ₹20 LPA ($90k - $140k Global)",
                "key_skills": ["Apache Spark & Kafka", "Distributed SQL", "Data Lakes (Delta Lake)", "Data Modeling Internals"]
            }
        ]


async def suggest_eligible_professions(data: dict, client_api_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Analyzes student stream and favorite subjects/interests to return multiple eligible professions.
    """
    stream = data.get("stream", "PCM")
    interests = data.get("interests", "Technology")
    degree_years = data.get("degree_years", 4)
    
    api_key = (client_api_key or GEMINI_API_KEY or "").strip()
    
    # If no API key configured, use instant high-quality curated suggestions
    if not api_key:
        fallback_list = get_curated_fallback_suggestions(stream, interests)
        return {
            "is_valid": True,
            "stream": stream,
            "interests": interests,
            "suggestions": fallback_list
        }

    client = genai.Client(api_key=api_key)
    user_prompt = build_suggest_professions_prompt(stream, interests, degree_years)

    candidate_models = [
        "gemini-3-flash-preview",
        "gemini-3.1-flash-lite",
        "gemini-3.8-flash",
        "gemini-flash-latest",
        "gemini-3.5-flash",
        "gemini-pro-latest"
    ]

    for model_name in candidate_models:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT_SUGGESTIONS,
                    response_mime_type="application/json",
                    temperature=0.7,
                )
            )
            if response.text:
                parsed = extract_clean_json(response.text)
                if isinstance(parsed, dict) and parsed.get("is_valid") is False:
                    return parsed
                if isinstance(parsed, dict) and "suggestions" in parsed and len(parsed["suggestions"]) > 0:
                    parsed["stream"] = stream
                    parsed["interests"] = interests
                    return parsed
        except Exception:
            continue

    # Fallback if AI models were unreachable or rate-limited
    fallback_list = get_curated_fallback_suggestions(stream, interests)
    return {
        "is_valid": True,
        "stream": stream,
        "interests": interests,
        "suggestions": fallback_list
    }

