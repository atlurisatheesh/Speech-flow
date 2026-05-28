from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone
from emergentintegrations.llm.openai import OpenAISpeechToText
import tempfile
import requests

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

stt = OpenAISpeechToText(api_key=os.getenv("EMERGENT_LLM_KEY"))

# Object Storage Configuration
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "speechflow"
storage_key = None

def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
        resp.raise_for_status()
        storage_key = resp.json()["storage_key"]
        return storage_key
    except Exception as e:
        logging.error(f"Storage init failed: {e}")
        return None

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Storage not available")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120
    )
    if resp.status_code == 403:
        # Re-init and retry once
        global storage_key
        storage_key = None
        key = init_storage()
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=120
        )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str):
    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Storage not available")
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60
    )
    if resp.status_code == 403:
        global storage_key
        storage_key = None
        key = init_storage()
        resp = requests.get(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key}, timeout=60
        )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

MIME_MAP = {
    "mp3": "audio/mpeg", "mp4": "audio/mp4", "mpeg": "audio/mpeg",
    "mpga": "audio/mpeg", "m4a": "audio/mp4", "wav": "audio/wav",
    "webm": "audio/webm"
}

class TranscriptionCreate(BaseModel):
    text: str
    language: Optional[str] = None
    duration: Optional[float] = None
    filename: Optional[str] = None

class Segment(BaseModel):
    start: float
    end: float
    text: str
    speaker: Optional[str] = None

class Word(BaseModel):
    start: float
    end: float
    word: str

class Transcription(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    original_text: Optional[str] = None
    language: Optional[str] = None
    duration: Optional[float] = None
    filename: Optional[str] = None
    audio_path: Optional[str] = None
    audio_mime: Optional[str] = None
    segments: Optional[List[Segment]] = None
    words: Optional[List[Word]] = None
    speaker_labels: Optional[Dict[str, str]] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DictionaryWord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    word: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DictionaryWordCreate(BaseModel):
    word: str

class ProcessTextRequest(BaseModel):
    text: str

class DiarizeRequest(BaseModel):
    segments: List[Segment]

def format_srt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds - int(seconds)) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

def format_vtt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds - int(seconds)) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"

@api_router.get("/")
async def root():
    return {"message": "Speech-to-Text Pro API"}

@api_router.post("/transcribe/file", response_model=Transcription)
async def transcribe_file(file: UploadFile = File(...)):
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")
        
        file_ext = file.filename.split('.')[-1].lower()
        if file_ext not in ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm']:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format: {file_ext}. Supported: mp3, mp4, mpeg, mpga, m4a, wav, webm"
            )
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_ext}") as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = temp_file.name
        
        # Upload to object storage
        audio_path = None
        audio_mime = MIME_MAP.get(file_ext, "audio/mpeg")
        try:
            storage_path = f"{APP_NAME}/audio/{uuid.uuid4()}.{file_ext}"
            put_object(storage_path, content, audio_mime)
            audio_path = storage_path
        except Exception as storage_err:
            logging.warning(f"Audio storage failed (continuing without): {storage_err}")
        
        try:
            with open(temp_path, "rb") as audio_file:
                response = await stt.transcribe(
                    file=audio_file,
                    model="whisper-1",
                    response_format="verbose_json",
                    timestamp_granularities=["segment", "word"]
                )
            
            segments = []
            if hasattr(response, 'segments') and response.segments:
                for seg in response.segments:
                    segments.append(Segment(
                        start=seg.start if hasattr(seg, 'start') else seg.get('start', 0),
                        end=seg.end if hasattr(seg, 'end') else seg.get('end', 0),
                        text=seg.text if hasattr(seg, 'text') else seg.get('text', '')
                    ))
            
            words = []
            if hasattr(response, 'words') and response.words:
                for w in response.words:
                    words.append(Word(
                        start=w.start if hasattr(w, 'start') else w.get('start', 0),
                        end=w.end if hasattr(w, 'end') else w.get('end', 0),
                        word=w.word if hasattr(w, 'word') else w.get('word', '')
                    ))
            
            transcription_obj = Transcription(
                text=response.text,
                original_text=response.text,
                language=response.language if hasattr(response, 'language') else None,
                duration=response.duration if hasattr(response, 'duration') else None,
                filename=file.filename,
                audio_path=audio_path,
                audio_mime=audio_mime if audio_path else None,
                segments=segments if segments else None,
                words=words if words else None
            )
            
            doc = transcription_obj.model_dump()
            doc['timestamp'] = doc['timestamp'].isoformat()
            await db.transcriptions.insert_one(doc)
            
            return transcription_obj
        finally:
            os.unlink(temp_path)
    
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Transcription error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

