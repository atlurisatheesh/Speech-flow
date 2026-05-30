import { app, BrowserWindow, ipcMain, globalShortcut, clipboard } from 'electron';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { exec, spawn, ChildProcess } from 'child_process';
import OpenAI from 'openai';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../backend/.env') });

const isDev = process.env.NODE_ENV !== 'production';

let mainWindow: BrowserWindow | null = null;
let openai: OpenAI | null = null;
let widgetProcess: ChildProcess | null = null;
let backendProcess: ChildProcess | null = null;

// Use the Emergent universal key (OpenAI-compatible proxy) so no personal
// OpenAI key is required. Falls back to a direct OPENAI_API_KEY if provided.
const EMERGENT_LLM_KEY = process.env.EMERGENT_LLM_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const EMERGENT_BASE_URL =
  (process.env.INTEGRATION_PROXY_URL || 'https://integrations.emergentagent.com') + '/llm';

if (EMERGENT_LLM_KEY) {
  openai = new OpenAI({ apiKey: EMERGENT_LLM_KEY, baseURL: EMERGENT_BASE_URL });
} else if (OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: OPENAI_API_KEY });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#F9F9F6',
      symbolColor: '#000000',
      height: 40
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// Win32 Paste simulation (using powershell as a fallback without node-gyp)
function pasteAtCursor() {
  const script = `
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.SendKeys]::SendWait("^{v}")
  `;
  exec(`powershell -command "${script}"`, (err) => {
    if (err) console.error('Paste error:', err);
  });
}

// Smart Context Mode: Detect which app the user was using before dictation
function getActiveWindowName(): Promise<string> {
  return new Promise((resolve) => {
    const script = `(Get-Process | Where-Object {$_.MainWindowHandle -ne 0} | Sort-Object -Property CPU -Descending | Select-Object -First 1).ProcessName`;
    exec(`powershell -command "${script}"`, (err, stdout) => {
      if (err) {
        resolve('unknown');
      } else {
        resolve(stdout.trim().toLowerCase());
      }
    });
  });
}

function startServices() {
  if (isDev) {
    const rootDir = path.join(__dirname, '../../');
    // 1. Start the FastAPI backend
    backendProcess = spawn('python', ['backend/server.py'], { cwd: rootDir });
    backendProcess.stdout?.on('data', (data) => console.log(`Backend: ${data}`));
    backendProcess.stderr?.on('data', (data) => console.error(`Backend Err: ${data}`));

    // 2. Start the floating desktop widget (Wispr Flow style)
    widgetProcess = spawn('python', ['desktop_widget.py'], { cwd: rootDir });
    widgetProcess.stdout?.on('data', (data) => console.log(`Widget: ${data}`));
    widgetProcess.stderr?.on('data', (data) => console.error(`Widget Err: ${data}`));
  } else {
    // In production, run the packaged executables from extraResources
    const backendExe = path.join(process.resourcesPath, 'SpeechFlow-Backend', 'SpeechFlow-Backend.exe');
    const widgetExe = path.join(process.resourcesPath, 'SpeechFlow-Widget', 'SpeechFlow-Widget.exe');
    
    backendProcess = spawn(backendExe, [], { cwd: path.dirname(backendExe) });
    backendProcess.stdout?.on('data', (data) => console.log(`Backend: ${data}`));
    backendProcess.stderr?.on('data', (data) => console.error(`Backend Err: ${data}`));

    widgetProcess = spawn(widgetExe, [], { cwd: path.dirname(widgetExe) });
    widgetProcess.stdout?.on('data', (data) => console.log(`Widget: ${data}`));
    widgetProcess.stderr?.on('data', (data) => console.error(`Widget Err: ${data}`));
  }
}

app.whenReady().then(() => {
  createWindow();
  
  startServices();

  // Global hotkey to toggle recording (Ctrl+Win isn't natively supported in Electron globalShortcut like it is in Python)
  // Let's use Ctrl+Shift+Space as an alternative, or register it through a custom Win32 hook later.
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    mainWindow?.webContents.send('toggle-dictation');
  });

  // Command / Transform mode: polish the highlighted text in place (Wispr-style command mode).
  globalShortcut.register('CommandOrControl+Shift+E', () => {
    transformSelection();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  // Kill background processes when the app exits
  if (widgetProcess) widgetProcess.kill();
  if (backendProcess) backendProcess.kill();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- Wispr Flow-style dictation pipeline ---
// Settings are kept in-memory and can be updated from the renderer via IPC.
const BACKEND = 'http://localhost:1993';

type AppSettings = { cleanupLevel: 'none' | 'low' | 'medium' | 'high'; style: string; language: string };
let userSettings: AppSettings = { cleanupLevel: 'medium', style: 'professional', language: 'auto' };

const CLEANUP_LEVELS: Record<string, string> = {
  low: 'Lightly clean: fix only punctuation and capitalization. Keep wording natural and verbatim.',
  medium:
    'Remove filler words (um, uh, like, you know), fix grammar and punctuation, resolve self-corrections (keep only the corrected version), and make sentences clear — while preserving the original meaning and the speaker\'s voice.',
  high:
    'Aggressively polish: remove all filler, fix grammar/punctuation, and restructure into clear, well-formatted text while strictly preserving the original meaning.',
};

const STYLES: Record<string, string> = {
  professional: 'Use a professional, concise tone suitable for work communication.',
  casual: 'Use a friendly, casual, conversational tone.',
  technical: 'Preserve technical terminology and be precise.',
  creative: 'Use expressive, engaging language.',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function backendGet(pathName: string): Promise<any[]> {
  try {
    const res = await fetch(`${BACKEND}${pathName}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

// AI cleanup of dictated text (the signature Wispr "auto-edit").
async function cleanupText(text: string, level: string, style: string): Promise<string> {
  if (!openai || !text || level === 'none') return text;
  try {
    const levelInstr = CLEANUP_LEVELS[level] || CLEANUP_LEVELS.medium;
    const styleInstr = STYLES[style] || '';
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert editor that cleans up dictated speech. ${levelInstr} ${styleInstr} Keep the user's language (do not translate). Return ONLY the cleaned text, with no preamble or quotes.`,
        },
        { role: 'user', content: text },
      ],
      temperature: 0.2,
    });
    return response.choices[0].message.content?.trim() || text;
  } catch (e) {
    return text;
  }
}

