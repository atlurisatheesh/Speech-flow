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
- ✅ POST /api/transcribe/file - Audio file upload & transcription
- ✅ POST /api/transcribe/process - AI text enhancement
- ✅ GET/DELETE /api/transcriptions - History management
- ✅ POST/GET/DELETE /api/dictionary - Personal dictionary
- ✅ Split-pane UI with sidebar (history/dictionary) + editor
- ✅ Hero section with file upload
- ✅ Real-time loading states
- ✅ Copy/download transcript actions
- ✅ AI Enhance toggle with original/enhanced comparison
- ✅ All 11 backend tests passing

## Prioritized Backlog (P0/P1/P2)
- **P1**: Real-time microphone recording (browser MediaRecorder API)
- **P1**: Audio playback with synced highlighting
- **P2**: Export to multiple formats (SRT, VTT, PDF)
- **P2**: Speaker diarization for multi-speaker audio
- **P2**: Snippet library (voice shortcuts)
- **P2**: User authentication & multi-user support
- **P2**: Team collaboration features

## Next Tasks
- Add real-time browser-based audio recording
- Implement word-level timestamps display
- Add subscription/payment integration
