"""
Folder Watcher — Automatically transcribes audio files dropped into a watched directory.

Uses the `watchfiles` library (already in requirements.txt) to monitor `./watch_folder`.
When a new audio file is detected, it is automatically sent through the same
transcription pipeline used by the /transcribe/file endpoint and saved to MongoDB.
"""

import os
import asyncio
import logging
import uuid
import tempfile
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

WATCH_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "watch_folder")
AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".ogg", ".flac", ".webm", ".mp4", ".mpeg", ".mpga"}
PROCESSED_DIR = os.path.join(WATCH_DIR, "_processed")

# Track files we've already processed to avoid duplicates
_processed_files = set()


def ensure_watch_dirs():
    """Create the watch and processed directories if they don't exist."""
    os.makedirs(WATCH_DIR, exist_ok=True)
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    logger.info(f"Watch folder ready: {WATCH_DIR}")


async def transcribe_file(filepath: str, db, openai_client, put_object_fn=None, app_name="speech-flow"):
    """
    Transcribe a single audio file and save the result to MongoDB.
    Uses the same STT object and pipeline as the main /transcribe/file endpoint.
    """
    filename = os.path.basename(filepath)
    file_ext = Path(filepath).suffix.lower()

    if file_ext not in AUDIO_EXTENSIONS:
        return

    if filepath in _processed_files:
        return

    _processed_files.add(filepath)
    logger.info(f"Auto-transcribing: {filename}")

    try:
        with open(filepath, "rb") as f:
            content = f.read()

        # Write to a temp file for STT
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        # Upload to object storage if available
        audio_path = None
        mime_map = {
            ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4",
            ".ogg": "audio/ogg", ".flac": "audio/flac", ".webm": "audio/webm",
            ".mp4": "audio/mp4", ".mpeg": "audio/mpeg", ".mpga": "audio/mpeg",
        }
        audio_mime = mime_map.get(file_ext, "audio/mpeg")
        if put_object_fn:
            try:
                storage_path = f"{app_name}/audio/{uuid.uuid4()}{file_ext}"
                put_object_fn(storage_path, content, audio_mime)
                audio_path = storage_path
            except Exception as storage_err:
                logger.warning(f"Audio storage failed (continuing without): {storage_err}")

        try:
            with open(tmp_path, "rb") as audio_file:
                response = await openai_client.audio.transcriptions.create(
                    file=audio_file,
                    model="whisper-1",
                    response_format="verbose_json",
                    timestamp_granularities=["segment"]
                )

            text = response.text
            segments = []
            if hasattr(response, "segments") and response.segments:
                for seg in response.segments:
                    segments.append({
                        "start": seg.start if hasattr(seg, "start") else seg.get("start", 0),
                        "end": seg.end if hasattr(seg, "end") else seg.get("end", 0),
                        "text": seg.text if hasattr(seg, "text") else seg.get("text", ""),
                    })

            language = getattr(response, "language", "en")
            duration = getattr(response, "duration", None)

        finally:
            os.unlink(tmp_path)

        # Save to MongoDB
        transcription_id = str(uuid.uuid4())
        transcription = {
            "id": transcription_id,
            "filename": filename,
            "text": text,
            "original_text": text,
            "segments": segments if segments else None,
            "language": language,
            "duration": duration,
            "audio_path": audio_path,
            "audio_mime": audio_mime if audio_path else None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source": "auto_watch",
        }

        await db.transcriptions.insert_one(transcription)
        logger.info(f"Auto-transcribed: {filename} -> {transcription_id}")

        # Move original file to _processed
        processed_path = os.path.join(PROCESSED_DIR, filename)
        if os.path.exists(processed_path):
            processed_path = os.path.join(
                PROCESSED_DIR,
                f"{Path(filename).stem}_{transcription_id[:8]}{file_ext}"
            )
        os.rename(filepath, processed_path)
        logger.info(f"Moved to processed: {processed_path}")

    except Exception as e:
        logger.error(f"Auto-transcription failed for {filename}: {str(e)}")
        _processed_files.discard(filepath)


async def watch_folder(db, openai_client, put_object_fn=None, app_name="speech-flow"):
    """
    Watch the folder for new audio files and transcribe them automatically.
    Runs as a background task within the FastAPI server.
    """
    ensure_watch_dirs()

    try:
        from watchfiles import awatch, Change

        logger.info(f"Watching for audio files in: {WATCH_DIR}")

        async for changes in awatch(WATCH_DIR):
            for change_type, filepath in changes:
                if change_type in (Change.added, Change.modified):
                    # Skip files in the _processed subdirectory
                    if PROCESSED_DIR in filepath:
                        continue

                    file_ext = Path(filepath).suffix.lower()
                    if file_ext in AUDIO_EXTENSIONS:
                        # Small delay to ensure file is fully written
                        await asyncio.sleep(1)
                        if os.path.exists(filepath):
                            await transcribe_file(filepath, db, openai_client, put_object_fn, app_name)

    except ImportError:
        logger.warning("watchfiles not installed. Falling back to polling mode.")
        await _poll_watch_folder(db, openai_client, put_object_fn, app_name)
    except asyncio.CancelledError:
        logger.info("Folder watcher stopped.")
    except Exception as e:
        logger.error(f"Folder watcher error: {str(e)}")


async def _poll_watch_folder(db, openai_client, put_object_fn=None, app_name="speech-flow", interval=5):
    """Fallback polling-based watcher if watchfiles is not available."""
    ensure_watch_dirs()
    logger.info(f"Polling for audio files in: {WATCH_DIR} (every {interval}s)")

    while True:
        try:
            for entry in os.scandir(WATCH_DIR):
                if entry.is_file():
                    file_ext = Path(entry.name).suffix.lower()
                    if file_ext in AUDIO_EXTENSIONS and entry.path not in _processed_files:
                        await transcribe_file(entry.path, db, openai_client, put_object_fn, app_name)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Polling error: {str(e)}")

        await asyncio.sleep(interval)