// Expand snippet trigger phrases into their saved content (text expansion).
async function expandSnippets(text: string): Promise<string> {
  const snippets = await backendGet('/api/snippets');
  let out = text;
  for (const s of snippets) {
    if (!s.trigger_phrase || !s.content) continue;
    const escaped = s.trigger_phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(escaped, 'gi'), s.content);
  }
  return out;
}

function saveToHistory(text: string) {
  try {
    const postData = JSON.stringify({ text });
    fetch(`${BACKEND}/api/transcriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: postData,
    }).catch((err) => console.warn('Backend save error:', err?.message));
  } catch (saveErr) {
    console.warn('Could not save to backend:', saveErr);
  }
}

ipcMain.handle('get-active-window', async () => {
  return await getActiveWindowName();
});

ipcMain.on('update-settings', (_event, s: Partial<AppSettings>) => {
  userSettings = { ...userSettings, ...s };
});

ipcMain.handle('get-settings', () => userSettings);

async function processAudioBuffer(blobBuffer: any, opts: { paste: boolean; save: boolean }): Promise<string> {
  if (!openai) return 'No API Key';
  const buffer = Buffer.from(blobBuffer);
  const tempPath = path.join(app.getPath('temp'), `speech-${Date.now()}.webm`);
  fs.writeFileSync(tempPath, buffer);
  try {
    // 1) Bias Whisper with the user's personal dictionary for correct spelling of custom words/names.
    const dictWords = await backendGet('/api/dictionary');
    const dictPrompt = dictWords.map((w: any) => w.word).filter(Boolean).join(', ');

    const transcribeParams: any = { file: fs.createReadStream(tempPath), model: 'whisper-1' };
    if (dictPrompt) transcribeParams.prompt = dictPrompt;
    if (userSettings.language && userSettings.language !== 'auto') transcribeParams.language = userSettings.language;

    const response = await openai.audio.transcriptions.create(transcribeParams);
    let text = (response.text || '').trim();

    if (text) {
      // 2) Auto-clean (filler removal, punctuation, formatting, style).
      text = await cleanupText(text, userSettings.cleanupLevel, userSettings.style);
      // 3) Expand any snippet triggers into full text.
      text = await expandSnippets(text);
      // 4) Optionally paste into the focused app + save to history.
      if (opts.paste) {
        clipboard.writeText(text);
        setTimeout(() => pasteAtCursor(), 150);
      }
      if (opts.save) saveToHistory(text);
    }
    return text;
  } finally {
    try { fs.unlinkSync(tempPath); } catch { /* noop */ }
  }
}

ipcMain.handle('transcribe-final', async (_event, blobBuffer) => {
  try {
    return await processAudioBuffer(blobBuffer, { paste: true, save: true });
  } catch (error: any) {
    console.error('Transcription error:', error);
    return 'Error: ' + error.message;
  }
});

// Transcribe + clean but DON'T paste (used by the in-app Scratchpad).
ipcMain.handle('transcribe-text', async (_event, blobBuffer) => {
  try {
    return await processAudioBuffer(blobBuffer, { paste: false, save: true });
  } catch (error: any) {
    console.error('Transcription error:', error);
    return 'Error: ' + error.message;
  }
});

// Command / Transform mode: polish the currently selected text in place.
function sendKeys(keys: string) {
  const script = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${keys}')`;
  exec(`powershell -command "${script}"`, (err) => {
    if (err) console.error('SendKeys error:', err);
  });
}

async function transformSelection() {
  if (!openai) return;
  // Copy the user's current selection, then read it from the clipboard.
  sendKeys('^c');
  await sleep(220);
  const selected = clipboard.readText();
  if (!selected || !selected.trim()) return;
  const polished = await cleanupText(selected, 'high', userSettings.style);
  if (polished && polished.trim()) {
    clipboard.writeText(polished);
    setTimeout(() => pasteAtCursor(), 150);
  }
}

ipcMain.handle('enhance-text', async (event, text) => {
  if (!openai || !text) return text;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Fix spelling, grammar, and punctuation. Do not change meaning. Keep technical/English terms in English. Return ONLY the fixed text." },
        { role: "user", content: text }
      ],
      temperature: 0.1,
    });
    return response.choices[0].message.content?.trim() || text;
  } catch (e) {
    return text;
  }
});

ipcMain.handle('get-clipboard', () => {
  return clipboard.readText();
});

ipcMain.on('paste-text', (event, text) => {
  clipboard.writeText(text);
  setTimeout(() => pasteAtCursor(), 100);
});

ipcMain.on('resize-window', (event, width, height) => {
  if (mainWindow) {
    mainWindow.setContentSize(width, height);
  }
});
