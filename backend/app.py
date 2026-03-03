from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from pydantic import BaseModel
import pdfplumber
import shutil
import os
import re
import uuid
import json
import logging
from retrieval import MedicalRetriever

# ==========================
# CONFIGURATION
# ==========================

SECRET_KEY = "supersecretkey123"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

retriever = MedicalRetriever()

app = FastAPI(title="Smart Medical AI Backend")

# ==========================
# CORS
# ==========================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=".*",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================
# DATABASE (In-Memory Demo)
# ==========================

users_db = {}
family_profiles_db = {}
health_trends_db = {}
user_trends = {}

# ==========================
# MODELS
# ==========================

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str

class LoginRequest(BaseModel):
    email: str
    password: str

class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    user_name: str

class PersonalizedPlanRequest(BaseModel):
    analysis: dict
    health_score: int
    risk_flags: dict

class ChatRequest(BaseModel):
    message: str
    analysis: dict
    health_score: int

class SaveTrendRequest(BaseModel):
    user_email: str
    analysis: dict
    health_score: int
    date: str

class VoiceQueryRequest(BaseModel):
    query: str
    analysis: dict

class LocalizationRequest(BaseModel):
    language: str
    analysis: dict
    health_score: int

# ==========================
# AUTH FUNCTIONS
# ==========================

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if email not in users_db:
            raise HTTPException(status_code=401, detail="Invalid token")
        return email
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==========================
# AUTH ROUTES
# ==========================

