import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Send, Brain, Trash2, Plus, Volume2, Loader2, Sparkles, User, Bot } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const SESSION_ID = 'web-assistant';

const VOICE_OPTIONS = [
  { id: 'nova', label: 'Nova' },
  { id: 'alloy', label: 'Alloy' },
  { id: 'echo', label: 'Echo' },
  { id: 'onyx', label: 'Onyx' },
  { id: 'shimmer', label: 'Shimmer' },
  { id: 'sage', label: 'Sage' },
];

const VoiceAssistant = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [recording, setRecording] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [voice, setVoice] = useState('nova');
  const [memory, setMemory] = useState([]);
  const [newMemory, setNewMemory] = useState('');

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioRef = useRef(null);
  const scrollEndRef = useRef(null);

  const fetchMemory = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/memory`);
      setMemory(res.data);
    } catch (e) {
      console.error('memory fetch error', e);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/assistant/history`, { params: { session_id: SESSION_ID } });
      const msgs = [];
      res.data.forEach((m) => {
        msgs.push({ role: 'user', text: m.user_text });
        msgs.push({ role: 'assistant', text: m.assistant_text });
      });
      setMessages(msgs);
    } catch (e) {
      console.error('history fetch error', e);
    }
  }, []);

  useEffect(() => {
    fetchMemory();
    fetchHistory();
  }, [fetchMemory, fetchHistory]);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  const playAudio = (b64) => {
    if (!b64) return;
    try {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(`data:audio/mp3;base64,${b64}`);
      audioRef.current = audio;
      audio.play().catch(() => {});
    } catch (e) {
      console.error('audio play error', e);
    }
  };

  const sendText = async (text) => {
    if (!text.trim()) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setThinking(true);
    try {
      const res = await axios.post(`${API}/assistant/text`, {
        text, session_id: SESSION_ID, voice, speak: true,
      });
      setMessages((prev) => [...prev, { role: 'assistant', text: res.data.reply_text, audio: res.data.reply_audio_base64 }]);
      playAudio(res.data.reply_audio_base64);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Assistant failed');
    } finally {
      setThinking(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await sendVoice(blob);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (e) {
      toast.error('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const sendVoice = async (blob) => {
    setThinking(true);
    const formData = new FormData();
    formData.append('file', blob, 'speech.webm');
    try {
      const res = await axios.post(`${API}/assistant/voice`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        params: { session_id: SESSION_ID, voice },
      });
      setMessages((prev) => [
        ...prev,
        { role: 'user', text: res.data.transcript },
        { role: 'assistant', text: res.data.reply_text, audio: res.data.reply_audio_base64 },
      ]);
      playAudio(res.data.reply_audio_base64);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not process your voice');
    } finally {
      setThinking(false);
    }
  };

  const addMemory = async () => {
    if (!newMemory.trim()) return;
    try {
      await axios.post(`${API}/memory`, { content: newMemory.trim(), category: 'general' });
      setNewMemory('');
      fetchMemory();
      toast.success('Saved to memory');
    } catch (e) {
      toast.error('Failed to save memory');
    }
  };

  const deleteMemory = async (id) => {
    try {
      await axios.delete(`${API}/memory/${id}`);
      fetchMemory();
    } catch (e) {
      toast.error('Failed to delete');
    }
  };

  const clearChat = async () => {
    try {
      await axios.delete(`${API}/assistant/history`, { params: { session_id: SESSION_ID } });
      setMessages([]);
      toast.success('Conversation cleared');
    } catch (e) {
      toast.error('Failed to clear');
    }
  };

  return (
    <div className="flex-1 flex bg-background overflow-hidden" data-testid="voice-assistant">
      {/* Conversation column */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="px-8 py-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tighter text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Voice Assistant
              </h2>
              <p className="text-xs text-muted-foreground">Speaks with your memory · replies aloud · any language</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              className="text-sm bg-secondary border border-border rounded-sm px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="voice-select"
            >
              {VOICE_OPTIONS.map((v) => (
                <option key={v.id} value={v.id}>{v.label} voice</option>
              ))}
            </select>
            <Button variant="outline" size="sm" className="rounded-sm" onClick={clearChat} data-testid="clear-chat-button">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-8 py-6">
          <div className="max-w-3xl mx-auto space-y-5">
            {messages.length === 0 && !thinking && (
              <div className="text-center py-20" data-testid="assistant-empty">
                <motion.div
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
                  className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5"
                >
                  <Mic className="w-9 h-9 text-primary" />
                </motion.div>
                <h3 className="text-2xl font-black tracking-tight text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  Tap the mic and talk to me
                </h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                  I remember what you teach me and reply out loud in your chosen voice — in the same language you speak.
                </p>
              </div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
                  data-testid={`message-${m.role}-${i}`}
                >
                  <div className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-foreground text-background' : 'bg-primary text-primary-foreground'}`}>
                    {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className={`max-w-[75%] rounded-sm px-4 py-3 ${m.role === 'user' ? 'bg-foreground text-background' : 'bg-secondary text-foreground border border-border'}`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</p>
                    {m.role === 'assistant' && m.audio && (
                      <button
                        onClick={() => playAudio(m.audio)}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                        data-testid={`replay-audio-${i}`}
                      >
                        <Volume2 className="w-3.5 h-3.5" /> Play voice
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {thinking && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3" data-testid="assistant-thinking">
                <div className="w-8 h-8 rounded-sm bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-secondary border border-border rounded-sm px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Thinking…</span>
                </div>
              </motion.div>
            )}
            <div ref={scrollEndRef} />
          </div>
        </ScrollArea>

        {/* Input bar */}
        <div className="px-8 py-5 border-t border-border">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <motion.button
              onClick={recording ? stopRecording : startRecording}
              whileTap={{ scale: 0.92 }}
              className={`relative w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors ${recording ? 'bg-destructive text-white' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
              data-testid="mic-button"
              title={recording ? 'Stop & send' : 'Hold a conversation'}
            >
              {recording && (
                <motion.span
                  className="absolute inset-0 rounded-full bg-destructive/40"
                  animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                />
              )}
              {recording ? <Square className="w-5 h-5 relative z-10" /> : <Mic className="w-5 h-5 relative z-10" />}
            </motion.button>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendText(input)}
              placeholder={recording ? 'Listening… tap stop when done' : 'Type or speak to your assistant…'}
              disabled={recording}
              className="flex-1 rounded-sm bg-secondary"
              data-testid="assistant-input"
            />
            <Button
              onClick={() => sendText(input)}
              disabled={!input.trim() || thinking}
              className="rounded-sm bg-primary hover:bg-primary/90"
              data-testid="assistant-send-button"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Memory panel */}
      <div className="w-[320px] border-l border-border bg-secondary flex flex-col" data-testid="memory-panel">
        <div className="px-5 py-5 border-b border-border flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-base font-black tracking-tight text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Personal Memory
            </h3>
            <p className="text-xs text-muted-foreground">Facts the assistant uses about you</p>
          </div>
        </div>
        <div className="px-5 py-4 border-b border-border">
          <div className="flex gap-2">
            <Input
              value={newMemory}
              onChange={(e) => setNewMemory(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addMemory()}
              placeholder="e.g. I work at Acme as a designer"
              className="text-sm rounded-sm bg-background"
              data-testid="memory-input"
            />
            <Button onClick={addMemory} size="sm" className="bg-primary hover:bg-primary/90 rounded-sm" data-testid="add-memory-button">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <ScrollArea className="flex-1 px-5 py-4">
          <div className="space-y-2">
            {memory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8" data-testid="empty-memory">
                No memories yet. Teach the assistant about yourself, your contacts and preferences.
              </p>
            ) : (
              memory.map((m) => (
                <div
                  key={m.id}
                  className="group bg-background border border-border rounded-sm p-3 flex items-start justify-between gap-2 hover:border-primary/40 transition-colors"
                  data-testid={`memory-item-${m.id}`}
                >
                  <p className="text-sm text-foreground leading-snug">{m.content}</p>
                  <button
                    onClick={() => deleteMemory(m.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded shrink-0"
                    data-testid={`delete-memory-${m.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default VoiceAssistant;
