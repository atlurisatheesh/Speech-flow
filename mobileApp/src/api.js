import axios from 'axios';
import { API_BASE } from './config';

const client = axios.create({ baseURL: API_BASE, timeout: 90000 });

// ── Transcription ──────────────────────────────────────────────
export async function transcribeFile(uri, language) {
  const form = new FormData();
  form.append('file', { uri, name: 'recording.m4a', type: 'audio/m4a' });
  const params = language && language !== 'auto' ? { language } : {};
  const { data } = await client.post('/transcribe/file', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    params,
  });
  return data;
}

export async function getTranscriptions() {
  const { data } = await client.get('/transcriptions');
  return data;
}

export async function deleteTranscription(id) {
  await client.delete(`/transcriptions/${id}`);
}

// ── Assistant ──────────────────────────────────────────────────
export async function assistantText(text, voice, sessionId = 'mobile') {
  const { data } = await client.post('/assistant/text', {
    text,
    voice,
    session_id: sessionId,
    speak: true,
  });
  return data;
}

export async function assistantVoice(uri, voice, sessionId = 'mobile') {
  const form = new FormData();
  form.append('file', { uri, name: 'speech.m4a', type: 'audio/m4a' });
  const { data } = await client.post('/assistant/voice', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    params: { voice, session_id: sessionId },
  });
  return data;
}

export async function getAssistantHistory(sessionId = 'mobile') {
  const { data } = await client.get('/assistant/history', { params: { session_id: sessionId } });
  return data;
}

export async function clearAssistantHistory(sessionId = 'mobile') {
  await client.delete('/assistant/history', { params: { session_id: sessionId } });
}

// ── Personal memory ────────────────────────────────────────────
export async function getMemory() {
  const { data } = await client.get('/memory');
  return data;
}

export async function addMemory(content) {
  const { data } = await client.post('/memory', { content, category: 'general' });
  return data;
}

export async function deleteMemory(id) {
  await client.delete(`/memory/${id}`);
}
