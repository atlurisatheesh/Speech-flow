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

if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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

// --- IPC Handlers for Progressive Streaming ---

let audioChunks: Buffer[] = [];
let chunkPromises: Promise<string>[] = [];

ipcMain.on('audio-chunk', async (event, chunkArrayBuffer) => {
  if (!openai) return;
  
  const chunk = Buffer.from(chunkArrayBuffer);
  audioChunks.push(chunk);

  // Wispr Flow style: process intermediate chunks in parallel
  // For simplicity in MVP, we will handle audio processing exactly like the Python progressive streaming
  // We will need a way to convert raw PCM from browser to WAV, or just send webm/webm directly to OpenAI
});

ipcMain.handle('get-active-window', async () => {
  return await getActiveWindowName();
});

ipcMain.handle('transcribe-final', async (event, blobBuffer) => {
  if (!openai) return 'No API Key';
  try {
    const buffer = Buffer.from(blobBuffer);
    
    // Write temp file
    const tempPath = path.join(app.getPath('temp'), 'speech.webm');
    fs.writeFileSync(tempPath, buffer);

    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-1',
    });

    const text = response.text.trim();
    if (text) {
      clipboard.writeText(text);
      setTimeout(() => pasteAtCursor(), 150);

      // Save to backend for history (fire-and-forget)
      try {
        const http = await import('http');
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
        req.on('error', (err: Error) => console.warn('Backend save error:', err.message));
        req.write(postData);
        req.end();
      } catch (saveErr) {
        console.warn('Could not save to backend:', saveErr);
      }
    }
    return text;
  } catch (error: any) {
    console.error('Transcription error:', error);
    return 'Error: ' + error.message;
  }
});

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
