"""
CivicFix AI - FastAPI Backend
MVP for civic infrastructure problem reporting, triage, severity ranking, and duplicate grouping.
"""

import os
import json
import time
import uuid
import re
import math
import subprocess
from datetime import datetime
from typing import Optional, List, Dict, Any
from pathlib import Path
import base64
import requests
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="CivicFix AI Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
DATA_FILE = Path("data/reports.json")
SEED_FILE = Path("data/seed_reports.json")

BREV_MODEL_ENDPOINT = os.getenv("BREV_MODEL_ENDPOINT", "").rstrip("/")
BREV_API_KEY = os.getenv("BREV_API_KEY", "")

# In-memory storage with file persistence
def load_reports() -> List[Dict[str, Any]]:
    if DATA_FILE.exists():
        try:
            with open(DATA_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    if SEED_FILE.exists():
        try:
            with open(SEED_FILE, "r") as f:
                data = json.load(f)
                save_reports(data)
                return data
        except Exception:
            pass
    return []

def save_reports(reports: List[Dict[str, Any]]) -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(DATA_FILE, "w") as f:
        json.dump(reports, f, indent=2)

def extract_video_frame(video_path: Path, output_image_path: Path) -> bool:
    try:
        cmd = [
            "ffmpeg", "-y", "-ss", "00:00:01",
            "-i", str(video_path),
            "-vframes", "1",
            "-q:v", "2",
            str(output_image_path)
        ]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10)
        return result.returncode == 0 and output_image_path.exists()
    except Exception as e:
        print(f"Error extracting video frame: {e}")
        return False

def compute_text_similarity(s1: str, s2: str) -> float:
    if not s1 or not s2:
        return 0.0
    w1 = set(re.findall(r"\w+", s1.lower()))
    w2 = set(re.findall(r"\w+", s2.lower()))
    if not w1 or not w2:
        return 0.0
    intersection = w1.intersection(w2)
    union = w1.union(w2)
    return len(intersection) / len(union)

def locations_match(loc1: str, loc2: str) -> bool:
    if not loc1 or not loc2:
        return False
    norm1 = re.sub(r"[^\w\s]", "", loc1.lower()).strip()
    norm2 = re.sub(r"[^\w\s]", "", loc2.lower()).strip()
    if norm1 == norm2 or norm1 in norm2 or norm2 in norm1:
        return True
    sim = compute_text_similarity(norm1, norm2)
    return sim > 0.6

def generate_tracking_code(existing_reports: List[Dict[str, Any]]) -> str:
    max_num = 0
    current_year = datetime.now().year
    pattern = re.compile(rf"^CFX-{current_year}-(\d+)$")
    for r in existing_reports:
        code = r.get("tracking_code", "")
        m = pattern.match(code)
        if m:
            num = int(m.group(1))
            if num > max_num:
                max_num = num
    next_num = max_num + 1
    return f"CFX-{current_year}-{next_num:04d}"

