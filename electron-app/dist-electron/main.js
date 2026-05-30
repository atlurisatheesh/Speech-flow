"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const dotenv = __importStar(require("dotenv"));
const child_process_1 = require("child_process");
const openai_1 = __importDefault(require("openai"));
const fs = __importStar(require("fs"));
// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../backend/.env') });
const isDev = process.env.NODE_ENV !== 'production';
let mainWindow = null;
let openai = null;
let widgetProcess = null;
let backendProcess = null;
// Use the Emergent universal key (OpenAI-compatible proxy) so no personal
// OpenAI key is required. Falls back to a direct OPENAI_API_KEY if provided.
const EMERGENT_LLM_KEY = process.env.EMERGENT_LLM_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const EMERGENT_BASE_URL = (process.env.INTEGRATION_PROXY_URL || 'https://integrations.emergentagent.com') + '/llm';
if (EMERGENT_LLM_KEY) {
    openai = new openai_1.default({ apiKey: EMERGENT_LLM_KEY, baseURL: EMERGENT_BASE_URL });
}
else if (OPENAI_API_KEY) {
    openai = new openai_1.default({ apiKey: OPENAI_API_KEY });
}
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
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
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}
// Win32 Paste simulation (using powershell as a fallback without node-gyp)
function pasteAtCursor() {
    const script = `
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.SendKeys]::SendWait("^{v}")
  `;
    (0, child_process_1.exec)(`powershell -command "${script}"`, (err) => {
        if (err)
            console.error('Paste error:', err);
    });
}
// Smart Context Mode: Detect which app the user was using before dictation
function getActiveWindowName() {
    return new Promise((resolve) => {
        const script = `(Get-Process | Where-Object {$_.MainWindowHandle -ne 0} | Sort-Object -Property CPU -Descending | Select-Object -First 1).ProcessName`;
        (0, child_process_1.exec)(`powershell -command "${script}"`, (err, stdout) => {
            if (err) {
                resolve('unknown');
            }
            else {
                resolve(stdout.trim().toLowerCase());
            }
        });
    });
}
function startServices() {
    if (isDev) {
        const rootDir = path.join(__dirname, '../../');
        // 1. Start the FastAPI backend
        backendProcess = (0, child_process_1.spawn)('python', ['backend/server.py'], { cwd: rootDir });
        backendProcess.stdout?.on('data', (data) => console.log(`Backend: ${data}`));
        backendProcess.stderr?.on('data', (data) => console.error(`Backend Err: ${data}`));
        // 2. Start the floating desktop widget (Wispr Flow style)
        widgetProcess = (0, child_process_1.spawn)('python', ['desktop_widget.py'], { cwd: rootDir });
        widgetProcess.stdout?.on('data', (data) => console.log(`Widget: ${data}`));
        widgetProcess.stderr?.on('data', (data) => console.error(`Widget Err: ${data}`));
    }
    else {
        // In production, run the packaged executables from extraResources
        const backendExe = path.join(process.resourcesPath, 'SpeechFlow-Backend', 'SpeechFlow-Backend.exe');
        const widgetExe = path.join(process.resourcesPath, 'SpeechFlow-Widget', 'SpeechFlow-Widget.exe');
        backendProcess = (0, child_process_1.spawn)(backendExe, [], { cwd: path.dirname(backendExe) });
        backendProcess.stdout?.on('data', (data) => console.log(`Backend: ${data}`));
        backendProcess.stderr?.on('data', (data) => console.error(`Backend Err: ${data}`));
        widgetProcess = (0, child_process_1.spawn)(widgetExe, [], { cwd: path.dirname(widgetExe) });
        widgetProcess.stdout?.on('data', (data) => console.log(`Widget: ${data}`));
        widgetProcess.stderr?.on('data', (data) => console.error(`Widget Err: ${data}`));
    }
}
electron_1.app.whenReady().then(() => {
    createWindow();
    startServices();
    // Global hotkey to toggle recording (Ctrl+Win isn't natively supported in Electron globalShortcut like it is in Python)
    // Let's use Ctrl+Shift+Space as an alternative, or register it through a custom Win32 hook later.
    electron_1.globalShortcut.register('CommandOrControl+Shift+Space', () => {
        mainWindow?.webContents.send('toggle-dictation');
    });
    // Command / Transform mode: polish the highlighted text in place (Wispr-style command mode).
    electron_1.globalShortcut.register('CommandOrControl+Shift+E', () => {
        transformSelection();
    });
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on('will-quit', () => {
    // Kill background processes when the app exits
    if (widgetProcess)
        widgetProcess.kill();
    if (backendProcess)
        backendProcess.kill();
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
// --- Wispr Flow-style dictation pipeline ---
// Settings are kept in-memory and can be updated from the renderer via IPC.
const BACKEND = 'http://localhost:1993';
let userSettings = { cleanupLevel: 'medium', style: 'professional', language: 'auto' };
const CLEANUP_LEVELS = {
    low: 'Lightly clean: fix only punctuation and capitalization. Keep wording natural and verbatim.',
    medium: 'Remove filler words (um, uh, like, you know), fix grammar and punctuation, resolve self-corrections (keep only the corrected version), and make sentences clear — while preserving the original meaning and the speaker\'s voice.',
    high: 'Aggressively polish: remove all filler, fix grammar/punctuation, and restructure into clear, well-formatted text while strictly preserving the original meaning.',
};
const STYLES = {
    professional: 'Use a professional, concise tone suitable for work communication.',
    casual: 'Use a friendly, casual, conversational tone.',
    technical: 'Preserve technical terminology and be precise.',
    creative: 'Use expressive, engaging language.',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function backendGet(pathName) {
    try {
        const res = await fetch(`${BACKEND}${pathName}`);
        if (!res.ok)
            return [];
        return await res.json();
    }
    catch {
        return [];
    }
}
// AI cleanup of dictated text (the signature Wispr "auto-edit").
async function cleanupText(text, level, style) {
    if (!openai || !text || level === 'none')
        return text;
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
    }
    catch (e) {
        return text;
    }
}
// Expand snippet trigger phrases into their saved content (text expansion).
async function expandSnippets(text) {
    const snippets = await backendGet('/api/snippets');
    let out = text;
    for (const s of snippets) {
        if (!s.trigger_phrase || !s.content)
            continue;
        const escaped = s.trigger_phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        out = out.replace(new RegExp(escaped, 'gi'), s.content);
    }
    return out;
}
function saveToHistory(text) {
    try {
        const postData = JSON.stringify({ text });
        fetch(`${BACKEND}/api/transcriptions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: postData,
        }).catch((err) => console.warn('Backend save error:', err?.message));
    }
    catch (saveErr) {
        console.warn('Could not save to backend:', saveErr);
    }
}
electron_1.ipcMain.handle('get-active-window', async () => {
    return await getActiveWindowName();
});
electron_1.ipcMain.on('update-settings', (_event, s) => {
    userSettings = { ...userSettings, ...s };
});
electron_1.ipcMain.handle('get-settings', () => userSettings);
async function processAudioBuffer(blobBuffer, opts) {
    if (!openai)
        return 'No API Key';
    const buffer = Buffer.from(blobBuffer);
    const tempPath = path.join(electron_1.app.getPath('temp'), `speech-${Date.now()}.webm`);
    fs.writeFileSync(tempPath, buffer);
    try {
        // 1) Bias Whisper with the user's personal dictionary for correct spelling of custom words/names.
        const dictWords = await backendGet('/api/dictionary');
        const dictPrompt = dictWords.map((w) => w.word).filter(Boolean).join(', ');
        const transcribeParams = { file: fs.createReadStream(tempPath), model: 'whisper-1' };
        if (dictPrompt)
            transcribeParams.prompt = dictPrompt;
        if (userSettings.language && userSettings.language !== 'auto')
            transcribeParams.language = userSettings.language;
        const response = await openai.audio.transcriptions.create(transcribeParams);
        let text = (response.text || '').trim();
        if (text) {
            // 2) Auto-clean (filler removal, punctuation, formatting, style).
            text = await cleanupText(text, userSettings.cleanupLevel, userSettings.style);
            // 3) Expand any snippet triggers into full text.
            text = await expandSnippets(text);
            // 4) Optionally paste into the focused app + save to history.
            if (opts.paste) {
                electron_1.clipboard.writeText(text);
                setTimeout(() => pasteAtCursor(), 150);
            }
            if (opts.save)
                saveToHistory(text);
        }
        return text;
    }
    finally {
        try {
            fs.unlinkSync(tempPath);
        }
        catch { /* noop */ }
    }
}
electron_1.ipcMain.handle('transcribe-final', async (_event, blobBuffer) => {
    try {
        return await processAudioBuffer(blobBuffer, { paste: true, save: true });
    }
    catch (error) {
        console.error('Transcription error:', error);
        return 'Error: ' + error.message;
    }
});
// Transcribe + clean but DON'T paste (used by the in-app Scratchpad).
electron_1.ipcMain.handle('transcribe-text', async (_event, blobBuffer) => {
    try {
        return await processAudioBuffer(blobBuffer, { paste: false, save: true });
    }
    catch (error) {
        console.error('Transcription error:', error);
        return 'Error: ' + error.message;
    }
});
// Command / Transform mode: polish the currently selected text in place.
function sendKeys(keys) {
    const script = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${keys}')`;
    (0, child_process_1.exec)(`powershell -command "${script}"`, (err) => {
        if (err)
            console.error('SendKeys error:', err);
    });
}
async function transformSelection() {
    if (!openai)
        return;
    // Copy the user's current selection, then read it from the clipboard.
    sendKeys('^c');
    await sleep(220);
    const selected = electron_1.clipboard.readText();
    if (!selected || !selected.trim())
        return;
    const polished = await cleanupText(selected, 'high', userSettings.style);
    if (polished && polished.trim()) {
        electron_1.clipboard.writeText(polished);
        setTimeout(() => pasteAtCursor(), 150);
    }
}
electron_1.ipcMain.handle('enhance-text', async (event, text) => {
    if (!openai || !text)
        return text;
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
    }
    catch (e) {
        return text;
    }
});
electron_1.ipcMain.handle('get-clipboard', () => {
    return electron_1.clipboard.readText();
});
electron_1.ipcMain.on('paste-text', (event, text) => {
    electron_1.clipboard.writeText(text);
    setTimeout(() => pasteAtCursor(), 100);
});
electron_1.ipcMain.on('resize-window', (event, width, height) => {
    if (mainWindow) {
        mainWindow.setContentSize(width, height);
    }
});
