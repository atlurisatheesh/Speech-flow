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
if (process.env.OPENAI_API_KEY) {
    openai = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY });
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
// --- IPC Handlers for Progressive Streaming ---
let audioChunks = [];
let chunkPromises = [];
electron_1.ipcMain.on('audio-chunk', async (event, chunkArrayBuffer) => {
    if (!openai)
        return;
    const chunk = Buffer.from(chunkArrayBuffer);
    audioChunks.push(chunk);
    // Wispr Flow style: process intermediate chunks in parallel
    // For simplicity in MVP, we will handle audio processing exactly like the Python progressive streaming
    // We will need a way to convert raw PCM from browser to WAV, or just send webm/webm directly to OpenAI
});
electron_1.ipcMain.handle('get-active-window', async () => {
    return await getActiveWindowName();
});
electron_1.ipcMain.handle('transcribe-final', async (event, blobBuffer) => {
    if (!openai)
        return 'No API Key';
    try {
        const buffer = Buffer.from(blobBuffer);
        // Write temp file
        const tempPath = path.join(electron_1.app.getPath('temp'), 'speech.webm');
        fs.writeFileSync(tempPath, buffer);
        const response = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempPath),
            model: 'whisper-1',
        });
        const text = response.text.trim();
        if (text) {
            electron_1.clipboard.writeText(text);
            setTimeout(() => pasteAtCursor(), 150);
            // Save to backend for history (fire-and-forget)
            try {
                const http = await Promise.resolve().then(() => __importStar(require('http')));
                const postData = JSON.stringify({ text });
                const req = http.request({
                    hostname: 'localhost',
                    port: 1993,
                    path: '/api/transcriptions',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(postData),
                    },
                });
                req.on('error', (err) => console.warn('Backend save error:', err.message));
                req.write(postData);
                req.end();
            }
            catch (saveErr) {
                console.warn('Could not save to backend:', saveErr);
            }
        }
        return text;
    }
    catch (error) {
        console.error('Transcription error:', error);
        return 'Error: ' + error.message;
    }
});
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