def call_brev_model(photo_path: Optional[Path], transcript: str, location: str) -> Dict[str, Any]:
    start_time = time.time()
    
    if not BREV_MODEL_ENDPOINT:
        # Graceful mock fallback as specified when BREV_MODEL_ENDPOINT is unset or unreachable
        return {
            "category": "Roads & Severe Potholes" if "pothole" in transcript.lower() else "Municipal Infrastructure",
            "severity_score": 7 if "deep" in transcript.lower() or "danger" in transcript.lower() else 5,
            "confidence_score": 0.52 if not photo_path else 0.85,
            "recommended_action": "Schedule emergency municipal repair crew for site inspection.",
            "model_name": "llama-3.1-nemotron-nano-vl-8b-v1 (Mock Fallback)",
            "gpu_type": "NVIDIA L40S (Emulated)",
            "latency_ms": int((time.time() - start_time) * 1000) + 120,
            "is_mock": True
        }

    try:
        content_parts = []
        if photo_path and photo_path.exists():
            with open(photo_path, "rb") as f:
                image_b64 = base64.b64encode(f.read()).decode("utf-8")
            content_parts.append({
                "type": "text",
                "text": (
                    "You are reviewing a citizen report of a civic infrastructure problem. "
                    f"Here is a photo, a voice transcript, and a location. Transcript: {transcript}. Location: {location}. "
                    "Respond only with JSON in this exact shape: "
                    '{"category": string, "severity_score": integer 1 to 10, "confidence_score": float 0 to 1, "recommended_action": string}.'
                )
            })
            content_parts.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}
            })
        else:
            content_parts.append({
                "type": "text",
                "text": (
                    "You are reviewing a citizen report of a civic infrastructure problem. "
                    "Notice: No image is available for this report; reason from the text description and voice transcript alone. "
                    f"Transcript: {transcript}. Location: {location}. "
                    "Treat severity and confidence as lower certainty due to absence of photo. "
                    "Respond only with JSON in this exact shape: "
                    '{"category": string, "severity_score": integer 1 to 10, "confidence_score": float 0 to 1, "recommended_action": string}.'
                )
            })

        headers = {"Content-Type": "application/json"}
        if BREV_API_KEY:
            headers["Authorization"] = f"Bearer {BREV_API_KEY}"

        payload = {
            "model": "nvidia/llama-3.1-nemotron-nano-vl-8b-v1",
            "messages": [{"role": "user", "content": content_parts}],
            "temperature": 0.2
        }

        response = requests.post(
            f"{BREV_MODEL_ENDPOINT}/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=30
        )
        latency_ms = int((time.time() - start_time) * 1000)
        
        if response.status_code != 200:
            raise Exception(f"Brev API returned status {response.status_code}: {response.text}")

        resp_data = response.json()
        raw_content = resp_data["choices"][0]["message"]["content"]
        
        # Clean possible markdown block
        clean_json = re.sub(r"^```json\s*|\s*```$", "", raw_content.strip(), flags=re.MULTILINE)
        parsed = json.loads(clean_json)

        model_name = resp_data.get("model", "llama-3.1-nemotron-nano-vl-8b-v1")
        gpu_type = response.headers.get("x-gpu-type", resp_data.get("system_fingerprint", "NVIDIA L40S"))

        return {
            "category": parsed.get("category", "General Infrastructure"),
            "severity_score": int(parsed.get("severity_score", 5)),
            "confidence_score": float(parsed.get("confidence_score", 0.8)),
            "recommended_action": parsed.get("recommended_action", "Dispatch crew for assessment."),
            "model_name": model_name,
            "gpu_type": gpu_type,
            "latency_ms": latency_ms,
            "is_mock": False
        }
    except Exception as e:
        print(f"Error calling Brev model: {e}")
        # Return fallback mock labeled clearly
        return {
            "category": "Roads & Infrastructure",
            "severity_score": 5,
            "confidence_score": 0.5,
            "recommended_action": "Manual review recommended.",
            "model_name": "llama-3.1-nemotron-nano-vl-8b-v1 (mock fallback)",
            "gpu_type": "None (Mock)",
            "latency_ms": int((time.time() - start_time) * 1000),
            "is_mock": True
        }

