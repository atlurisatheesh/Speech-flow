# SpeechFlow Mobile (Expo / React Native)

A native mobile client for the SpeechFlow backend — dictation, AI Voice Assistant (with Personal Memory + spoken replies), and history. Built with Expo so it runs on **iOS, Android, and web** from one codebase.

## Features
- **Dictate** — record your voice, get an instant transcript (Whisper).
- **Assistant** — talk or type; it answers using your Personal Memory and replies **aloud** in a preset neural voice (same backend as the web app, shared memory).
- **History** — view & delete past transcriptions.
- **Settings** — pick the assistant voice and manage Personal Memory.

> Voice: uses **preset neural voices** (no voice cloning), per product decision.

## Prerequisites
- Node 18+ and Yarn
- The [Expo Go](https://expo.dev/go) app on your phone (or an iOS/Android simulator)

## Run it
```bash
cd mobileApp
yarn install
# align native deps with your installed Expo SDK (recommended):
npx expo install
# start the dev server:
npx expo start
```
Then scan the QR code with **Expo Go** (Android) or the Camera app (iOS).

## Configure the backend
The app talks to the backend in `src/config.js`:
```js
export const BACKEND_URL = 'https://local-project-viewer.preview.emergentagent.com';
```
Change this to your deployed backend URL for production. (The backend already allows CORS from any origin.)

## Project structure
```
mobileApp/
├── App.js                 # bottom-tab navigation
├── app.json               # Expo config (mic permissions etc.)
├── src/
│   ├── config.js          # BACKEND_URL / API_BASE
│   ├── api.js             # all backend calls
│   ├── audio.js           # record + play (expo-av) helpers
│   ├── settings.js        # voice selection store
│   ├── theme.js           # colors
│   └── screens/
│       ├── HomeScreen.js       # Dictate
│       ├── AssistantScreen.js  # Voice assistant chat
│       ├── HistoryScreen.js
│       └── SettingsScreen.js   # Voice + Memory
```

## Notes
- Recording uses `expo-av` HIGH_QUALITY preset → `.m4a`, which the backend accepts.
- Assistant voice replies are returned as base64 mp3, written to cache and played with `expo-av`.
- Build standalone binaries later with **EAS Build** (`npx eas build`).
