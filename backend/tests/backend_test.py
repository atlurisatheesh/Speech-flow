"""Backend tests for Speech-to-Text Pro API"""
import os
import io
import wave
import struct
import math
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://speech-to-text-pro-6.preview.emergentagent.com').rstrip('/')
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


# File upload - whisper transcription
def test_transcribe_wav_file():
    wav_bytes = _gen_wav_bytes()
    files = {'file': ('test.wav', wav_bytes, 'audio/wav')}
    r = requests.post(f"{API}/transcribe/file", files=files, timeout=90)
    assert r.status_code == 200, f"Status {r.status_code}: {r.text}"
    data = r.json()
    assert 'id' in data
    assert 'text' in data
    assert data['filename'] == 'test.wav'
    # Verify persistence
    g = requests.get(f"{API}/transcriptions")
    assert any(t['id'] == data['id'] for t in g.json())
    # cleanup
    requests.delete(f"{API}/transcriptions/{data['id']}")


# AI text processing
def test_process_text():
    payload = {"text": "Um, so like, I went to the uh store today you know."}
    r = requests.post(f"{API}/transcribe/process", json=payload, timeout=60)
    assert r.status_code == 200, f"Status {r.status_code}: {r.text}"
    data = r.json()
    assert 'processed_text' in data
    assert 'original_text' in data
    assert len(data['processed_text']) > 0


# Delete transcription - not found
def test_delete_transcription_404():
    r = requests.delete(f"{API}/transcriptions/nonexistent-id-12345")
    assert r.status_code == 404


# Dictionary CRUD
class TestDictionary:
    word_id = None
    test_word = "TEST_supercalifragilistic"

    def test_01_add_word(self):
        # cleanup any existing
        existing = requests.get(f"{API}/dictionary").json()
        for w in existing:
            if w['word'].lower() == self.test_word.lower():
                requests.delete(f"{API}/dictionary/{w['id']}")
        r = requests.post(f"{API}/dictionary", json={"word": self.test_word})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data['word'] == self.test_word
        TestDictionary.word_id = data['id']

    def test_02_duplicate_word(self):
        r = requests.post(f"{API}/dictionary", json={"word": self.test_word})
        assert r.status_code == 400

    def test_03_get_dictionary(self):
        r = requests.get(f"{API}/dictionary")
        assert r.status_code == 200
        assert any(w['id'] == TestDictionary.word_id for w in r.json())

    def test_04_delete_word(self):
        r = requests.delete(f"{API}/dictionary/{TestDictionary.word_id}")
        assert r.status_code == 200
        # verify gone
        words = requests.get(f"{API}/dictionary").json()
        assert not any(w['id'] == TestDictionary.word_id for w in words)

    def test_05_delete_word_404(self):
        r = requests.delete(f"{API}/dictionary/nonexistent")
        assert r.status_code == 404