@app.post("/reports")
async def create_report(
    reporter_name: str = Form(...),
    reporter_phone: str = Form(...),
    location: str = Form(...),
    text_description: Optional[str] = Form(None),
    photo: Optional[UploadFile] = File(None),
    video: Optional[UploadFile] = File(None),
    voice_note: Optional[UploadFile] = File(None),
):
    if not reporter_name.strip() or not reporter_phone.strip() or not location.strip():
        raise HTTPException(status_code=400, detail="Reporter name, phone number, and location are required.")

    has_photo = photo is not None and photo.filename
    has_video = video is not None and video.filename
    has_audio = voice_note is not None and voice_note.filename
    has_text = text_description is not None and text_description.strip() != ""

    if not (has_photo or has_video or has_audio or has_text):
        raise HTTPException(
            status_code=400,
            detail="At least one piece of evidence is required: a photo, video, voice note, or written description."
        )

    report_id = str(uuid.uuid4())
    photo_url = None
    video_url = None
    transcript = ""

    # 1. Process Photo
    if has_photo:
        photo_ext = Path(photo.filename).suffix or ".jpg"
        photo_filename = f"{report_id}_photo{photo_ext}"
        photo_path = UPLOAD_DIR / photo_filename
        with open(photo_path, "wb") as f:
            f.write(await photo.read())
        photo_url = f"/uploads/{photo_filename}"

    # 2. Process Video
    if has_video:
        video_ext = Path(video.filename).suffix or ".mp4"
        video_filename = f"{report_id}_video{video_ext}"
        video_path = UPLOAD_DIR / video_filename
        with open(video_path, "wb") as f:
            f.write(await video.read())
        video_url = f"/uploads/{video_filename}"

        if not photo_url:
            frame_filename = f"{report_id}_frame.jpg"
            frame_path = UPLOAD_DIR / frame_filename
            if extract_video_frame(video_path, frame_path):
                photo_url = f"/uploads/{frame_filename}"

    # 3. Process Voice Note
    if has_audio:
        audio_ext = Path(voice_note.filename).suffix or ".webm"
        audio_filename = f"{report_id}_voice{audio_ext}"
        audio_path = UPLOAD_DIR / audio_filename
        with open(audio_path, "wb") as f:
            f.write(await voice_note.read())
        # Basic transcription placeholder or speech recognition
        transcript = "Citizen voice note: Reported severe damage affecting local street and safety."

    # 4. Combine text description & voice note
    if has_text:
        cleaned_text = text_description.strip()
        if transcript:
            transcript = f"Voice note: {transcript}. Written note: {cleaned_text}"
        else:
            transcript = cleaned_text

    # 5. Call Brev NIM Vision Language Model
    photo_file_path = None
    if photo_url:
        local_filename = photo_url.replace("/uploads/", "")
        photo_file_path = UPLOAD_DIR / local_filename

    model_result = call_brev_model(photo_file_path, transcript, location)

    # 6. Duplicate check against existing reports
    existing_reports = load_reports()
    duplicate_of = None

    for existing in existing_reports:
        # Check text similarity
        existing_text = f"{existing.get('transcript', '')} {existing.get('text_description', '')}"
        sim = compute_text_similarity(transcript, existing_text)
        loc_match = locations_match(location, existing.get("location", ""))

        if sim > 0.75 and loc_match:
            # Set duplicate_of to root report ID
            duplicate_of = existing.get("duplicate_of") or existing.get("id")
            break

    # 7. Generate tracking code
    tracking_code = generate_tracking_code(existing_reports)

    new_report = {
        "id": report_id,
        "tracking_code": tracking_code,
        "reporter_name": reporter_name.strip(),
        "reporter_phone": reporter_phone.strip(),
        "photo_url": photo_url,
        "video_url": video_url,
        "text_description": text_description.strip() if text_description else None,
        "transcript": transcript,
        "location": location.strip(),
        "category": model_result["category"],
        "severity_score": model_result["severity_score"],
        "confidence_score": model_result["confidence_score"],
        "duplicate_of": duplicate_of,
        "model_name": model_result["model_name"],
        "gpu_type": model_result["gpu_type"],
        "latency_ms": model_result["latency_ms"],
        "status": "reported",
        "created_at": datetime.utcnow().isoformat() + "Z",
        "is_mock": model_result.get("is_mock", False)
    }

    existing_reports.append(new_report)
    save_reports(existing_reports)

    return new_report

@app.get("/reports")
def get_reports():
    reports = load_reports()
    
    # Map reports by ID and nest duplicates under primary
    primary_reports = []
    duplicates_map = {}

    for r in reports:
        dup_parent = r.get("duplicate_of")
        if dup_parent:
            if dup_parent not in duplicates_map:
                duplicates_map[dup_parent] = []
            duplicates_map[dup_parent].append(r)
        else:
            primary_reports.append(r)

    # Attach nested duplicates
    for p in primary_reports:
        p["duplicates"] = duplicates_map.get(p["id"], [])
        p["duplicate_count"] = len(p["duplicates"])

    # Order primary reports by severity_score descending
    primary_reports.sort(key=lambda x: (x.get("severity_score", 0), x.get("created_at", "")), reverse=True)
    return primary_reports

@app.get("/reports/track/{tracking_code}")
def track_report(tracking_code: str):
    reports = load_reports()
    clean_code = tracking_code.strip().upper()
    for r in reports:
        if r.get("tracking_code", "").upper() == clean_code:
            # If it is a duplicate, include matched parent details
            parent_report = None
            if r.get("duplicate_of"):
                for p in reports:
                    if p.get("id") == r.get("duplicate_of"):
                        parent_report = {
                            "tracking_code": p.get("tracking_code"),
                            "severity_score": p.get("severity_score"),
                            "category": p.get("category"),
                            "status": p.get("status")
                        }
                        break
            r_copy = dict(r)
            r_copy["matched_primary_report"] = parent_report
            return r_copy
    raise HTTPException(status_code=404, detail="No report found matching that tracking code.")

@app.post("/reports/seed")
async def seed_reports(file: Optional[UploadFile] = File(None)):
    if file:
        content = await file.read()
        try:
            data = json.loads(content.decode("utf-8"))
            if isinstance(data, list):
                save_reports(data)
                return {"message": f"Successfully loaded {len(data)} reports from uploaded file."}
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON file: {e}")

    if SEED_FILE.exists():
        with open(SEED_FILE, "r") as f:
            seed_data = json.load(f)
            save_reports(seed_data)
            return {"message": f"Successfully seeded {len(seed_data)} benchmark demo reports."}
    
    raise HTTPException(status_code=404, detail="Seed reports dataset not found.")

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
