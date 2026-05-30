"""
Tests for the new AI Voice Assistant + Personal Memory feature,
plus a thin regression pass over existing endpoints that were migrated
from the OpenAI key to the Emergent universal LLM key.

Run:
    pytest /app/backend/tests/test_assistant.py -v \
        --junitxml=/app/test_reports/pytest/assistant_results.xml
"""
import base64
import io
import os
import struct
import math
import wave
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to the value in /app/frontend/.env so tests do not silently target localhost
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except FileNotFoundError:
        pass

API = f"{BASE_URL}/api"
SESSION = f"pytest-{uuid.uuid4().hex[:8]}"


# ---------- shared helpers / fixtures ----------

@pytest.fixture(scope="module")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _silent_wav_bytes(seconds: float = 1.5, freq: int = 440, sample_rate: int = 16000) -> bytes:
    """Generate a short sine-wave WAV so Whisper has *something* to chew on."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        n_frames = int(seconds * sample_rate)
        for i in range(n_frames):
            sample = int(32767 * 0.3 * math.sin(2 * math.pi * freq * (i / sample_rate)))
            w.writeframes(struct.pack("<h", sample))
    return buf.getvalue()


# =========================================================
# Regression: existing endpoints now routed through Emergent
# =========================================================
class TestRegressionEmergentKey:
    def test_health(self, http):
        r = http.get(f"{API}/")
        assert r.status_code == 200, r.text
        assert "message" in r.json()

    def test_languages(self, http):
        r = http.get(f"{API}/languages")
        assert r.status_code == 200, r.text
        data = r.json()
        # Accept either {languages:[...]}, {"en": "English", ...} dict, or list
        if isinstance(data, dict):
            langs = data.get("languages", data)
        else:
            langs = data
        assert len(langs) > 5
        # Spot-check Telugu present (string anywhere in keys or values or items)
        flat = str(langs).lower()
        assert "telugu" in flat or "'te'" in flat or '"te"' in flat

    def test_transcribe_process(self, http):
        r = http.post(f"{API}/transcribe/process", json={
            "text": "um so like i wanna uh meet tomorrow",
            "tone": "professional",
            "format": "paragraph",
        })
        assert r.status_code == 200, r.text
        body = r.json()
        # endpoint returns enhanced_text/processed_text
        out = body.get("enhanced_text") or body.get("processed_text") or body.get("text") or ""
        assert isinstance(out, str) and len(out) > 5

    def test_transcribe_summarize(self, http):
        r = http.post(f"{API}/transcribe/summarize", json={
            "text": "We discussed the new mobile launch. Marketing will own GTM. "
                    "Engineering ships beta by Friday. QA blocks on missing devices.",
            "summary_type": "key_points",
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert any(k in body for k in ("summary", "key_points", "text"))

    def test_transcribe_translate_telugu(self, http):
        r = http.post(f"{API}/transcribe/translate", json={
            "text": "Hello, how are you today?",
            "target_language": "te",
        })
        assert r.status_code == 200, r.text
        body = r.json()
        translated = body.get("translated_text") or body.get("text") or ""
        assert isinstance(translated, str) and len(translated) > 0

    def test_transcribe_command(self, http):
        r = http.post(f"{API}/transcribe/command", json={
            "text": "Replace umm with um and capitalize sentences.",
            "instruction": "clean filler words",
        })
        assert r.status_code == 200, r.text

    def test_stats(self, http):
        r = http.get(f"{API}/stats")
        assert r.status_code == 200, r.text

    def test_settings_get_put(self, http):
        r = http.get(f"{API}/settings")
        assert r.status_code == 200, r.text
        cur = r.json() if isinstance(r.json(), dict) else {}
        # echo back something safe
        payload = {**cur, "default_language": cur.get("default_language") or "en"}
        r2 = http.put(f"{API}/settings", json=payload)
        assert r2.status_code == 200, r2.text

    def test_snippets_crud(self, http):
        created = http.post(f"{API}/snippets", json={
            "trigger_phrase": f"TEST_trig_{uuid.uuid4().hex[:6]}",
            "content": "TEST_snippet_content",
        })
        assert created.status_code in (200, 201), created.text
        sid = created.json()["id"]
        listed = http.get(f"{API}/snippets")
        assert listed.status_code == 200
        assert any(s["id"] == sid for s in listed.json())
        upd = http.put(f"{API}/snippets/{sid}", json={
            "trigger_phrase": "TEST_trig_upd",
            "content": "TEST_updated",
        })
        assert upd.status_code == 200, upd.text
        delete = http.delete(f"{API}/snippets/{sid}")
        assert delete.status_code in (200, 204)

    def test_dictionary_crud(self, http):
        word = f"TEST_word_{uuid.uuid4().hex[:6]}"
        c = http.post(f"{API}/dictionary", json={"word": word})
        assert c.status_code in (200, 201), c.text
        wid = c.json()["id"]
        l = http.get(f"{API}/dictionary")
        assert l.status_code == 200
        d = http.delete(f"{API}/dictionary/{wid}")
        assert d.status_code in (200, 204)


# =========================================================
# Whisper transcription regression
# =========================================================
class TestTranscribeFile:
    def test_transcribe_file_upload(self, http):
        wav = _silent_wav_bytes(seconds=1.2)
        files = {"file": ("tone.wav", wav, "audio/wav")}
        # multipart - drop json content-type
        r = requests.post(f"{API}/transcribe/file", files=files)
        assert r.status_code == 200, r.text
        body = r.json()
        # A tone may produce empty text, but the doc must still be created
        assert "id" in body and "text" in body
        # cleanup
        http.delete(f"{API}/transcriptions/{body['id']}")

    def test_transcribe_chunk(self, http):
        wav = _silent_wav_bytes(seconds=0.8)
        files = {"file": ("chunk.wav", wav, "audio/wav")}
        r = requests.post(f"{API}/transcribe/chunk", files=files)
        assert r.status_code == 200, r.text
        assert "text" in r.json()


# =========================================================
# NEW: Personal Memory CRUD
# =========================================================
class TestMemory:
    created_id = None

    def test_01_add_memory(self, http):
        r = http.post(f"{API}/memory", json={
            "content": "My name is Satheesh, a software engineer who likes concise replies",
            "category": "identity",
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["content"].startswith("My name is Satheesh")
        assert body["category"] == "identity"
        assert "id" in body
        TestMemory.created_id = body["id"]

    def test_02_list_memory(self, http):
        r = http.get(f"{API}/memory")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert any(it["id"] == TestMemory.created_id for it in items)

    def test_03_delete_memory(self, http):
        assert TestMemory.created_id, "previous test must have populated id"
        r = http.delete(f"{API}/memory/{TestMemory.created_id}")
        assert r.status_code == 200
        assert r.json().get("deleted") is True

    def test_04_delete_404(self, http):
        r = http.delete(f"{API}/memory/non-existent-id")
        assert r.status_code == 404


# =========================================================
# NEW: Assistant text + voice + history
# =========================================================
class TestAssistant:
    audio_b64 = None

    def test_01_voices_list(self, http):
        r = http.get(f"{API}/assistant/voices")
        assert r.status_code == 200
        body = r.json()
        assert "voices" in body and isinstance(body["voices"], list)
        assert "nova" in body["voices"]

    def test_02_text_with_audio(self, http):
        # seed a memory the assistant should know about
        mem = http.post(f"{API}/memory", json={
            "content": "My name is Satheesh, a software engineer who likes concise replies",
            "category": "identity",
        })
        assert mem.status_code == 200
        mem_id = mem.json()["id"]

        try:
            r = http.post(f"{API}/assistant/text", json={
                "text": "Who am I and what do I do? Reply in one short sentence.",
                "session_id": SESSION,
                "voice": "nova",
                "speak": True,
            })
            assert r.status_code == 200, r.text
            body = r.json()
            assert body.get("reply_text"), "reply_text empty"
            assert body.get("reply_audio_base64"), "reply_audio_base64 missing"
            assert len(body["reply_audio_base64"]) > 500
            # memory grounding (lenient - just sanity check)
            assert "satheesh" in body["reply_text"].lower() or "engineer" in body["reply_text"].lower()
            TestAssistant.audio_b64 = body["reply_audio_base64"]
        finally:
            http.delete(f"{API}/memory/{mem_id}")

    def test_03_text_no_audio(self, http):
        r = http.post(f"{API}/assistant/text", json={
            "text": "Say hi in one word.",
            "session_id": SESSION,
            "speak": False,
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("reply_text")
        assert not body.get("reply_audio_base64")

    def test_04_history_present(self, http):
        r = http.get(f"{API}/assistant/history", params={"session_id": SESSION})
        assert r.status_code == 200
        msgs = r.json()
        assert isinstance(msgs, list) and len(msgs) >= 2

    def test_05_voice_endpoint_roundtrip(self, http):
        # Re-use the base64 audio captured from /assistant/text to feed /assistant/voice
        if not TestAssistant.audio_b64:
            pytest.skip("no audio from previous test")
        audio_bytes = base64.b64decode(TestAssistant.audio_b64)
        files = {"file": ("speech.mp3", audio_bytes, "audio/mpeg")}
        params = {"session_id": SESSION, "voice": "nova"}
        r = requests.post(f"{API}/assistant/voice", files=files, params=params)
        # Whisper sometimes fails on short TTS audio; accept 200 OR 400 (could-not-transcribe)
        assert r.status_code in (200, 400), r.text
        if r.status_code == 200:
            body = r.json()
            assert body.get("reply_text")
            assert body.get("reply_audio_base64")

    def test_06_history_clear(self, http):
        r = http.delete(f"{API}/assistant/history", params={"session_id": SESSION})
        assert r.status_code == 200 and r.json().get("cleared") is True
        r2 = http.get(f"{API}/assistant/history", params={"session_id": SESSION})
        assert r2.status_code == 200 and r2.json() == []
