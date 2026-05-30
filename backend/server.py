from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Response, BackgroundTasks, Query, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any, cast
import uuid
from datetime import datetime, timezone
from openai import AsyncOpenAI
import tempfile
import requests

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env', override=True)

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
try:
    from mongomock_motor import AsyncMongoMockClient # type: ignore
    client = AsyncMongoMockClient()
    logging.info("Using in-memory MongoMock database for testing!")
except ImportError:
    client = AsyncIOMotorClient(mongo_url)

db = client[os.environ.get('DB_NAME', 'speechflow')]


async def generate_chat_completion(system_message: str, prompt: str, temperature: float = 0.3) -> str:
    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_message},
            {"role": "user", "content": prompt}
        ],
        temperature=temperature
    )
    return response.choices[0].message.content or ""

from contextlib import asynccontextmanager
import asyncio

_watcher_task = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _watcher_task
    try:
        init_storage()
        logging.getLogger(__name__).info("Object storage initialized")
    except Exception as e:
        logging.getLogger(__name__).warning(f"Storage init failed (will retry on use): {e}")
    
    # Create text index for search
    try:
        await db.transcriptions.create_index([("text", "text")])
        logging.getLogger(__name__).info("Text search index created")
    except Exception as e:
        logging.getLogger(__name__).warning(f"Text index creation skipped: {e}")
    
    # Start folder watcher as a background task
    from folder_watcher import watch_folder
    try:
        _watcher_task = asyncio.create_task(
            watch_folder(db, openai_client, put_object_fn=put_object, app_name=APP_NAME)
        )
        logging.getLogger(__name__).info("Folder watcher started")
    except Exception as e:
        logging.getLogger(__name__).warning(f"Folder watcher failed to start: {e}")
        
    yield
    
    if _watcher_task:
        _watcher_task.cancel()
        try:
            await _watcher_task
        except asyncio.CancelledError:
            pass
        except Exception:
            pass
            
    client.close()

app = FastAPI(lifespan=lifespan)

# Add CORS middleware to allow the Electron frontend to fetch history
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")

openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ── WebSocket Connection Manager ──────────────────────────────
import json as json_module

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
    
    async def broadcast(self, message: dict):
        for connection in self.active_connections[:]:
            try:
                await connection.send_json(message)
            except Exception:
                try:
                    self.active_connections.remove(connection)
                except ValueError:
                    pass

ws_manager = ConnectionManager()

@app.websocket("/ws/clipboard")
async def websocket_clipboard(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # Keep connection alive
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)


# Local Audio Storage Configuration
AUDIO_STORAGE_DIR = ROOT_DIR / "audio_storage"
APP_NAME = "speechflow"

MIME_MAP = {
    "mp3": "audio/mpeg", "mp4": "audio/mp4", "mpeg": "audio/mpeg",
    "mpga": "audio/mpeg", "m4a": "audio/mp4", "wav": "audio/wav",
    "webm": "audio/webm"
}

def init_storage():
    os.makedirs(AUDIO_STORAGE_DIR, exist_ok=True)
    return True

def put_object(path: str, data: bytes, content_type: str) -> dict:
    init_storage()
    basename = Path(path).name
    file_path = AUDIO_STORAGE_DIR / basename
    
    with open(file_path, "wb") as f:
        f.write(data)
        
    return {"status": "success", "path": str(file_path)}

def get_object(path: str):
    basename = Path(path).name
    file_path = AUDIO_STORAGE_DIR / basename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found locally")
        
    with open(file_path, "rb") as f:
        content = f.read()
        
    ext = file_path.suffix.lower().lstrip('.')
    content_type = MIME_MAP.get(ext, "application/octet-stream")
    return content, content_type



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
    tone: Optional[str] = None  # professional, casual, technical, creative
    format: Optional[str] = None  # paragraph, bullets, email, code
    context: Optional[str] = None  # additional context hint

class CommandRequest(BaseModel):
    text: str
    instruction: str

class TranslateRequest(BaseModel):
    text: str
    target_language: str
    source_language: Optional[str] = None

class SummarizeRequest(BaseModel):
    text: str
    style: Optional[str] = "meeting_notes"  # meeting_notes, executive, bullets, action_items

