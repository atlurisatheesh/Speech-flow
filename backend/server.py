from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from emergentintegrations.llm.openai import OpenAISpeechToText
import tempfile

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

stt = OpenAISpeechToText(api_key=os.getenv("EMERGENT_LLM_KEY"))

class TranscriptionCreate(BaseModel):
    text: str
    language: Optional[str] = None
    duration: Optional[float] = None
    filename: Optional[str] = None

class Transcription(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    original_text: Optional[str] = None
    language: Optional[str] = None
    duration: Optional[float] = None
    filename: Optional[str] = None
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
        
        try:
            with open(temp_path, "rb") as audio_file:
                response = await stt.transcribe(
                    file=audio_file,
                    model="whisper-1",
                    response_format="verbose_json",
                    timestamp_granularities=["segment"]
                )
            
            transcription_obj = Transcription(
                text=response.text,
                original_text=response.text,
                language=response.language if hasattr(response, 'language') else None,
                duration=response.duration if hasattr(response, 'duration') else None,
                filename=file.filename
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

@api_router.delete("/transcriptions/{transcription_id}")
async def delete_transcription(transcription_id: str):
    result = await db.transcriptions.delete_one({"id": transcription_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Transcription not found")
    return {"message": "Transcription deleted successfully"}

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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()