@api_router.post("/transcribe/process")
async def process_text(request: ProcessTextRequest):
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        chat = LlmChat(
            api_key=os.getenv("EMERGENT_LLM_KEY"),
            session_id=str(uuid.uuid4()),
            system_message="You are a text editor that improves transcribed speech by removing filler words, fixing grammar and punctuation, and making sentences clear and professional while maintaining the original meaning."
        ).with_model("openai", "gpt-4o-mini").with_params(temperature=0.3)
        
        prompt = f"""Clean up this transcribed text:

Original text:
{request.text}

Provide only the cleaned text without any explanation."""
        
        response = await chat.send_message(
            UserMessage(text=prompt)
        )
        
        cleaned_text = response if isinstance(response, str) else response.message.text
        
        return {"processed_text": cleaned_text, "original_text": request.text}
    
    except Exception as e:
        logging.error(f"Processing error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

@api_router.get("/transcriptions", response_model=List[Transcription])
async def get_transcriptions():
    transcriptions = await db.transcriptions.find({}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    
    for trans in transcriptions:
        if isinstance(trans['timestamp'], str):
            trans['timestamp'] = datetime.fromisoformat(trans['timestamp'])
    
    return transcriptions

@api_router.get("/transcriptions/{transcription_id}/audio")
async def get_audio(transcription_id: str):
    trans = await db.transcriptions.find_one({"id": transcription_id}, {"_id": 0})
    if not trans:
        raise HTTPException(status_code=404, detail="Transcription not found")
    if not trans.get("audio_path"):
        raise HTTPException(status_code=404, detail="No audio available for this transcription")
    
    try:
        data, content_type = get_object(trans["audio_path"])
        return Response(
            content=data,
            media_type=trans.get("audio_mime") or content_type or "audio/mpeg",
            headers={"Cache-Control": "public, max-age=31536000"}
        )
    except Exception as e:
        logging.error(f"Audio fetch error: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve audio")

class SpeakerLabelsUpdate(BaseModel):
    speaker_labels: Dict[str, str]

@api_router.patch("/transcriptions/{transcription_id}/speakers")
async def update_speaker_labels(transcription_id: str, update: SpeakerLabelsUpdate):
    result = await db.transcriptions.update_one(
        {"id": transcription_id},
        {"$set": {"speaker_labels": update.speaker_labels}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Transcription not found")
    return {"message": "Speaker labels updated", "speaker_labels": update.speaker_labels}

@api_router.post("/transcribe/chunk")
async def transcribe_chunk(file: UploadFile = File(...)):
    """Transcribe a small audio chunk for streaming/live transcription. Does not save to DB."""
    try:
        file_ext = (file.filename or "chunk.webm").split('.')[-1].lower()
        if file_ext not in ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm']:
            file_ext = 'webm'
        
        content = await file.read()
        if len(content) < 1000:
            return {"text": ""}
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_ext}") as temp_file:
            temp_file.write(content)
            temp_path = temp_file.name
        
        try:
            with open(temp_path, "rb") as audio_file:
                response = await stt.transcribe(
                    file=audio_file,
                    model="whisper-1",
                    response_format="json"
                )
            return {"text": response.text}
        finally:
            os.unlink(temp_path)
    
    except Exception as e:
        logging.error(f"Chunk transcribe error: {str(e)}")
        return {"text": "", "error": str(e)}

@api_router.delete("/transcriptions/{transcription_id}")
async def delete_transcription(transcription_id: str):
    result = await db.transcriptions.delete_one({"id": transcription_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Transcription not found")
    return {"message": "Transcription deleted successfully"}

@api_router.post("/transcribe/diarize")
async def diarize_transcript(request: DiarizeRequest):
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        import json as json_lib
        
        chat = LlmChat(
            api_key=os.getenv("EMERGENT_LLM_KEY"),
            session_id=str(uuid.uuid4()),
            system_message="Speaker diarization. Return ONLY JSON."
        ).with_model("openai", "gpt-4o-mini").with_params(temperature=0.0)
        
        # Compact prompt - use indices only, shorter text
        lines = []
        for i, seg in enumerate(request.segments):
            # Truncate long segments to save tokens
            text = seg.text.strip()[:120]
            lines.append(f"{i}: {text}")
        
        prompt = f"""Label each line with speaker (S1, S2, ...). Same speaker if continuous dialogue. JSON only:
[{{"i":0,"s":"S1"}},...]

{chr(10).join(lines)}"""
        
        response = await chat.send_message(UserMessage(text=prompt))
        response_text = response if isinstance(response, str) else response.message.text
        
        # Extract JSON
        response_text = response_text.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
            response_text = response_text.strip()
        
        try:
            speaker_assignments = json_lib.loads(response_text)
        except json_lib.JSONDecodeError:
            # Fallback - try to find JSON array in response
            import re as re_module
            match = re_module.search(r'\[.*\]', response_text, re_module.DOTALL)
            if match:
                speaker_assignments = json_lib.loads(match.group(0))
            else:
                raise HTTPException(status_code=500, detail="Could not parse speaker assignments")
        
        # Build speaker map - handle both compact (i/s) and full (index/speaker) formats
        speaker_map = {}
        for item in speaker_assignments:
            idx = item.get("i", item.get("index"))
            speaker_label = item.get("s", item.get("speaker", "Speaker 1"))
            # Normalize S1 -> Speaker 1
            if speaker_label.startswith("S") and speaker_label[1:].isdigit():
                speaker_label = f"Speaker {speaker_label[1:]}"
            speaker_map[idx] = speaker_label
        
        result_segments = []
        for i, seg in enumerate(request.segments):
            result_segments.append({
                "start": seg.start,
                "end": seg.end,
                "text": seg.text,
                "speaker": speaker_map.get(i, "Speaker 1")
            })
        
        return {"segments": result_segments}
    
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Diarization error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Diarization failed: {str(e)}")

@api_router.get("/transcriptions/{transcription_id}/export/{format}")
async def export_transcript(transcription_id: str, format: str):
    if format not in ["srt", "vtt", "txt"]:
        raise HTTPException(status_code=400, detail="Format must be srt, vtt, or txt")
    
    trans = await db.transcriptions.find_one({"id": transcription_id}, {"_id": 0})
    if not trans:
        raise HTTPException(status_code=404, detail="Transcription not found")
    
    from fastapi.responses import Response
    
    if format == "txt":
        content = trans.get("text", "")
        media_type = "text/plain"
        ext = "txt"
    elif format == "srt":
        segments = trans.get("segments") or []
        lines = []
        for i, seg in enumerate(segments, 1):
            speaker = seg.get("speaker", "")
            text = f"{speaker}: {seg['text'].strip()}" if speaker else seg['text'].strip()
            lines.append(f"{i}\n{format_srt_time(seg['start'])} --> {format_srt_time(seg['end'])}\n{text}\n")
        content = "\n".join(lines) if lines else trans.get("text", "")
        media_type = "text/plain"
        ext = "srt"
    else:  # vtt
        segments = trans.get("segments") or []
        lines = ["WEBVTT", ""]
        for seg in segments:
            speaker = seg.get("speaker", "")
            text = f"{speaker}: {seg['text'].strip()}" if speaker else seg['text'].strip()
            lines.append(f"{format_vtt_time(seg['start'])} --> {format_vtt_time(seg['end'])}\n{text}\n")
        content = "\n".join(lines) if len(lines) > 2 else "WEBVTT\n\n" + trans.get("text", "")
        media_type = "text/vtt"
        ext = "vtt"
    
    filename = (trans.get("filename") or "transcript").rsplit(".", 1)[0]
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}.{ext}"'}
    )

@api_router.post("/dictionary", response_model=DictionaryWord)
async def add_dictionary_word(input: DictionaryWordCreate):
    import re
    existing = await db.dictionary.find_one(
        {"word": {"$regex": f"^{re.escape(input.word)}$", "$options": "i"}}, 
        {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Word already exists in dictionary")
    
    word_obj = DictionaryWord(word=input.word)
    doc = word_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    await db.dictionary.insert_one(doc)
    return word_obj

@api_router.get("/dictionary", response_model=List[DictionaryWord])
async def get_dictionary_words():
    words = await db.dictionary.find({}, {"_id": 0}).sort("word", 1).to_list(1000)
    
    for word in words:
        if isinstance(word['timestamp'], str):
            word['timestamp'] = datetime.fromisoformat(word['timestamp'])
    
    return words

@api_router.delete("/dictionary/{word_id}")
async def delete_dictionary_word(word_id: str):
    result = await db.dictionary.delete_one({"id": word_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Word not found")
    return {"message": "Word deleted successfully"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    try:
        init_storage()
        logger.info("Object storage initialized")
    except Exception as e:
        logger.warning(f"Storage init failed (will retry on use): {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()