class Snippet(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    trigger_phrase: str
    content: str
    category: Optional[str] = "general"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SnippetCreate(BaseModel):
    trigger_phrase: str
    content: str
    category: Optional[str] = "general"

class SnippetUpdate(BaseModel):
    trigger_phrase: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None

class UserSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default="default")
    preferred_language: Optional[str] = "auto"
    default_export_format: Optional[str] = "txt"
    auto_enhance: Optional[bool] = False
    default_tone: Optional[str] = "professional"
    default_format: Optional[str] = "paragraph"
    theme: Optional[str] = "light"
    playback_speed: Optional[float] = 1.0
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BatchJob(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: str = "pending"  # pending, processing, completed, failed
    total_files: int = 0
    completed_files: int = 0
    failed_files: int = 0
    results: List[Dict[str, Any]] = []
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
async def transcribe_file(file: UploadFile = File(...), language: Optional[str] = Query(None, description="Language code (e.g., en, es, fr). Leave empty for auto-detect.")):
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
                if language and language != "auto":
                    response = await openai_client.audio.transcriptions.create(
                        file=audio_file,
                        model="whisper-1",
                        response_format="verbose_json",
                        timestamp_granularities=["segment", "word"],
                        language=language
                    )
                else:
                    response = await openai_client.audio.transcriptions.create(
                        file=audio_file,
                        model="whisper-1",
                        response_format="verbose_json",
                        timestamp_granularities=["segment", "word"]
                    )
            
            segments = []
            if hasattr(response, 'segments') and response.segments:
                for seg in response.segments:
                    segments.append(Segment(
                        start=seg.get('start', 0) if isinstance(seg, dict) else getattr(seg, 'start', 0),
                        end=seg.get('end', 0) if isinstance(seg, dict) else getattr(seg, 'end', 0),
                        text=seg.get('text', '') if isinstance(seg, dict) else getattr(seg, 'text', '')
                    ))
            
            words = []
            if hasattr(response, 'words') and response.words:
                for w in response.words:
                    words.append(Word(
                        start=w.get('start', 0) if isinstance(w, dict) else getattr(w, 'start', 0),
                        end=w.get('end', 0) if isinstance(w, dict) else getattr(w, 'end', 0),
                        word=w.get('word', '') if isinstance(w, dict) else getattr(w, 'word', '')
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
        
        # Build context-aware system prompt based on tone and format
        tone_instructions = {
            "professional": "Use formal, professional language suitable for business communication. Be concise and authoritative.",
            "casual": "Use a friendly, conversational tone. Keep it natural and approachable, like chatting with a colleague.",
            "technical": "Use precise, technical language. Preserve domain-specific terminology and maintain accuracy. Use proper technical formatting.",
            "creative": "Use engaging, expressive language. Make the text compelling and interesting to read.",
        }
        
        format_instructions = {
            "paragraph": "Format the output as well-structured paragraphs with clear topic sentences.",
            "bullets": "Format the output as organized bullet points. Use sub-bullets for details where appropriate.",
            "email": "Format the output as a professional email with appropriate greeting, body paragraphs, and sign-off.",
            "code": "Preserve any code references, use proper formatting for technical terms, and structure content for developer documentation.",
        }
        
        tone = request.tone or "professional"
        fmt = request.format or "paragraph"
        
        system_parts = [
            "You are an expert text editor that improves transcribed speech.",
            "Remove filler words (um, uh, like, you know), fix grammar and punctuation, handle self-corrections (keep only the corrected version), and make sentences clear while maintaining the original meaning.",
        ]
        
        if tone in tone_instructions:
            system_parts.append(f"Tone: {tone_instructions[tone]}")
        if fmt in format_instructions:
            system_parts.append(f"Format: {format_instructions[fmt]}")
        if request.context:
            system_parts.append(f"Additional context: {request.context}")
        
        system_message = " ".join(system_parts)
        
        
        
        prompt = f"""Clean up and enhance this transcribed text:

Original text:
{request.text}

Provide only the cleaned and formatted text without any explanation or preamble."""
        
        cleaned_text = await generate_chat_completion(system_message, prompt, temperature=0.3)
        
        return {
            "processed_text": cleaned_text, 
            "original_text": request.text,
            "tone": tone,
            "format": fmt
        }
    
    except Exception as e:
        logging.error(f"Processing error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

@api_router.get("/transcriptions", response_model=List[Transcription])
async def get_transcriptions(q: Optional[str] = Query(None, description="Search text")):
    query_filter: Dict[str, Any] = {}
    if q and q.strip():
        # Use regex for mongomock compatibility (text indexes not supported in mock)
        import re
        query_filter["text"] = {"$regex": re.escape(q.strip()), "$options": "i"}
    
    transcriptions = await db.transcriptions.find(query_filter, {"_id": 0}).sort("timestamp", -1).to_list(100)
    
    for trans in transcriptions:
        if isinstance(trans['timestamp'], str):
            trans['timestamp'] = datetime.fromisoformat(trans['timestamp'])
    
    return transcriptions

@api_router.get("/analytics")
async def get_analytics():
    """Compute usage analytics from real transcription data."""
    all_trans = await db.transcriptions.find({}, {"_id": 0, "text": 1, "timestamp": 1, "duration": 1}).sort("timestamp", -1).to_list(1000)
    
    now = datetime.now(timezone.utc)
    total_words = 0
    total_duration = 0.0
    daily_words: Dict[str, int] = {}
    dates_with_transcriptions: set = set()
    
    for t in all_trans:
        ts = t.get("timestamp")
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts)
        
        words = len(t.get("text", "").split())
        total_words += words
        
        if t.get("duration"):
            total_duration += t["duration"]
        
        if ts:
            day_key = ts.strftime("%Y-%m-%d")
            daily_words[day_key] = daily_words.get(day_key, 0) + words
            dates_with_transcriptions.add(day_key)
    
    # Calculate streak
    streak = 0
    check_date = now.date()
    while True:
        if check_date.isoformat() in dates_with_transcriptions:
            streak += 1
            from datetime import timedelta
            check_date = check_date - timedelta(days=1)
        else:
            break
    
    # Last 30 days for sparkline
    from datetime import timedelta
    sparkline_data = []
    for i in range(29, -1, -1):
        day = (now.date() - timedelta(days=i)).isoformat()
        sparkline_data.append(daily_words.get(day, 0))
    
    # Average WPM
    avg_wpm = round(total_words / (total_duration / 60)) if total_duration > 0 else 0
    
    return {
        "total_words": total_words,
        "total_transcriptions": len(all_trans),
        "avg_wpm": avg_wpm,
        "streak": streak,
        "daily_words": sparkline_data,
        "total_duration_minutes": round(total_duration / 60, 1),
    }

# ── Voice Profiles CRUD ──────────────────────────────────────

class VoiceProfileCreate(BaseModel):
    name: str
    tone: str = "professional"
    format: str = "paragraph"
    system_prompt: Optional[str] = None
    icon: str = "✨"

class VoiceProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    tone: str = "professional"
    format: str = "paragraph"
    system_prompt: Optional[str] = None
    icon: str = "✨"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

@api_router.get("/voice-profiles")
async def get_voice_profiles():
    profiles = await db.voice_profiles.find({}, {"_id": 0}).to_list(50)
    return profiles

@api_router.post("/voice-profiles")
async def create_voice_profile(profile: VoiceProfileCreate):
    obj = VoiceProfile(
        name=profile.name,
        tone=profile.tone,
        format=profile.format,
        system_prompt=profile.system_prompt,
        icon=profile.icon,
    )
    doc = obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.voice_profiles.insert_one(doc)
    return doc

@api_router.delete("/voice-profiles/{profile_id}")
async def delete_voice_profile(profile_id: str):
    result = await db.voice_profiles.delete_one({"id": profile_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"deleted": True}

@api_router.post("/transcriptions", response_model=Transcription)
async def create_transcription(input: TranscriptionCreate):
    """Save a text-only transcription (no audio upload required).
    Used by the desktop widget and Electron app after local transcription."""
    try:
        transcription_obj = Transcription(
            text=input.text,
            original_text=input.text,
            language=input.language,
            duration=input.duration,
            filename=input.filename,
        )
        doc = transcription_obj.model_dump()
        doc['timestamp'] = doc['timestamp'].isoformat()
        await db.transcriptions.insert_one(doc)
        
        # Broadcast to all connected WebSocket clients for real-time sync
        await ws_manager.broadcast({
            "type": "new_transcription",
            "data": {
                "id": transcription_obj.id,
                "text": transcription_obj.text,
                "timestamp": doc['timestamp'],
            }
        })
        
        return transcription_obj
    except Exception as e:
        logging.error(f"Create transcription error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save transcription: {str(e)}")

class MobileCommandRequest(BaseModel):
    text: str
    session_id: Optional[str] = None

class MobileCommandResponse(BaseModel):
    action: str
    app_name: Optional[str] = None
    speech_response: str

@api_router.post("/mobile/command", response_model=MobileCommandResponse)
async def process_mobile_command(request: MobileCommandRequest):
    """Processes a transcribed command from the mobile app to determine intent."""
    try:
        client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
        system_message = """You are a smart mobile voice assistant.
The user will provide a transcribed voice command.
Determine if the user wants to open a specific application, or if they are just asking a general question/making conversation.
If they want to open an app (e.g., "open spotify", "launch youtube"), set action="open_app" and provide the app_name.
If they are asking a question (e.g., "what is the weather?"), set action="answer_question", leave app_name empty, and provide the answer in speech_response.
Keep speech_response conversational, brief, and suitable for Text-To-Speech."""

        # Build conversation history for multi-turn
        messages = [{"role": "system", "content": system_message}]
        
        if request.session_id:
            # Fetch recent conversation history for this session
            history = await db.conversations.find(
                {"session_id": request.session_id}, {"_id": 0}
            ).sort("timestamp", -1).to_list(10)
            
            # Add in chronological order (oldest first)
            for msg in reversed(history):
                messages.append({"role": "user", "content": msg.get("user_text", "")})
                messages.append({"role": "assistant", "content": msg.get("assistant_text", "")})
        
        messages.append({"role": "user", "content": request.text})

        # Define the function for structured output
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "execute_command",
                    "description": "Execute the user's voice command.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "action": {
                                "type": "string",
                                "enum": ["open_app", "answer_question"],
                                "description": "The determined intent of the user."
                            },
                            "app_name": {
                                "type": "string",
                                "description": "The name of the app to open (e.g. 'youtube', 'spotify', 'calculator'). Null if action is not open_app."
                            },
                            "speech_response": {
                                "type": "string",
                                "description": "The text to speak back to the user."
                            }
                        },
                        "required": ["action", "speech_response"]
                    }
                }
            }
        ]

        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=cast(Any, messages),
            tools=cast(Any, tools),
            tool_choice=cast(Any, {"type": "function", "function": {"name": "execute_command"}})
        )

        tool_calls = response.choices[0].message.tool_calls
        if not tool_calls:
            raise HTTPException(status_code=500, detail="No tool calls returned by AI")
        tool_call = cast(Any, tool_calls[0])
        args = tool_call.function.arguments
        
        import json
        parsed_args = json.loads(args)
        
        result = MobileCommandResponse(
            action=parsed_args.get("action", "answer_question"),
            app_name=parsed_args.get("app_name"),
            speech_response=parsed_args.get("speech_response", "I'm not sure how to help with that.")
        )
        
        # Save conversation turn for multi-turn memory
        if request.session_id:
            await db.conversations.insert_one({
                "session_id": request.session_id,
                "user_text": request.text,
                "assistant_text": result.speech_response,
                "action": result.action,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
        
        return result

    except Exception as e:
        logging.error(f"Mobile command error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process command: {str(e)}")


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
                response = await openai_client.audio.transcriptions.create(
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

@api_router.websocket("/transcribe/stream")
async def websocket_transcribe(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_bytes()
            if len(data) < 1000:
                continue
                
            with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_file:
                temp_file.write(data)
                temp_path = temp_file.name
            
            try:
                with open(temp_path, "rb") as audio_file:
                    response = await openai_client.audio.transcriptions.create(
                        file=audio_file,
                        model="whisper-1",
                        response_format="json"
                    )
                if hasattr(response, 'text') and response.text:
                    await websocket.send_json({"text": response.text})
                elif isinstance(response, dict) and response.get('text'):
                    await websocket.send_json({"text": response.get('text')})
            except Exception as e:
                logging.error(f"WS transcribe error: {e}")
            finally:
                os.unlink(temp_path)
    except WebSocketDisconnect:
        logging.info("WebSocket disconnected")

@api_router.post("/transcribe/diarize")
async def diarize_transcript(request: DiarizeRequest):
    try:
        import json as json_lib
        
        system_message="Speaker diarization. Return ONLY JSON."
        
        # Compact prompt - use indices only, shorter text
        lines = []
        for i, seg in enumerate(request.segments):
            # Truncate long segments to save tokens
            text = seg.text.strip()[:120]
            lines.append(f"{i}: {text}")
        
        prompt = f"""Label each line with speaker (S1, S2, ...). Same speaker if continuous dialogue. JSON only:
[{{{{"i":0,"s":"S1"}}}},...]

{chr(10).join(lines)}"""
        
        response_text = await generate_chat_completion(system_message, prompt, temperature=0.0)
        
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
    if format not in ["srt", "vtt", "txt", "json"]:
        raise HTTPException(status_code=400, detail="Format must be srt, vtt, txt, or json")
    
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
    elif format == "vtt":
        segments = trans.get("segments") or []
        lines = ["WEBVTT", ""]
        for seg in segments:
            speaker = seg.get("speaker", "")
            text = f"{speaker}: {seg['text'].strip()}" if speaker else seg['text'].strip()
            lines.append(f"{format_vtt_time(seg['start'])} --> {format_vtt_time(seg['end'])}\n{text}\n")
        content = "\n".join(lines) if len(lines) > 2 else "WEBVTT\n\n" + trans.get("text", "")
        media_type = "text/vtt"
        ext = "vtt"
    else:  # json
        import json as json_lib
        content = json_lib.dumps(trans, indent=2, default=str)
        media_type = "application/json"
        ext = "json"
    
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

# ==========================================
# COMMAND MODE - AI Edit Selected Text
# ==========================================

@api_router.post("/transcribe/command")
async def command_edit(request: CommandRequest):
    """Apply an AI instruction to selected text (command mode)."""
    try:
        system_message="You are an AI text editor. Apply the user's instruction to the provided text. Return ONLY the modified text without any explanation, preamble, or quotes."
        
        prompt = f"""Apply this instruction to the text below:

Instruction: {request.instruction}

Text:
{request.text}

Return only the modified text."""
        
        result_text = await generate_chat_completion(system_message, prompt, temperature=0.3)
        
        return {
            "result_text": result_text,
            "original_text": request.text,
            "instruction": request.instruction
        }
    
    except Exception as e:
        logging.error(f"Command mode error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Command failed: {str(e)}")

# ==========================================
# SEARCH ACROSS TRANSCRIPTIONS
# ==========================================

@api_router.get("/transcriptions/search")
async def search_transcriptions(q: str = Query(..., min_length=1)):
    """Full-text search across all transcriptions."""
    try:
        import re as re_module
        # Use regex for flexible search (MongoDB text index may not exist)
        pattern = re_module.escape(q)
        results = await db.transcriptions.find(
            {"text": {"$regex": pattern, "$options": "i"}},
            {"_id": 0}
        ).sort("timestamp", -1).to_list(50)
        
        for trans in results:
            if isinstance(trans.get('timestamp'), str):
                trans['timestamp'] = datetime.fromisoformat(trans['timestamp'])
        
        return results
    except Exception as e:
        logging.error(f"Search error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

# ==========================================
# AI SUMMARIZATION
# ==========================================

@api_router.post("/transcribe/summarize")
async def summarize_text(request: SummarizeRequest):
    """Generate AI-powered summaries from transcript text."""
    try:
        style_prompts = {
            "meeting_notes": """Create structured meeting notes from this transcript. Include:
## Summary
A 2-3 sentence overview.

## Key Discussion Points
- Bullet points of main topics discussed.

## Action Items
- [ ] Specific tasks with owners if mentioned.

## Decisions Made
- Key decisions reached.

## Follow-ups
- Items that need follow-up.""",
            "executive": """Create a concise executive summary (3-5 sentences) that captures the essential points, key decisions, and critical action items. Use professional, direct language.""",
            "bullets": """Create a comprehensive bullet-point summary. Organize by topic with main bullets and sub-bullets for details. Be thorough but concise.""",
            "action_items": """Extract ONLY the action items, tasks, and to-dos from this transcript. Format as a checklist:
- [ ] Task description (assigned to: person, if mentioned)
If no action items are found, state that clearly.""",
        }
        
        style = request.style or "meeting_notes"
        style_instruction = style_prompts.get(style, style_prompts["meeting_notes"])
        
        system_message="You are an expert meeting analyst and summarizer. Create clear, well-organized summaries from transcribed text."
        
        prompt = f"""{style_instruction}

Transcript:
{request.text}"""
        
        summary = await generate_chat_completion(system_message, prompt, temperature=0.2)
        
        return {
            "summary": summary,
            "style": style,
            "original_length": len(request.text),
            "summary_length": len(summary)
        }
    
    except Exception as e:
        logging.error(f"Summarization error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")

# ==========================================
# TRANSLATION
# ==========================================

SUPPORTED_LANGUAGES = {
    "en": "English", "es": "Spanish", "fr": "French", "de": "German",
    "it": "Italian", "pt": "Portuguese", "nl": "Dutch", "ru": "Russian",
    "zh": "Chinese", "ja": "Japanese", "ko": "Korean", "ar": "Arabic",
    "hi": "Hindi", "bn": "Bengali", "tr": "Turkish", "pl": "Polish",
    "sv": "Swedish", "da": "Danish", "no": "Norwegian", "fi": "Finnish",
    "cs": "Czech", "ro": "Romanian", "hu": "Hungarian", "el": "Greek",
    "he": "Hebrew", "th": "Thai", "vi": "Vietnamese", "id": "Indonesian",
    "ms": "Malay", "uk": "Ukrainian",
    # Indian languages
    "ta": "Tamil", "te": "Telugu", "mr": "Marathi", "gu": "Gujarati",
    "kn": "Kannada", "ml": "Malayalam", "pa": "Punjabi", "ur": "Urdu",
    "ne": "Nepali", "as": "Assamese", "sa": "Sanskrit", "sd": "Sindhi",
    "si": "Sinhala",
}

@api_router.get("/languages")
async def get_supported_languages():
    """Return supported languages for transcription and translation."""
    return {"languages": SUPPORTED_LANGUAGES}

@api_router.post("/transcribe/translate")
async def translate_text(request: TranslateRequest):
    """Translate transcript text to a target language."""
    try:
        target_name = SUPPORTED_LANGUAGES.get(request.target_language, request.target_language)
        source_name = SUPPORTED_LANGUAGES.get(request.source_language, "the original language") if request.source_language else "the detected language"
        
        system_message=f"You are a professional translator. Translate text from {source_name} to {target_name}. Preserve the original meaning, tone, and formatting. Return ONLY the translated text."
        
        prompt = f"""Translate this text to {target_name}:

{request.text}"""
        
        translated = await generate_chat_completion(system_message, prompt, temperature=0.2)
        
        return {
            "translated_text": translated,
            "original_text": request.text,
            "target_language": request.target_language,
            "target_language_name": target_name
        }
    
    except Exception as e:
        logging.error(f"Translation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")

# ==========================================
# SNIPPET LIBRARY
# ==========================================

@api_router.post("/snippets", response_model=Snippet)
async def create_snippet(input: SnippetCreate):
    """Create a new text snippet with a trigger phrase."""
    import re
    existing = await db.snippets.find_one(
        {"trigger_phrase": {"$regex": f"^{re.escape(input.trigger_phrase)}$", "$options": "i"}},
        {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=400, detail="A snippet with this trigger phrase already exists")
    
    snippet_obj = Snippet(
        trigger_phrase=input.trigger_phrase,
        content=input.content,
        category=input.category
    )
    doc = snippet_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.snippets.insert_one(doc)
    return snippet_obj

@api_router.get("/snippets", response_model=List[Snippet])
async def get_snippets():
    """Get all snippets."""
    snippets = await db.snippets.find({}, {"_id": 0}).sort("trigger_phrase", 1).to_list(500)
    for s in snippets:
        if isinstance(s.get('timestamp'), str):
            s['timestamp'] = datetime.fromisoformat(s['timestamp'])
    return snippets

@api_router.put("/snippets/{snippet_id}", response_model=Snippet)
async def update_snippet(snippet_id: str, update: SnippetUpdate):
    """Update an existing snippet."""
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.snippets.update_one(
        {"id": snippet_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Snippet not found")
    
    updated = await db.snippets.find_one({"id": snippet_id}, {"_id": 0})
    if not updated:
        raise HTTPException(status_code=404, detail="Snippet not found after update")
    if isinstance(updated.get('timestamp'), str):
        updated['timestamp'] = datetime.fromisoformat(updated['timestamp'])
    return Snippet(**updated)

@api_router.delete("/snippets/{snippet_id}")
async def delete_snippet(snippet_id: str):
    """Delete a snippet."""
    result = await db.snippets.delete_one({"id": snippet_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Snippet not found")
    return {"message": "Snippet deleted successfully"}

# ==========================================
# BATCH TRANSCRIPTION
# ==========================================

@api_router.post("/transcribe/batch")
async def batch_transcribe(files: List[UploadFile] = File(...), language: Optional[str] = Query(None)):
    """Transcribe multiple files. Returns a batch job ID for tracking."""
    if len(files) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 files per batch")
    
    batch_job = BatchJob(total_files=len(files))
    doc = batch_job.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.batch_jobs.insert_one(doc)
    
    # Process files sequentially (could be async in production)
    for file in files:
        try:
            file_ext = (file.filename or "audio.webm").split('.')[-1].lower()
            if file_ext not in ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm']:
                batch_job.failed_files += 1
                batch_job.results.append({
                    "filename": file.filename,
                    "status": "failed",
                    "error": f"Unsupported format: {file_ext}"
                })
                continue
            
            content = await file.read()
            with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_ext}") as temp_file:
                temp_file.write(content)
                temp_path = temp_file.name
            
            # Upload to object storage
            audio_path = None
            audio_mime = MIME_MAP.get(file_ext, "audio/mpeg")
            try:
                storage_path = f"{APP_NAME}/audio/{uuid.uuid4()}.{file_ext}"
                put_object(storage_path, content, audio_mime)
                audio_path = storage_path
            except Exception:
                pass
            
            try:
                with open(temp_path, "rb") as audio_file:
                    if language and language != "auto":
                        response = await openai_client.audio.transcriptions.create(
                            file=audio_file,
                            model="whisper-1",
                            response_format="verbose_json",
                            timestamp_granularities=["segment", "word"],
                            language=language
                        )
                    else:
                        response = await openai_client.audio.transcriptions.create(
                            file=audio_file,
                            model="whisper-1",
                            response_format="verbose_json",
                            timestamp_granularities=["segment", "word"]
                        )
                
                segments = []
                if hasattr(response, 'segments') and response.segments:
                    for seg in response.segments:
                        segments.append(Segment(
                            start=seg.get('start', 0) if isinstance(seg, dict) else getattr(seg, 'start', 0),
                            end=seg.get('end', 0) if isinstance(seg, dict) else getattr(seg, 'end', 0),
                            text=seg.get('text', '') if isinstance(seg, dict) else getattr(seg, 'text', '')
                        ))
                
                transcription_obj = Transcription(
                    text=response.text,
                    original_text=response.text,
                    language=response.language if hasattr(response, 'language') else None,
                    duration=response.duration if hasattr(response, 'duration') else None,
                    filename=file.filename,
                    audio_path=audio_path,
                    audio_mime=audio_mime if audio_path else None,
                    segments=[s.model_dump() for s in segments] if segments else None
                )
                
                trans_doc = transcription_obj.model_dump()
                trans_doc['timestamp'] = trans_doc['timestamp'].isoformat()
                await db.transcriptions.insert_one(trans_doc)
                
                batch_job.completed_files += 1
                batch_job.results.append({
                    "filename": file.filename,
                    "status": "completed",
                    "transcription_id": transcription_obj.id,
                    "text_preview": response.text[:100]
                })
            finally:
                os.unlink(temp_path)
        
        except Exception as e:
            batch_job.failed_files += 1
            batch_job.results.append({
                "filename": file.filename or "unknown",
                "status": "failed",
                "error": str(e)
            })
    
    batch_job.status = "completed"
    await db.batch_jobs.update_one(
        {"id": batch_job.id},
        {"$set": {
            "status": batch_job.status,
            "completed_files": batch_job.completed_files,
            "failed_files": batch_job.failed_files,
            "results": batch_job.results
        }}
    )
    
    return batch_job.model_dump()

@api_router.get("/transcribe/batch/{batch_id}")
async def get_batch_status(batch_id: str):
    """Get the status of a batch transcription job."""
    job = await db.batch_jobs.find_one({"id": batch_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Batch job not found")
    return job

# ==========================================
# USER SETTINGS
# ==========================================

@api_router.get("/settings")
async def get_settings():
    """Get user settings."""
    settings = await db.settings.find_one({"id": "default"}, {"_id": 0})
    if not settings:
        return UserSettings().model_dump()
    if isinstance(settings.get('timestamp'), str):
        settings['timestamp'] = datetime.fromisoformat(settings['timestamp'])
    return settings

@api_router.put("/settings")
async def update_settings(settings: UserSettings):
    """Update user settings."""
    doc = settings.model_dump()
    doc['timestamp'] = datetime.now(timezone.utc).isoformat()
    await db.settings.update_one(
        {"id": "default"},
        {"$set": doc},
        upsert=True
    )
    return doc

# ==========================================
# JSON EXPORT
# ==========================================

@api_router.get("/transcriptions/{transcription_id}/export/json")
async def export_json(transcription_id: str):
    """Export transcription as structured JSON."""
    trans = await db.transcriptions.find_one({"id": transcription_id}, {"_id": 0})
    if not trans:
        raise HTTPException(status_code=404, detail="Transcription not found")
    
    import json as json_lib
    content = json_lib.dumps(trans, indent=2, default=str)
    filename = (trans.get("filename") or "transcript").rsplit(".", 1)[0]
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}.json"'}
    )

# ==========================================
# ANALYTICS / STATS
# ==========================================

@api_router.get("/stats")
async def get_stats():
    """Get transcription usage statistics."""
    try:
        total_transcriptions = await db.transcriptions.count_documents({})
        total_snippets = await db.snippets.count_documents({})
        total_dict_words = await db.dictionary.count_documents({})
        
        # Calculate total duration
        pipeline = [
            {"$match": {"duration": {"$exists": True, "$ne": None}}},
            {"$group": {"_id": None, "total_duration": {"$sum": "$duration"}, "avg_duration": {"$avg": "$duration"}}}
        ]
        duration_result = await db.transcriptions.aggregate(pipeline).to_list(1)
        total_duration = duration_result[0]["total_duration"] if duration_result else 0
        avg_duration = duration_result[0]["avg_duration"] if duration_result else 0
        
        # Language distribution
        lang_pipeline = [
            {"$match": {"language": {"$exists": True, "$ne": None}}},
            {"$group": {"_id": "$language", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        languages = await db.transcriptions.aggregate(lang_pipeline).to_list(10)
        
        # Recent activity (last 7 days)
        from datetime import timedelta
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        recent_count = await db.transcriptions.count_documents({
            "timestamp": {"$gte": week_ago}
        })
        
        return {
            "total_transcriptions": total_transcriptions,
            "total_duration_seconds": round(total_duration, 1),
            "total_duration_formatted": f"{int(total_duration // 3600)}h {int((total_duration % 3600) // 60)}m",
            "avg_duration_seconds": round(avg_duration, 1),
            "total_snippets": total_snippets,
            "total_dictionary_words": total_dict_words,
            "language_distribution": {l["_id"]: l["count"] for l in languages},
            "transcriptions_this_week": recent_count,
        }
    except Exception as e:
        logging.error(f"Stats error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Stats failed: {str(e)}")

# ==========================================
# TRANSCRIPTION UPDATE (for in-place editing)
# ==========================================

@api_router.patch("/transcriptions/{transcription_id}")
async def update_transcription(transcription_id: str, update: Dict[str, Any]):
    """Update a transcription's text or segments."""
    allowed_fields = {"text", "segments", "speaker_labels"}
    update_data = {k: v for k, v in update.items() if k in allowed_fields}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid update fields provided")
    
    result = await db.transcriptions.update_one(
        {"id": transcription_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Transcription not found")
    
    return {"message": "Transcription updated", "updated_fields": list(update_data.keys())}

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=1993)

