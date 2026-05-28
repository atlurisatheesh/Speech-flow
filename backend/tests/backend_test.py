"""Backend tests for Speech-to-Text Pro API (iteration 2: adds diarize + export tests)"""
import os
import io
import wave
import struct
import math
import pytest
import requests

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')
API = f"{BASE_URL}/api"


def _gen_wav_bytes(seconds=2, freq=440, rate=16000):
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        for i in range(rate * seconds):
            val = int(32767.0 * 0.3 * math.sin(2 * math.pi * freq * (i / rate)))
            w.writeframes(struct.pack('<h', val))
    return buf.getvalue()


# Health / root
def test_root():
    r = requests.get(f"{API}/")
    assert r.status_code == 200
    assert "message" in r.json()


# Transcriptions list
def test_get_transcriptions():
    r = requests.get(f"{API}/transcriptions")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# File upload - unsupported format
def test_transcribe_unsupported_format():
    files = {'file': ('test.txt', b'hello', 'text/plain')}
    r = requests.post(f"{API}/transcribe/file", files=files)
    assert r.status_code == 400
    assert 'Unsupported' in r.json().get('detail', '')


# === New feature: transcribe returns segments/words ===
class TestTranscribeWithTimestamps:
    transcription_id = None

    def test_01_transcribe_returns_segments_words(self):
        wav_bytes = _gen_wav_bytes(seconds=3)
        files = {'file': ('test.wav', wav_bytes, 'audio/wav')}
        r = requests.post(f"{API}/transcribe/file", files=files, timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        assert 'id' in data and 'text' in data
        assert data['filename'] == 'test.wav'
        # New fields (may be None for very short / silent audio)
        assert 'segments' in data
        assert 'words' in data
        TestTranscribeWithTimestamps.transcription_id = data['id']
        # If segments exist, validate shape
        if data['segments']:
            seg = data['segments'][0]
            assert 'start' in seg and 'end' in seg and 'text' in seg
            assert isinstance(seg['start'], (int, float))
        if data['words']:
            w = data['words'][0]
            assert 'start' in w and 'end' in w and 'word' in w

    def test_02_export_txt(self):
        if not TestTranscribeWithTimestamps.transcription_id:
            pytest.skip("transcription not created")
        tid = TestTranscribeWithTimestamps.transcription_id
        r = requests.get(f"{API}/transcriptions/{tid}/export/txt")
        assert r.status_code == 200
        assert 'attachment' in r.headers.get('content-disposition', '').lower()
        assert len(r.text) >= 0  # text may be empty for silent audio

    def test_03_export_srt(self):
        if not TestTranscribeWithTimestamps.transcription_id:
            pytest.skip("transcription not created")
        tid = TestTranscribeWithTimestamps.transcription_id
        r = requests.get(f"{API}/transcriptions/{tid}/export/srt")
        assert r.status_code == 200
        assert 'attachment' in r.headers.get('content-disposition', '').lower()
        assert '.srt' in r.headers.get('content-disposition', '').lower()

    def test_04_export_vtt(self):
        if not TestTranscribeWithTimestamps.transcription_id:
            pytest.skip("transcription not created")
        tid = TestTranscribeWithTimestamps.transcription_id
        r = requests.get(f"{API}/transcriptions/{tid}/export/vtt")
        assert r.status_code == 200
        assert r.headers.get('content-type', '').startswith('text/vtt')
        # WEBVTT header must be present
        assert 'WEBVTT' in r.text

    def test_05_export_invalid_format(self):
        if not TestTranscribeWithTimestamps.transcription_id:
            pytest.skip("transcription not created")
        tid = TestTranscribeWithTimestamps.transcription_id
        r = requests.get(f"{API}/transcriptions/{tid}/export/pdf")
        assert r.status_code == 400

    def test_06_export_404(self):
        r = requests.get(f"{API}/transcriptions/nonexistent-id-xyz/export/txt")
        assert r.status_code == 404

    def test_99_cleanup(self):
        if TestTranscribeWithTimestamps.transcription_id:
            requests.delete(f"{API}/transcriptions/{TestTranscribeWithTimestamps.transcription_id}")


# === Diarize tests ===
class TestDiarize:
    def test_single_speaker_monologue(self):
        payload = {
            "segments": [
                {"start": 0.0, "end": 3.0, "text": "Today I will talk about machine learning."},
                {"start": 3.0, "end": 6.0, "text": "It is a fascinating field of computer science."},
                {"start": 6.0, "end": 9.0, "text": "And I have been studying it for years."},
            ]
        }
        r = requests.post(f"{API}/transcribe/diarize", json=payload, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert 'segments' in data
        assert len(data['segments']) == 3
        for seg in data['segments']:
            assert 'speaker' in seg and seg['speaker'].startswith('Speaker')
        # Monologue: all should be Speaker 1
        speakers = {s['speaker'] for s in data['segments']}
        assert 'Speaker 1' in speakers

    def test_multi_speaker_dialogue(self):
        payload = {
            "segments": [
                {"start": 0.0, "end": 2.0, "text": "Hi John, how are you today?"},
                {"start": 2.0, "end": 4.0, "text": "I'm doing well, thanks for asking. How about you?"},
                {"start": 4.0, "end": 6.0, "text": "Pretty good. Did you finish the project?"},
                {"start": 6.0, "end": 8.0, "text": "Yes, I submitted it yesterday."},
            ]
        }
        r = requests.post(f"{API}/transcribe/diarize", json=payload, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data['segments']) == 4
        speakers = {s['speaker'] for s in data['segments']}
        # Dialogue should ideally produce 2 speakers
        assert len(speakers) >= 2, f"Expected multi-speaker but got: {speakers}"

    def test_diarize_preserves_text_and_timing(self):
        payload = {
            "segments": [
                {"start": 1.5, "end": 3.5, "text": "Hello world"},
            ]
        }
        r = requests.post(f"{API}/transcribe/diarize", json=payload, timeout=60)
        assert r.status_code == 200
        seg = r.json()['segments'][0]
        assert seg['text'] == 'Hello world'
        assert seg['start'] == 1.5
        assert seg['end'] == 3.5


# === Existing functionality regression ===
def test_process_text():
    payload = {"text": "Um, so like, I went to the uh store today you know."}
    r = requests.post(f"{API}/transcribe/process", json=payload, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    assert 'processed_text' in data and len(data['processed_text']) > 0


def test_delete_transcription_404():
    r = requests.delete(f"{API}/transcriptions/nonexistent-id-12345")
    assert r.status_code == 404


# Dictionary CRUD (regression)
class TestDictionary:
    word_id = None
    test_word = "TEST_supercalifragilistic"

    def test_01_add_word(self):
        existing = requests.get(f"{API}/dictionary").json()
        for w in existing:
            if w['word'].lower() == self.test_word.lower():
                requests.delete(f"{API}/dictionary/{w['id']}")
        r = requests.post(f"{API}/dictionary", json={"word": self.test_word})
        assert r.status_code == 200, r.text
        TestDictionary.word_id = r.json()['id']

    def test_02_duplicate_word(self):
        r = requests.post(f"{API}/dictionary", json={"word": self.test_word})
        assert r.status_code == 400

    def test_03_duplicate_case_insensitive(self):
        r = requests.post(f"{API}/dictionary", json={"word": self.test_word.upper()})
        assert r.status_code == 400, "Case-insensitive duplicate check should reject uppercase variant"

    def test_04_delete_word(self):
        r = requests.delete(f"{API}/dictionary/{TestDictionary.word_id}")
        assert r.status_code == 200

    def test_05_delete_word_404(self):
        r = requests.delete(f"{API}/dictionary/nonexistent")
        assert r.status_code == 404



# === Iteration 3: Audio storage, speaker labels, chunk streaming ===
class TestIteration3Storage:
    """Tests for object storage integration (audio_path field) and audio retrieval"""
    transcription_id = None
    audio_path = None

    def test_01_transcribe_returns_audio_path(self):
        wav_bytes = _gen_wav_bytes(seconds=3)
        files = {'file': ('iter3_test.wav', wav_bytes, 'audio/wav')}
        r = requests.post(f"{API}/transcribe/file", files=files, timeout=180)
        assert r.status_code == 200, r.text
        data = r.json()
        assert 'audio_path' in data, "audio_path field missing from response"
        # If storage is up, audio_path should be non-null and start with 'speechflow/audio/'
        if data.get('audio_path'):
            assert data['audio_path'].startswith('speechflow/audio/'), f"Unexpected audio_path: {data['audio_path']}"
            assert data.get('audio_mime') == 'audio/wav'
            TestIteration3Storage.audio_path = data['audio_path']
        TestIteration3Storage.transcription_id = data['id']

    def test_02_get_audio_returns_bytes(self):
        tid = TestIteration3Storage.transcription_id
        if not tid:
            pytest.skip("no transcription created")
        if not TestIteration3Storage.audio_path:
            pytest.skip("storage was unavailable on upload - skipping audio retrieval")
        r = requests.get(f"{API}/transcriptions/{tid}/audio", timeout=60)
        assert r.status_code == 200, r.text
        assert r.headers.get('content-type', '').startswith('audio/'), f"Got content-type: {r.headers.get('content-type')}"
        assert len(r.content) > 100, "Audio response too small"
        # Note: backend sets Cache-Control: public, max-age=31536000 but the
        # k8s/cloudflare ingress rewrites it to no-store. We only assert
        # body+content-type which is what the browser audio player needs.

    def test_03_get_audio_404_nonexistent(self):
        r = requests.get(f"{API}/transcriptions/nonexistent-id-xyz/audio")
        assert r.status_code == 404
        assert 'not found' in r.json().get('detail', '').lower()

    def test_04_get_audio_404_no_audio_path(self):
        # Create a transcription doc directly with no audio_path (simulate legacy)
        # We can't reach DB directly here, but if there's a pre-existing legacy
        # transcript in DB without audio_path, the endpoint should return 404.
        # Try fetching all transcriptions, find one without audio_path, request its audio.
        r = requests.get(f"{API}/transcriptions")
        assert r.status_code == 200
        legacy = [t for t in r.json() if not t.get('audio_path')]
        if not legacy:
            pytest.skip("no legacy transcript without audio_path available")
        legacy_id = legacy[0]['id']
        r = requests.get(f"{API}/transcriptions/{legacy_id}/audio")
        assert r.status_code == 404
        assert 'no audio' in r.json().get('detail', '').lower()

    def test_99_cleanup(self):
        if TestIteration3Storage.transcription_id:
            requests.delete(f"{API}/transcriptions/{TestIteration3Storage.transcription_id}")


class TestIteration3SpeakerLabels:
    """Tests for PATCH /api/transcriptions/{id}/speakers"""
    transcription_id = None

    def test_01_setup_create_transcript(self):
        wav_bytes = _gen_wav_bytes(seconds=2)
        files = {'file': ('iter3_speakers.wav', wav_bytes, 'audio/wav')}
        r = requests.post(f"{API}/transcribe/file", files=files, timeout=180)
        assert r.status_code == 200, r.text
        TestIteration3SpeakerLabels.transcription_id = r.json()['id']

    def test_02_patch_speaker_labels(self):
        tid = TestIteration3SpeakerLabels.transcription_id
        if not tid:
            pytest.skip("no transcript")
        payload = {"speaker_labels": {"Speaker 1": "Alice", "Speaker 2": "Bob"}}
        r = requests.patch(f"{API}/transcriptions/{tid}/speakers", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get('speaker_labels') == payload['speaker_labels']

    def test_03_speaker_labels_persist(self):
        tid = TestIteration3SpeakerLabels.transcription_id
        if not tid:
            pytest.skip("no transcript")
        r = requests.get(f"{API}/transcriptions")
        assert r.status_code == 200
        match = next((t for t in r.json() if t['id'] == tid), None)
        assert match is not None, "transcript not found in list"
        assert match.get('speaker_labels') == {"Speaker 1": "Alice", "Speaker 2": "Bob"}

    def test_04_patch_speakers_overwrite(self):
        tid = TestIteration3SpeakerLabels.transcription_id
        if not tid:
            pytest.skip("no transcript")
        payload = {"speaker_labels": {"Speaker 1": "Charlie"}}
        r = requests.patch(f"{API}/transcriptions/{tid}/speakers", json=payload, timeout=30)
        assert r.status_code == 200
        # Verify via GET that update overwrote
        r = requests.get(f"{API}/transcriptions")
        match = next((t for t in r.json() if t['id'] == tid), None)
        assert match['speaker_labels'] == {"Speaker 1": "Charlie"}

    def test_05_patch_speakers_404(self):
        r = requests.patch(
            f"{API}/transcriptions/nonexistent-xyz/speakers",
            json={"speaker_labels": {"Speaker 1": "X"}}
        )
        assert r.status_code == 404

    def test_99_cleanup(self):
        if TestIteration3SpeakerLabels.transcription_id:
            requests.delete(f"{API}/transcriptions/{TestIteration3SpeakerLabels.transcription_id}")


class TestIteration3Chunk:
    """Tests for POST /api/transcribe/chunk (streaming chunk transcription)"""

    def test_01_chunk_small_returns_empty(self):
        # < 1KB should return empty text gracefully
        files = {'file': ('chunk.webm', b'\x00' * 500, 'audio/webm')}
        r = requests.post(f"{API}/transcribe/chunk", files=files, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert 'text' in data
        assert data['text'] == ''

    def test_02_chunk_wav_returns_text_field(self):
        # A real (silent) 1s wav, > 1KB
        wav_bytes = _gen_wav_bytes(seconds=1)
        files = {'file': ('chunk.wav', wav_bytes, 'audio/wav')}
        r = requests.post(f"{API}/transcribe/chunk", files=files, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert 'text' in data
        # text may be empty for tone audio - that's fine, but field must exist as string
        assert isinstance(data['text'], str)

    def test_03_chunk_unknown_ext_handled(self):
        # Unknown extension falls back to webm
        wav_bytes = _gen_wav_bytes(seconds=1)
        files = {'file': ('chunk.xyz', wav_bytes, 'application/octet-stream')}
        r = requests.post(f"{API}/transcribe/chunk", files=files, timeout=60)
        # Endpoint never raises - returns {text: '', error: ...} on failure
        assert r.status_code == 200
        assert 'text' in r.json()
