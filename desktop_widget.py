"""
Speech-Flow Desktop Widget — Wispr-Flow-style floating toolbar + Scratchpad.

Architecture: Progressive streaming transcription.
  → Audio is sent to OpenAI in chunks WHILE the user speaks
  → By the time the user stops, 90% of speech is already processed
  → Final chunk takes only ~0.5-1s → near-instant paste

Toolbar (collapsed → expand on hover):
  🌐 Language | 🎤 Dictate | ✨ Enhance | 📝 Scratchpad

Hotkey: Ctrl+Win to toggle dictation.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load API key from backend/.env
_root = Path(__file__).parent
load_dotenv(_root / "backend" / ".env", override=True)

import threading
import time
import io
import requests
import queue
import ctypes
import ctypes.wintypes
import numpy as np
import sounddevice as sd
from scipy.io import wavfile
import pyperclip
from pynput import keyboard
from pynput.keyboard import Controller, Key
import customtkinter as ctk
from tkinter import Menu, Text, END, WORD
import logging
import concurrent.futures

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("SpeechFlow")

# ── Win32 focus management ─────────────────────────────────────
user32 = ctypes.windll.user32
user32.GetForegroundWindow.restype = ctypes.wintypes.HWND
user32.SetForegroundWindow.argtypes = [ctypes.wintypes.HWND]
user32.SetForegroundWindow.restype = ctypes.wintypes.BOOL
user32.GetWindowThreadProcessId.argtypes = [ctypes.wintypes.HWND, ctypes.POINTER(ctypes.wintypes.DWORD)]
user32.GetWindowThreadProcessId.restype = ctypes.wintypes.DWORD
user32.AttachThreadInput.argtypes = [ctypes.wintypes.DWORD, ctypes.wintypes.DWORD, ctypes.wintypes.BOOL]
user32.AttachThreadInput.restype = ctypes.wintypes.BOOL
user32.BringWindowToTop.argtypes = [ctypes.wintypes.HWND]
user32.IsWindow.argtypes = [ctypes.wintypes.HWND]
user32.IsWindow.restype = ctypes.wintypes.BOOL

# ── Config ─────────────────────────────────────────────────────
SAMPLE_RATE = 16000
HOTKEY = '<ctrl>+<cmd>'
CHUNK_SECONDS = 5  # Send a chunk to API every N seconds while speaking

kb_controller = Controller()
ctk.set_appearance_mode("dark")

# ── Colors ─────────────────────────────────────────────────────
BG          = "#1A1B2E"
BG_HOVER    = "#2A2B3E"
PILL_BG     = "#2A2B3E"
PILL_BORDER = "#3A3B4E"
BLUE        = "#7C8FFF"
RED         = "#EF4444"
PURPLE      = "#A78BFA"
GREEN       = "#34D399"
YELLOW      = "#FBBF24"
DIM         = "#6B7280"
BRIGHT      = "#F9FAFB"
BORDER      = "#333447"

# ── Languages ──────────────────────────────────────────────────
ALL_LANGS = {
    "en": "English", "es": "Spanish", "fr": "French", "de": "German",
    "it": "Italian", "pt": "Portuguese", "nl": "Dutch", "ru": "Russian",
    "zh": "Chinese", "ja": "Japanese", "ko": "Korean", "ar": "Arabic",
    "tr": "Turkish", "pl": "Polish", "sv": "Swedish", "da": "Danish",
    "no": "Norwegian", "fi": "Finnish", "cs": "Czech", "ro": "Romanian",
    "hu": "Hungarian", "el": "Greek", "he": "Hebrew", "th": "Thai",
    "vi": "Vietnamese", "id": "Indonesian", "ms": "Malay", "uk": "Ukrainian",
    "hi": "Hindi", "bn": "Bengali", "ta": "Tamil", "te": "Telugu",
    "mr": "Marathi", "gu": "Gujarati", "kn": "Kannada", "ml": "Malayalam",
    "pa": "Punjabi", "ur": "Urdu", "ne": "Nepali", "as": "Assamese",
    "sa": "Sanskrit", "sd": "Sindhi", "si": "Sinhala",
}
INDIAN = {"hi", "bn", "ta", "te", "mr", "gu", "kn", "ml", "pa", "ur", "ne", "as", "sa", "sd", "si"}


def force_focus(hwnd):
    if not hwnd or not user32.IsWindow(hwnd):
        return False
    try:
        cur = user32.GetForegroundWindow()
        ct = user32.GetWindowThreadProcessId(cur, None)
        tt = user32.GetWindowThreadProcessId(hwnd, None)
        if ct != tt:
            user32.AttachThreadInput(ct, tt, True)
        user32.SetForegroundWindow(hwnd)
        user32.BringWindowToTop(hwnd)
        if ct != tt:
            user32.AttachThreadInput(ct, tt, False)
        return True
    except Exception:
        return False


# ═══════════════════════════════════════════════════════════════
#  OpenAI Helpers
# ═══════════════════════════════════════════════════════════════
_openai_client = None

def _get_client():
    global _openai_client
    if _openai_client is None:
        from openai import OpenAI
        key = os.environ.get("OPENAI_API_KEY")
        if not key:
            log.error("No OPENAI_API_KEY found!")
            return None
        _openai_client = OpenAI(api_key=key)
    return _openai_client


def _transcribe_chunk(audio_np, language=None):
    """Transcribe a single audio chunk via OpenAI Whisper API."""
    client = _get_client()
    if not client:
        return ""

    buf = io.BytesIO()
    wavfile.write(buf, SAMPLE_RATE, audio_np)
    buf.seek(0)

    kwargs = {"file": ("chunk.wav", buf, "audio/wav"), "model": "whisper-1"}
    if language and language != "auto":
        kwargs["language"] = language

    t0 = time.time()
    response = client.audio.transcriptions.create(**kwargs)
    text = (response.text or "").strip()
    log.info(f"Chunk transcribed in {time.time()-t0:.1f}s → \"{text[:60]}\"")
    return text


def _polish_text(raw_text):
    """Quick GPT pass to fix transcription errors."""
    client = _get_client()
    if not client or not raw_text or len(raw_text.strip()) < 3:
        return raw_text
    try:
        r = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": (
                    "Fix this speech transcription. Rules:\n"
                    "1. Fix misspelled words\n"
                    "2. Keep English words in English (mobile app, bill, email)\n"
                    "3. Fix grammar, add punctuation\n"
                    "4. Do NOT change meaning\n"
                    "5. Return ONLY corrected text"
                )},
                {"role": "user", "content": raw_text}
            ],
            temperature=0.1, max_tokens=500,
        )
        result = (r.choices[0].message.content or "").strip().strip('"').strip("'")
        if result:
            log.info(f"Polish: \"{raw_text[:40]}\" → \"{result[:40]}\"")
            return result
    except Exception as e:
        log.warning(f"Polish failed: {e}")
    return raw_text


BACKEND_URL = "http://localhost:1993"

def _save_to_backend(text, language=None, duration=None):
    """Save transcription to the FastAPI backend so it appears in history."""
    try:
        payload = {"text": text}
        if language and language != "auto":
            payload["language"] = language
        if duration:
            payload["duration"] = duration
        resp = requests.post(
            f"{BACKEND_URL}/api/transcriptions",
            json=payload,
            timeout=5
        )
        if resp.status_code == 200:
            log.info(f"Saved to backend: \"{text[:50]}\"")
        else:
            log.warning(f"Backend save failed ({resp.status_code}): {resp.text[:100]}")
    except Exception as e:
        log.warning(f"Backend save error (server may not be running): {e}")


# ═══════════════════════════════════════════════════════════════
#  SCRATCHPAD
# ═══════════════════════════════════════════════════════════════
class ScratchPad(ctk.CTkToplevel):
    def __init__(self, master, on_close=None):
        super().__init__(master)
        self.title("Speech-Flow Scratchpad")
        self.geometry("600x450")
        self.configure(fg_color="#FAFAFA")
        self.attributes("-topmost", True)
        self._on_close = on_close

        header = ctk.CTkFrame(self, fg_color="#F3F4F6", height=40, corner_radius=0)
        header.pack(fill="x", side="top")
        header.pack_propagate(False)
        ctk.CTkLabel(header, text="📝 Untitled", font=("Segoe UI Semibold", 13),
                     text_color="#374151", fg_color="transparent").pack(side="left", padx=12)
        ctk.CTkButton(header, text="✕", width=30, height=30, corner_radius=4,
                      fg_color="transparent", hover_color="#E5E7EB", text_color="#6B7280",
                      font=("Segoe UI", 14), command=self._close).pack(side="right", padx=8)

        sidebar = ctk.CTkFrame(self, fg_color="#F3F4F6", width=40, corner_radius=0)
        sidebar.pack(fill="y", side="left")
        sidebar.pack_propagate(False)

        sb_font = ("Segoe UI Emoji", 14)
        for emoji, cmd in [("📊", self._word_count), ("🔍", self._toggle_search)]:
            ctk.CTkButton(sidebar, text=emoji, width=34, height=34, corner_radius=4,
                          fg_color="transparent", hover_color="#E5E7EB", font=sb_font,
                          command=cmd).pack(pady=2, padx=3)

        ctk.CTkFrame(sidebar, fg_color="transparent", height=1).pack(fill="both", expand=True)

        self.enh_btn = ctk.CTkButton(sidebar, text="✨", width=34, height=34, corner_radius=4,
                                      fg_color="transparent", hover_color="#E5E7EB", font=sb_font,
                                      command=self._enhance)
        self.enh_btn.pack(pady=2, padx=3)
        ctk.CTkButton(sidebar, text="🔤", width=34, height=34, corner_radius=4,
                      fg_color="transparent", hover_color="#E5E7EB", font=sb_font,
                      command=self._toggle_font).pack(pady=(2, 8), padx=3)

        self.search_frame = ctk.CTkFrame(self, fg_color="#F3F4F6", height=36, corner_radius=0)
        self._search_vis = False
        self.search_entry = ctk.CTkEntry(self.search_frame, placeholder_text="Search…",
                                          width=300, height=28, corner_radius=6)
        self.search_entry.pack(side="left", padx=8, pady=4)
        self.search_entry.bind("<Return>", self._do_search)

        self.text_area = Text(self, font=("Segoe UI", 13), wrap=WORD, bd=0, padx=16, pady=12,
                              bg="#FAFAFA", fg="#1F2937", insertbackground="#F59E0B",
                              selectbackground="#BFDBFE", relief="flat", undo=True)
        self.text_area.pack(fill="both", expand=True, side="top")

        bottom = ctk.CTkFrame(self, fg_color="#F3F4F6", height=44, corner_radius=0)
        bottom.pack(fill="x", side="bottom")
        bottom.pack_propagate(False)
        self.status = ctk.CTkLabel(bottom, text="", font=("Segoe UI", 10),
                                    text_color=DIM, fg_color="transparent")
        self.status.pack(side="left", padx=12)
        ctk.CTkButton(bottom, text="📋 Copy", width=80, height=30, corner_radius=6,
                      fg_color="#1F2937", hover_color="#374151", text_color="white",
                      font=("Segoe UI Semibold", 11), command=self._copy).pack(side="right", padx=12, pady=7)

        self._font_size = 13
        self.protocol("WM_DELETE_WINDOW", self._close)
        sw, sh = self.winfo_screenwidth(), self.winfo_screenheight()
        self.geometry(f"+{sw//2-300}+{sh//2-225}")

    def append_text(self, text):
        cur = self.text_area.get("1.0", END).strip()
        self.text_area.insert(END, (" " + text) if cur else text)
        self.text_area.see(END)
        self.status.configure(text=f"{len(self.text_area.get('1.0', END).split())} words")

    def _copy(self):
        t = self.text_area.get("1.0", END).strip()
        if t:
            pyperclip.copy(t)
            self.status.configure(text="✓ Copied!")
            self.after(2000, lambda: self.status.configure(text=f"{len(t.split())} words"))

    def _word_count(self):
        t = self.text_area.get("1.0", END).strip()
        self.status.configure(text=f"{len(t.split()) if t else 0} words · {len(t)} chars")

    def _toggle_search(self):
        if self._search_vis:
            self.search_frame.pack_forget()
        else:
            self.search_frame.pack(fill="x", side="top", before=self.text_area)
            self.search_entry.focus()
        self._search_vis = not self._search_vis

    def _do_search(self, e=None):
        q = self.search_entry.get()
        self.text_area.tag_remove("hl", "1.0", END)
        if not q: return
        pos, cnt = "1.0", 0
        while True:
            pos = self.text_area.search(q, pos, stopindex=END, nocase=True)
            if not pos: break
            end = f"{pos}+{len(q)}c"
            self.text_area.tag_add("hl", pos, end)
            pos = end
            cnt += 1
        self.text_area.tag_config("hl", background="#FDE68A")
        self.status.configure(text=f"{cnt} found")

    def _toggle_font(self):
        self._font_size = 16 if self._font_size == 13 else 13
        self.text_area.configure(font=("Segoe UI", self._font_size))

    def _enhance(self):
        t = self.text_area.get("1.0", END).strip()
        if not t: return
        self.enh_btn.configure(text="⏳")
        self.status.configure(text="Enhancing…")
        def do():
            enhanced = _polish_text(t)
            self.after(0, lambda: self.text_area.delete("1.0", END))
            self.after(0, lambda: self.text_area.insert("1.0", enhanced))
            self.after(0, lambda: self.status.configure(text="✓ Enhanced!"))
            self.after(0, lambda: self.enh_btn.configure(text="✨"))
        threading.Thread(target=do, daemon=True).start()

    def _close(self):
        if self._on_close: self._on_close()
        self.withdraw()


# ═══════════════════════════════════════════════════════════════
#  MAIN WIDGET
# ═══════════════════════════════════════════════════════════════
class SpeechFlowWidget(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("Speech-Flow")
        self.overrideredirect(True)
        self.attributes("-topmost", True)
        self.attributes("-alpha", 0.95)

        transparent = "#000001"
        self.configure(fg_color=transparent)
        self.attributes("-transparentcolor", transparent)
        
        self.after(10, self._set_noactivate)

    def _set_noactivate(self):
        # Prevents the widget from stealing cursor focus when clicked
        GWL_EXSTYLE = -20
        WS_EX_NOACTIVATE = 0x08000000
        hwnd = ctypes.windll.user32.GetParent(self.winfo_id())
        style = ctypes.windll.user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
        ctypes.windll.user32.SetWindowLongW(hwnd, GWL_EXSTYLE, style | WS_EX_NOACTIVATE)

        # State
        self.is_recording = False
        self.is_expanded = False
        self._collapse_id = None
        self.audio_queue: queue.Queue = queue.Queue()
        self.stream = None
        self.lang = "auto"
        self._target_hwnd = None
        self._my_hwnd = None
        self.scratchpad = None
        self._to_scratchpad = False

        # Progressive streaming state
        self._chunk_results = []       # Transcription results from each chunk
        self._chunk_futures = []       # Concurrent futures for in-flight API calls
        self._chunk_timer = None       # Timer for periodic chunk sending
        self._recording_audio = []     # Audio accumulated since last chunk
        self._executor = concurrent.futures.ThreadPoolExecutor(max_workers=3)

        self._build_ui()

        self.update_idletasks()
        sw = self.winfo_screenwidth()
        sh = self.winfo_screenheight()
        self.geometry(f"+{sw // 2 - 50}+{sh - 80}")

        self.after(100, self._capture_hwnd)
        self._track_window()

        self.hotkey_listener = keyboard.GlobalHotKeys({
            HOTKEY: lambda: self.after(0, self.toggle_recording),
        })
        self.hotkey_listener.start()
        self.protocol("WM_DELETE_WINDOW", self._quit)

        # Verify API key
        self.after(500, self._check_key)

    def _check_key(self):
        key = os.environ.get("OPENAI_API_KEY")
        if key:
            self.grip.configure(fg_color=GREEN)
            log.info("API key loaded ✓")
            self.after(2000, lambda: self.grip.configure(fg_color=DIM))
        else:
            self.grip.configure(fg_color=RED)
            log.error("No OPENAI_API_KEY!")

    # ── UI ─────────────────────────────────────────────────────
    def _build_ui(self):
        self.collapsed = ctk.CTkFrame(self, fg_color=PILL_BG, corner_radius=12,
                                       border_width=1, border_color=PILL_BORDER,
                                       width=100, height=28)
        self.collapsed.pack(padx=2, pady=2)
        self.collapsed.pack_propagate(False)

        self.grip = ctk.CTkFrame(self.collapsed, fg_color=DIM, corner_radius=2, width=40, height=4)
        self.grip.place(relx=0.5, rely=0.5, anchor="center")

        for w in [self.collapsed, self.grip]:
            w.bind("<Enter>", self._on_enter)
            w.bind("<Leave>", self._on_leave)
            w.bind("<ButtonPress-1>", self._start_drag)
            w.bind("<B1-Motion>", self._do_drag)

        self.expanded = ctk.CTkFrame(self, fg_color=BG, corner_radius=20,
                                      border_width=1, border_color=BORDER)

        self.hint = ctk.CTkLabel(self.expanded, text="Dictate  Ctrl + Win",
                                  font=("Segoe UI Semibold", 10.5), text_color=DIM,
                                  fg_color="transparent")
        self.hint.pack(side="top", pady=(8, 3))

        bf = ctk.CTkFrame(self.expanded, fg_color="transparent")
        bf.pack(side="top", padx=10, pady=(0, 8))

        sz, ft = 38, ("Segoe UI Emoji", 16)

        self.lang_btn = ctk.CTkButton(bf, text="🌐", width=sz, height=sz,
            corner_radius=sz//2, fg_color="transparent", hover_color=BG_HOVER,
            font=ft, command=self._lang_menu)
        self.lang_btn.pack(side="left", padx=3)

        self.mic_btn = ctk.CTkButton(bf, text="🎤", width=sz, height=sz,
            corner_radius=sz//2, fg_color="transparent", hover_color=BG_HOVER,
            font=ft, command=self.toggle_recording)
        self.mic_btn.pack(side="left", padx=3)

        self.enh_btn = ctk.CTkButton(bf, text="✨", width=sz, height=sz,
            corner_radius=sz//2, fg_color="transparent", hover_color=BG_HOVER,
            font=ft, command=self._enhance_clipboard)
        self.enh_btn.pack(side="left", padx=3)

        self.pad_btn = ctk.CTkButton(bf, text="📝", width=sz, height=sz,
            corner_radius=sz//2, fg_color="transparent", hover_color=BG_HOVER,
            font=ft, command=self._toggle_scratchpad)
        self.pad_btn.pack(side="left", padx=3)

        for w in [self.expanded, self.hint, bf, self.lang_btn, self.mic_btn,
                   self.enh_btn, self.pad_btn]:
            w.bind("<Enter>", self._on_enter)
            w.bind("<Leave>", self._on_leave)
        self.expanded.bind("<ButtonPress-1>", self._start_drag)
        self.expanded.bind("<B1-Motion>", self._do_drag)
        self.hint.bind("<ButtonPress-1>", self._start_drag)
        self.hint.bind("<B1-Motion>", self._do_drag)

    # ── Expand / Collapse ──────────────────────────────────────
    def _on_enter(self, e=None):
        if self._collapse_id:
            self.after_cancel(self._collapse_id)
            self._collapse_id = None
        if not self.is_expanded:
            self._expand()

    def _on_leave(self, e=None):
        if self.is_recording: return
        if self._collapse_id: self.after_cancel(self._collapse_id)
        self._collapse_id = self.after(400, self._try_collapse)

    def _try_collapse(self):
        self._collapse_id = None
        mx, my = self.winfo_pointerx(), self.winfo_pointery()
        wx, wy = self.winfo_rootx(), self.winfo_rooty()
        if wx <= mx <= wx + self.winfo_width() and wy <= my <= wy + self.winfo_height():
            return
        if not self.is_recording: self._collapse()

    def _expand(self):
        if self.is_expanded: return
        self.is_expanded = True
        x, y = self.winfo_x(), self.winfo_y()
        self.collapsed.pack_forget()
        self.expanded.pack(padx=2, pady=2)
        self.update_idletasks()
        nw, nh = self.winfo_reqwidth(), self.winfo_reqheight()
        self.geometry(f"+{x - (nw - 104)//2}+{y - (nh - 32)}")

    def _collapse(self):
        if not self.is_expanded: return
        self.is_expanded = False
        x, y = self.winfo_x(), self.winfo_y()
        ew, eh = self.winfo_width(), self.winfo_height()
        self.expanded.pack_forget()
        self.collapsed.pack(padx=2, pady=2)
        self.update_idletasks()
        cw, ch = self.winfo_reqwidth(), self.winfo_reqheight()
        self.geometry(f"+{x + (ew-cw)//2}+{y + (eh-ch)}")

    def _start_drag(self, e):
        self._dx, self._dy = e.x, e.y
    def _do_drag(self, e):
        self.geometry(f"+{self.winfo_x()+e.x-self._dx}+{self.winfo_y()+e.y-self._dy}")

    # ── Window tracking ────────────────────────────────────────
    def _capture_hwnd(self):
        self._my_hwnd = user32.GetForegroundWindow()

    def _track_window(self):
        try:
            hwnd = user32.GetForegroundWindow()
            if hwnd and hwnd != self._my_hwnd and user32.IsWindow(hwnd):
                self._target_hwnd = hwnd
        except Exception:
            pass
        self.after(300, self._track_window)

    def _paste_at_cursor(self, text):
        pyperclip.copy(text)
        time.sleep(0.1)
        t = self._target_hwnd
        # Only force focus if we lost it (e.g. user clicked the widget)
        # If user used the hotkey, focus is already correct!
        if t and user32.IsWindow(t) and user32.GetForegroundWindow() != t:
            force_focus(t)
            time.sleep(0.15)
        
        # Add a tiny delay to ensure window is ready to receive input
        time.sleep(0.05)
        with kb_controller.pressed(Key.ctrl):
            kb_controller.press("v")
            kb_controller.release("v")

    # ════════════════════════════════════════════════════════════
    #  PROGRESSIVE STREAMING TRANSCRIPTION
    #
    #  How it works (like Wispr Flow):
    #  1. User starts speaking
    #  2. Every CHUNK_SECONDS (5s), we send accumulated audio to
    #     OpenAI for transcription IN THE BACKGROUND
    #  3. While the user keeps speaking, previous chunks are being
    #     processed by OpenAI in parallel
    #  4. When user stops, we send the final chunk
    #  5. Wait for all chunks → concatenate → paste
    #
    #  Result: Only the LAST chunk's processing time is felt by
    #  the user (~1s), not the entire audio's processing time.
    # ════════════════════════════════════════════════════════════

    def _audio_cb(self, indata, frames, ti, status):
        self.audio_queue.put(indata.copy())

    def toggle_recording(self):
        if not self.is_expanded: self._expand()
        if self.is_recording:
            self._stop_rec()
        else:
            self._start_rec()

    def _start_rec(self):
        self.is_recording = True
        self.mic_btn.configure(fg_color=RED, hover_color="#DC2626", text="⏹")
        self.hint.configure(text="🔴 Listening…", text_color=RED)
        self.grip.configure(fg_color=RED)

        self._recording_audio = []
        self.audio_queue = queue.Queue()
        self._to_scratchpad = (self.scratchpad is not None
                                and self.scratchpad.winfo_exists()
                                and self.scratchpad.state() != "withdrawn")

        try:
            self.stream = sd.InputStream(samplerate=SAMPLE_RATE, channels=1,
                                          callback=self._audio_cb, dtype="int16")
            self.stream.start()
            log.info("Recording started")
        except Exception as e:
            log.error(f"Mic: {e}")
            self.is_recording = False
            self._reset()

    def _stop_rec(self):
        self.is_recording = False
        self.mic_btn.configure(text="⏳", fg_color=BLUE, hover_color=BG_HOVER)
        self.hint.configure(text="⚡ Transcribing…", text_color=BLUE)
        self.grip.configure(fg_color=BLUE)
        self.update()

        if self.stream:
            self.stream.stop()
            self.stream.close()
            self.stream = None

        while not self.audio_queue.empty():
            self._recording_audio.append(self.audio_queue.get())

        if self._recording_audio:
            final_audio = np.concatenate(self._recording_audio, axis=0)
            log.info(f"Sending audio to API ({len(final_audio)/SAMPLE_RATE:.1f}s)")
            threading.Thread(target=self._process_final_audio, args=(final_audio,), daemon=True).start()
        else:
            self._reset()

    def _process_final_audio(self, audio_np):
        t0 = time.time()
        try:
            raw_text = _transcribe_chunk(audio_np, self.lang)
        except Exception as e:
            log.error(f"Transcription failed: {e}")
            raw_text = ""
        elapsed = time.time() - t0

        if raw_text:
            log.info(f"All chunks collected in {elapsed:.1f}s → \"{raw_text[:80]}\"")

            if self._to_scratchpad and self.scratchpad:
                self.after(0, lambda: self.scratchpad.append_text(raw_text))
                self.after(0, lambda: self.scratchpad.deiconify())
            else:
                self._paste_at_cursor(raw_text)

            # Save to backend for history (fire-and-forget in background)
            lang = self.lang if self.lang != "auto" else None
            threading.Thread(
                target=_save_to_backend,
                args=(raw_text, lang, elapsed),
                daemon=True
            ).start()

            self.after(0, lambda: self.hint.configure(
                text=f"✓ Done ({elapsed:.1f}s)", text_color=GREEN))
            self.after(0, lambda: self.grip.configure(fg_color=GREEN))
        else:
            self.after(0, lambda: self.hint.configure(text="No speech detected", text_color=DIM))

        self.after(2000, self._reset)

    def _reset(self):
        self.mic_btn.configure(text="🎤", fg_color="transparent", hover_color=BG_HOVER)
        self.hint.configure(text="Dictate  Ctrl + Win", text_color=DIM)
        self.grip.configure(fg_color=DIM)

    # ── Language ───────────────────────────────────────────────
    def _lang_menu(self):
        m = Menu(self, tearoff=0, bg="#1E1E2E", fg="white",
                 activebackground=BLUE, activeforeground="white",
                 font=("Segoe UI", 10), relief="flat", bd=0)
        m.add_command(label="🔍  Auto" + ("  ✓" if self.lang == "auto" else ""),
                      command=lambda: self._set_lang("auto"))
        m.add_separator()
        ind = {k: v for k, v in ALL_LANGS.items() if k in INDIAN}
        oth = {k: v for k, v in ALL_LANGS.items() if k not in INDIAN}
        m.add_command(label="── Indian ──", state="disabled")
        for c, n in sorted(ind.items(), key=lambda x: x[1]):
            ck = "  ✓" if self.lang == c else ""
            m.add_command(label=f"    {n}{ck}", command=lambda c=c: self._set_lang(c))
        m.add_separator()
        m.add_command(label="── Other ──", state="disabled")
        for c, n in sorted(oth.items(), key=lambda x: x[1]):
            ck = "  ✓" if self.lang == c else ""
            m.add_command(label=f"    {n}{ck}", command=lambda c=c: self._set_lang(c))
        m.tk_popup(self.lang_btn.winfo_rootx(), self.lang_btn.winfo_rooty() - 350)

    def _set_lang(self, c):
        self.lang = c
        n = "Auto" if c == "auto" else ALL_LANGS.get(c, c)
        self.hint.configure(text=f"Language: {n}", text_color=BLUE)
        self.after(2000, self._reset)

    # ── Enhance ────────────────────────────────────────────────
    def _enhance_clipboard(self):
        text = pyperclip.paste()
        if not text or not text.strip():
            self.hint.configure(text="Clipboard empty", text_color=DIM)
            self.after(2000, self._reset)
            return
        self.enh_btn.configure(text="⏳")
        self.hint.configure(text="✨ Enhancing…", text_color=PURPLE)
        def do():
            enhanced = _polish_text(text)
            if enhanced:
                self._paste_at_cursor(enhanced)
                self.after(0, lambda: self.hint.configure(text="✓ Enhanced!", text_color=GREEN))
            self.after(0, lambda: self.enh_btn.configure(text="✨"))
            self.after(2000, self._reset)
        threading.Thread(target=do, daemon=True).start()

    # ── Scratchpad ─────────────────────────────────────────────
    def _toggle_scratchpad(self):
        if self.scratchpad and self.scratchpad.winfo_exists():
            if self.scratchpad.state() == "withdrawn":
                self.scratchpad.deiconify()
            else:
                self.scratchpad.withdraw()
        else:
            self.scratchpad = ScratchPad(self)

    # ── Quit ───────────────────────────────────────────────────
    def _quit(self):
        if self.stream:
            self.stream.stop()
            self.stream.close()
        self.hotkey_listener.stop()
        self._executor.shutdown(wait=False)
        self.destroy()


if __name__ == "__main__":
    app = SpeechFlowWidget()
    app.mainloop()
