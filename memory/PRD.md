# SpeechFlow - AI-Powered Speech-to-Text Tool

## Original Problem Statement
Build a tool like Whisper Flow (https://wisprflow.ai/) but even more accurate. Speech-to-text functionality with AI-powered enhancements.

## Architecture
- **Backend**: FastAPI + MongoDB + OpenAI Whisper (via emergentintegrations)
- **Frontend**: React + Tailwind + Shadcn UI + Framer Motion
- **Design**: Swiss & High-Contrast aesthetic with Outfit + IBM Plex Sans fonts
- **AI Models**: Whisper-1 (transcription), GPT-4o-mini (text enhancement)

## User Personas
- **Professionals**: Need fast, accurate transcription for meetings, notes
- **Students**: Class notes, essay drafts, cover letters
- **Content Creators**: Quick voice-to-text for social media, blogs
- **Developers**: Voice coding, commit messages
- **Accessibility users**: Voice-first interaction

## Core Requirements
1. Audio file upload & transcription (MP3, WAV, M4A, WEBM)
2. AI-powered auto-editing (filler removal, grammar, punctuation)
3. Multi-language support (100+ languages via Whisper)
4. Personal dictionary for custom words
5. Transcript history management
6. Copy/download functionality

## What's Been Implemented (Feb 2026)
- ✅ POST /api/transcribe/file - Uploads audio to object storage, returns audio_path
- ✅ GET /api/transcriptions/{id}/audio - Serves stored audio for persistent playback
- ✅ PATCH /api/transcriptions/{id}/speakers - Update speaker labels (e.g. Speaker 1 → Alice)
- ✅ POST /api/transcribe/chunk - Streaming/live chunk transcription (no DB save)
- ✅ POST /api/transcribe/process - AI text enhancement
- ✅ POST /api/transcribe/diarize - AI speaker diarization
- ✅ GET /api/transcriptions/{id}/export/{format} - SRT/VTT/TXT export
- ✅ MicRecorder with Record + Live mode buttons (live streams chunks every 5s)
- ✅ AudioPlayer with persistent backend URL (loads stored audio for historical transcripts)
- ✅ Speaker rename panel with inline edit (click pencil, type name, save)
- ✅ Live transcription preview box during streaming mode
- ✅ "● AUDIO SAVED" indicator on transcripts with stored audio
- ✅ All 34 backend tests passing (100%)

## Prioritized Backlog (P0/P1/P2)
- **P1**: User authentication & multi-user support
- **P2**: Refactor server.py into routers (transcribe/storage/dictionary)
- **P2**: Stripe-based subscriptions (Free/Pro/Team tiers)
- **P2**: Stream WebSocket for true real-time (vs 5s chunks)
- **P2**: Audio cleanup on transcription failure (rollback orphans)
- **P2**: Team collaboration features (shared workspaces)

## Next Tasks
- Add real-time browser-based audio recording
- Implement word-level timestamps display
- Add subscription/payment integration
