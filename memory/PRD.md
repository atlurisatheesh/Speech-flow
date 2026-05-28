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
- ✅ POST /api/transcribe/file - Audio file upload & transcription with segments+words timestamps
- ✅ POST /api/transcribe/process - AI text enhancement
- ✅ POST /api/transcribe/diarize - AI speaker diarization (compact prompt for budget)
- ✅ GET /api/transcriptions/{id}/export/{format} - SRT/VTT/TXT export
- ✅ GET/DELETE /api/transcriptions - History management
- ✅ POST/GET/DELETE /api/dictionary - Personal dictionary
- ✅ MicRecorder component - Browser MediaRecorder API with live audio level visualization
- ✅ AudioPlayer component - Play/pause/seek with timestamp display
- ✅ Click-to-seek interactive segments view with active highlighting
- ✅ Identify Speakers button (diarization)
- ✅ Export dropdown menu (TXT, SRT, VTT)
- ✅ All 20 backend tests passing (100%)

## Prioritized Backlog (P0/P1/P2)
- **P1**: Object storage for audio files (so historical transcripts can be replayed)
- **P2**: Word-level click-to-seek (within segments)
- **P2**: Streaming/real-time transcription (chunk audio while recording)
- **P2**: Speaker label editing (rename "Speaker 1" → "Alice")
- **P2**: User authentication & multi-user support
- **P2**: Team collaboration features

## Next Tasks
- Add real-time browser-based audio recording
- Implement word-level timestamps display
- Add subscription/payment integration