@app.post("/register", response_model=AuthResponse)
def register(req: RegisterRequest):
    if req.email in users_db:
        raise HTTPException(status_code=400, detail="User exists")
    hashed = pwd_context.hash(req.password)
    users_db[req.email] = {
        "password": hashed,
        "name": req.name
    }
    token = create_access_token({"sub": req.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_name": req.name
    }

@app.post("/login", response_model=AuthResponse)
def login(req: LoginRequest):
    if req.email not in users_db:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    user = users_db[req.email]
    if not pwd_context.verify(req.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": req.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_name": user["name"]
    }

# ==========================
# MEDICAL ANALYSIS
# ==========================

normal_ranges = {
    "Hemoglobin": (13, 17),
    "LDL Cholesterol": (0, 130),
    "Glucose": (70, 140),
    "HDL Cholesterol": (40, 60),
    "Triglycerides": (0, 150),
}

def clean_text(text):
    return [line.strip() for line in text.split("\n") if line.strip()]

def extract_medical_values(lines):
    values = {}
    for line in lines:
        match = re.search(r"([A-Za-z ]+):?\s*([\d.]+)", line)
        if match:
            test = match.group(1).strip()
            value = float(match.group(2))
            values[test] = value
    return values

def analyze_values(values):
    analysis = {}
    for test, value in values.items():
        if test in normal_ranges:
            low, high = normal_ranges[test]
            if value < low:
                status = "Low"
            elif value > high:
                status = "High"
            else:
                status = "Normal"
            analysis[test] = {"value": value, "status": status}
    return analysis

def calculate_health_score(analysis):
    score = 100
    for test, data in analysis.items():
        if data["status"] != "Normal":
            score -= 15
    return max(score, 0)

def infer_risk_type(analysis, health_score):
    high_markers = {name for name, item in analysis.items() if item.get("status") == "High"}
    low_markers = {name for name, item in analysis.items() if item.get("status") == "Low"}
    if "Glucose" in high_markers:
        return "metabolic"
    if "LDL Cholesterol" in high_markers or "Triglycerides" in high_markers:
        return "cardiovascular"
    if "Hemoglobin" in low_markers:
        return "hematology"
    if health_score <= 55:
        return "high_general"
    if health_score <= 80:
        return "moderate_general"
    return "low_general"

def build_preventive_plan(analysis, health_score):
    risk_type = infer_risk_type(analysis, health_score)
    baseline_plan = {
        "risk_type": risk_type,
        "diet_suggestions": [
            "Use a high-fiber plate model: 1/2 vegetables, 1/4 lean protein, 1/4 whole grains",
            "Avoid sugar-sweetened beverages and limit processed snacks",
            "Hydrate with 2-3 liters of water daily unless fluid-restricted by your clinician",
        ],
        "exercise_plan": [
            "Brisk walking 30 minutes, 5 days/week",
            "Strength training 2 days/week using bodyweight or light resistance",
            "Mobility/stretching 10 minutes daily",
        ],
        "lifestyle_advice": [
            "Sleep 7-8 hours nightly on a consistent schedule",
            "Practice 10 minutes/day stress management (breathing, meditation, or journaling)",
            "Avoid tobacco and keep alcohol intake minimal",
        ],
        "action_plan_30_days": [
            "Week 1: Start food logging and complete at least 4 exercise sessions",
            "Week 2: Replace two processed meals with home-cooked balanced meals",
            "Week 3: Add one extra strength session and review symptom changes",
            "Week 4: Repeat key labs and review progress with your doctor",
        ],
        "tests_to_repeat": ["Blood glucose", "Lipid panel", "CBC (if advised)"],
        "recheck_timeline": "4 weeks",
    }

    if risk_type == "metabolic":
        baseline_plan["diet_suggestions"] = [
            "Prioritize low-glycemic foods: legumes, oats, non-starchy vegetables",
            "Pair carbohydrates with protein or healthy fats to reduce glucose spikes",
            "Limit sweets, refined flour, and late-night heavy meals",
        ]
        baseline_plan["exercise_plan"] = [
            "Walk 10-15 minutes after each major meal",
            "Accumulate 150-180 minutes/week moderate cardio",
            "Resistance training 3 days/week focusing on large muscle groups",
        ]
        baseline_plan["lifestyle_advice"] = [
            "Track fasting glucose weekly if home monitoring is available",
            "Keep meal timing regular and avoid prolonged inactivity",
            "Manage stress to reduce cortisol-driven glucose elevation",
        ]
        baseline_plan["action_plan_30_days"] = [
            "Week 1: Remove sugary drinks and start post-meal walks",
            "Week 2: Follow low-glycemic meal prep for at least 5 days",
            "Week 3: Add 2 resistance sessions and review glucose trend",
            "Week 4: Repeat fasting glucose/HbA1c discussion with your clinician",
        ]
        baseline_plan["tests_to_repeat"] = ["Fasting glucose", "HbA1c", "Triglycerides"]
    elif risk_type == "cardiovascular":
        baseline_plan["diet_suggestions"] = [
            "Adopt a DASH/Mediterranean pattern with vegetables, pulses, nuts, and fish",
            "Reduce saturated fats, fried foods, and trans-fat containing snacks",
            "Keep sodium intake low by minimizing packaged/processed foods",
        ]
        baseline_plan["exercise_plan"] = [
            "Moderate cardio 30-40 minutes, 5 days/week",
            "Add 1-2 interval sessions weekly if tolerated",
            "Strength training 2-3 days/week",
        ]
        baseline_plan["lifestyle_advice"] = [
            "Monitor blood pressure at home 2-3 times/week",
            "Target healthy weight reduction if overweight",
            "Maintain regular sleep and avoid nicotine exposure",
        ]
        baseline_plan["action_plan_30_days"] = [
            "Week 1: Reduce sodium and remove fried foods",
            "Week 2: Complete 150+ minutes cardio across the week",
            "Week 3: Add fish/plant protein for 4+ meals",
            "Week 4: Repeat lipid profile and review risk markers",
        ]
        baseline_plan["tests_to_repeat"] = ["Lipid panel", "Blood pressure log review", "hs-CRP (if advised)"]
    elif risk_type == "hematology":
        baseline_plan["diet_suggestions"] = [
            "Increase iron-rich foods: lentils, beans, leafy greens, lean meats",
            "Pair iron foods with vitamin C sources (citrus, amla, bell pepper)",
            "Avoid tea/coffee around iron-rich meals",
        ]
        baseline_plan["exercise_plan"] = [
            "Start with low-impact exercise: 20-30 minutes walking, 5 days/week",
            "Gradually increase intensity as energy improves",
            "Include breathing and mobility drills to support stamina",
        ]
        baseline_plan["lifestyle_advice"] = [
            "Do not self-start supplements without clinician guidance",
            "Track fatigue, breathlessness, and palpitations",
            "Prioritize recovery sleep and hydration",
        ]
        baseline_plan["action_plan_30_days"] = [
            "Week 1: Start iron-supportive diet and symptom tracking",
            "Week 2: Maintain steady low-impact activity and hydration",
            "Week 3: Review compliance and energy improvement",
            "Week 4: Repeat CBC/iron studies as advised by your doctor",
        ]
        baseline_plan["tests_to_repeat"] = ["CBC", "Ferritin", "Iron profile"]
    return baseline_plan

def build_quick_summary(analysis, score):
    if not analysis:
        return "No measurable lab values were extracted from this report. Please upload a clear PDF with standard test labels."
    high = [name for name, item in analysis.items() if item["status"] == "High"]
    low = [name for name, item in analysis.items() if item["status"] == "Low"]
    normal_count = sum(1 for item in analysis.values() if item["status"] == "Normal")
    findings = []
    if high:
        findings.append(f"Elevated markers: {', '.join(high)}.")
    if low:
        findings.append(f"Low markers: {', '.join(low)}.")
    if normal_count > 0:
        findings.append(f"{normal_count} marker(s) are within normal range.")
    if score >= 85:
        risk_line = "Overall profile appears stable."
    elif score >= 65:
        risk_line = "Overall profile shows mild-to-moderate imbalance. Lifestyle correction and monitoring are advised."
    else:
        risk_line = "Overall profile indicates significant imbalance. Clinical follow-up is recommended."
    follow_up = "Recheck abnormal markers in 2-4 weeks and consult your physician for final interpretation."
    return " ".join(findings + [f"Health score: {score}%.", risk_line, follow_up])

# ==========================
# ROUTES
# ==========================

@app.get("/")
def home():
    return {"message": "Smart Medical AI Backend Running ✅"}

@app.post("/upload-report")
async def upload_report(file: UploadFile = File(...), user=Depends(get_current_user)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF allowed")
    filename = f"temp_{uuid.uuid4()}.pdf"
    try:
        with open(filename, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        extracted_text = ""
        with pdfplumber.open(filename) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    extracted_text += text + "\n"
        os.remove(filename)
        cleaned = clean_text(extracted_text)
        values = extract_medical_values(cleaned)
        analysis = analyze_values(values)
        score = calculate_health_score(analysis)
        return {
            "values": values,
            "analysis": analysis,
            "health_score": score,
            "explanation": build_quick_summary(analysis, score)
        }
    except Exception as e:
        logger.error(str(e))
        raise HTTPException(status_code=500, detail="Processing failed")

@app.post("/personalized-plan")
def personalized_plan(req: PersonalizedPlanRequest, user=Depends(get_current_user)):
    plan = build_preventive_plan(req.analysis or {}, req.health_score)
    return {"personalized_plan": plan}

@app.post("/chat-report")
def chat_report(req: ChatRequest, user=Depends(get_current_user)):
    context = retriever.retrieve(req.message)
    response = "Based on your report and medical knowledge: "
    msg_lower = req.message.lower()
    if "glucose" in msg_lower or "sugar" in msg_lower:
        response += "Your glucose levels suggest monitoring your carbohydrate intake. "
    elif "cholesterol" in msg_lower or "fat" in msg_lower:
        response += "Focus on heart-healthy fats and fiber to manage cholesterol. "
    else:
        response += "I've analyzed your question against your lab results. Please consult your physician for specific clinical advice. "
    if context:
        response += f"\n\nReference info: {context[0][:200]}..."
    return {"response": response}

@app.post("/voice-query")
def voice_query(req: VoiceQueryRequest, user=Depends(get_current_user)):
    # Standard logic for voice, reusing chat logic
    res = chat_report(ChatRequest(message=req.query, analysis=req.analysis, health_score=0), user)
    return {"response": res["response"]}

@app.post("/emergency-alert")
def emergency_alert(req: ChatRequest, user=Depends(get_current_user)):
    alerts = {"critical": [], "warning": []}
    for test, data in req.analysis.items():
        if data["status"] == "High":
            alerts["warning"].append({
                "test": test,
                "message": f"{test} is high. Consult doctor."
            })
    return alerts

@app.post("/family/save-profile")
def save_family(req: SaveTrendRequest, user=Depends(get_current_user)):
    if user not in family_profiles_db:
        family_profiles_db[user] = []
    family_profiles_db[user].append(req.dict())
    return {"status": "Saved"}

@app.get("/family/get-profiles/{email}")
def get_family(email: str, user=Depends(get_current_user)):
    return {"profiles": family_profiles_db.get(email, [])}

@app.post("/trends/save")
def save_trend(req: SaveTrendRequest, user=Depends(get_current_user)):
    if req.user_email not in health_trends_db:
        health_trends_db[req.user_email] = []
    health_trends_db[req.user_email].append(req.dict())
    return {"status": "Trend saved"}

@app.get("/trends/get/{email}")
def get_trends(email: str, user=Depends(get_current_user)):
    trends = health_trends_db.get(email, [])
    scores = [t["health_score"] for t in trends]
    return {
        "trends": trends,
        "average_score": sum(scores)/len(scores) if scores else 0,
        "latest_score": scores[-1] if scores else 0
    }

@app.post("/localize")
def localize(req: LocalizationRequest, user=Depends(get_current_user)):
    return {
        "language": req.language,
        "health_score_label": "Localized Health Score",
        "localized_analysis": req.analysis,
        "personalization_message": "Personalized message in " + req.language,
        "dietary_preferences": ["Vegetarian", "Vegan"],
        "exercise_preferences": ["Yoga", "Walking"]
    }

# ==========================
# SERVER START
# ==========================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
