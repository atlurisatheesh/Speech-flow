import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, Settings2, HelpCircle, Activity, 
  TrendingUp, Sparkles, Wand2, BookA, 
  Scissors, PenTool
} from 'lucide-react';
import './index.css';
import { HomeView } from './features/history/components/HomeView';
import { InsightsView } from './features/insights/components/InsightsView';
import { Sparkline } from './features/insights/components/Sparkline';
import { DictionaryView } from './features/dictionary/components/DictionaryView';
import { SnippetsView } from './features/snippets/components/SnippetsView';
import { PlaceholderView } from './features/core/components/PlaceholderView';
import { VoiceProfilesView } from './features/voice-profiles/components/VoiceProfilesView';


declare global {
  interface Window {
    electron: {
      onToggleDictation: (cb: () => void) => () => void;
      transcribeFinal: (audioBlob: ArrayBuffer) => Promise<string>;
    }
  }
}

const BACKEND_URL = 'http://localhost:1993';

// Types for history
interface HistoryItem {
  id: string;
  time: string;
  text: string;
}

interface HistoryGroup {
  date: string;
  items: HistoryItem[];
}

interface TranscriptionFromAPI {
  id: string;
  text: string;
  timestamp: string;
  language?: string;
  duration?: number;
}

/**
 * Group transcriptions from the API into date-grouped format for the timeline.
 */
function groupTranscriptionsByDate(transcriptions: TranscriptionFromAPI[]): HistoryGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);

  const groups: Map<string, HistoryItem[]> = new Map();

  for (const t of transcriptions) {
    const date = new Date(t.timestamp);
    const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    let dateLabel: string;
    if (dateDay.getTime() === today.getTime()) {
      dateLabel = 'Today';
    } else if (dateDay.getTime() === yesterday.getTime()) {
      dateLabel = 'Yesterday';
    } else {
      dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const item: HistoryItem = { id: t.id, time: timeString, text: t.text };

    if (!groups.has(dateLabel)) {
      groups.set(dateLabel, []);
    }
    groups.get(dateLabel)!.push(item);
  }

  // Convert map to array (already sorted by timestamp desc from API)
  const result: HistoryGroup[] = [];
  for (const [date, items] of groups) {
    result.push({ date, items });
  }
  return result;
}

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [isRecording, setIsRecording] = useState(false);
  const [history, setHistory] = useState<HistoryGroup[]>([]);
  const [totalWords, setTotalWords] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [analytics, setAnalytics] = useState<any>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Audio Recording Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  /**
   * Fetch transcription history from the backend.
   */
  const fetchHistory = useCallback(async (query?: string) => {
    try {
      const params = query ? `?q=${encodeURIComponent(query)}` : '';
      const res = await fetch(`${BACKEND_URL}/api/transcriptions${params}`);
      if (res.ok) {
        const data: TranscriptionFromAPI[] = await res.json();
        const grouped = groupTranscriptionsByDate(data);
        setHistory(grouped);
        if (!query) {
          const words = data.reduce((acc, t) => acc + t.text.split(/\s+/).filter(Boolean).length, 0);
          setTotalWords(words);
        }
      }
    } catch (err) {
      console.warn('Could not fetch history from backend:', err);
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/analytics`);
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
        setTotalWords(data.total_words);
      }
    } catch (err) {
      console.warn('Could not fetch analytics:', err);
    }
  }, []);

  // Debounced search
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetchHistory(query || undefined);
    }, 300);
  }, [fetchHistory]);

  // WebSocket for real-time sync + fallback polling
  useEffect(() => {
    fetchHistory();
    fetchAnalytics();

    // Connect WebSocket for instant updates
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    
    const connectWs = () => {
      try {
        ws = new WebSocket('ws://localhost:1993/ws/clipboard');
        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type === 'new_transcription') {
            // Instant refresh when a new transcription arrives from any device
            fetchHistory(searchQuery || undefined);
            fetchAnalytics();
          }
        };
        ws.onclose = () => {
          // Reconnect after 5s if disconnected
          reconnectTimer = setTimeout(connectWs, 5000);
        };
      } catch {
        reconnectTimer = setTimeout(connectWs, 5000);
      }
    };
    connectWs();

    // Fallback polling every 30s in case WebSocket fails
    const interval = setInterval(() => {
      fetchHistory(searchQuery || undefined);
      fetchAnalytics();
    }, 30000);

    return () => {
      clearInterval(interval);
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [fetchHistory, fetchAnalytics]);

  useEffect(() => {
    // Listen for global hotkey to toggle recording
    const cleanup = window.electron.onToggleDictation(() => {
      toggleRecording();
    });
    return cleanup;
  }, [isRecording]); // Need to depend on isRecording to toggle correctly

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const arrayBuffer = await audioBlob.arrayBuffer();
        
        // Send to backend for transcription and pasting
        const transcribedText = await window.electron.transcribeFinal(arrayBuffer);
        console.log("Transcribed:", transcribedText);
        
        if (transcribedText && !transcribedText.startsWith('Error')) {
          // Refresh history from backend (the main.ts handler saves to backend)
          setTimeout(fetchHistory, 500);
        }
        
        // Clean up tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  /**
   * Delete a transcription from the backend and refresh history.
   */
  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/transcriptions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        // Remove from local state immediately for responsive UI
        setHistory(prev => prev.map(group => ({
          ...group,
          items: group.items.filter(item => item.id !== id)
        })).filter(group => group.items.length > 0));
      }
    } catch (err) {
      console.error('Failed to delete transcription:', err);
    }
  }, []);

  /**
   * Copy transcription text to clipboard.
   */
  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for non-secure contexts
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'home': return <HomeView history={history} onDelete={handleDelete} onCopy={handleCopy} searchQuery={searchQuery} onSearchChange={handleSearchChange} />;
      case 'stats': return <InsightsView analytics={analytics} />;
      case 'dictate': return <VoiceProfilesView />;
      case 'dictionary': return <DictionaryView />;
      case 'snippets': return <SnippetsView />;
      case 'scratchpad': return <PlaceholderView title="Scratchpad" icon={PenTool} description="A distraction-free zone to dictate long-form content before pasting it elsewhere." />;
      default: return <HomeView history={history} onDelete={handleDelete} onCopy={handleCopy} searchQuery={searchQuery} onSearchChange={handleSearchChange} />;
    }
  };

  return (
    <div className="dashboard-layout">
      
      {/* EXPANDABLE FLOATING DOCK */}
      <div className="floating-dock">
        <div className="dock-logo">
          <Wand2 size={28} style={{ flexShrink: 0 }} />
          <span className="dock-label logo-text">Speech-Flow</span>
        </div>

        <div className="dock-menu">
          <button 
            className={`dock-item ${isRecording ? 'active' : ''}`} 
            style={isRecording ? { background: '#ef4444', boxShadow: '0 0 15px rgba(239,68,68,0.5)', color: 'white' } : {}}
            onClick={toggleRecording}
          >
            <Mic size={22} style={{ flexShrink: 0 }} />
            <span className="dock-label">{isRecording ? "Stop Dictation" : "Start Dictating"}</span>
          </button>
          
          <button 
            className={`dock-item ${activeTab === 'home' ? 'active' : ''}`} 
            onClick={() => setActiveTab('home')}
          >
            <Activity size={22} style={{ flexShrink: 0 }} />
            <span className="dock-label">History</span>
          </button>

          <button 
            className={`dock-item ${activeTab === 'stats' ? 'active' : ''}`} 
            onClick={() => setActiveTab('stats')}
          >
            <TrendingUp size={22} style={{ flexShrink: 0 }} />
            <span className="dock-label">Insights</span>
          </button>

          <button 
            className={`dock-item ${activeTab === 'dictate' ? 'active' : ''}`} 
            onClick={() => setActiveTab('dictate')}
          >
            <Sparkles size={22} style={{ flexShrink: 0 }} />
            <span className="dock-label">Voice Profiles</span>
          </button>
          <button 
            className={`dock-item ${activeTab === 'dictionary' ? 'active' : ''}`} 
            onClick={() => setActiveTab('dictionary')}
          >
            <BookA size={22} style={{ flexShrink: 0 }} />
            <span className="dock-label">Dictionary</span>
          </button>
          <button 
            className={`dock-item ${activeTab === 'snippets' ? 'active' : ''}`} 
            onClick={() => setActiveTab('snippets')}
          >
            <Scissors size={22} style={{ flexShrink: 0 }} />
            <span className="dock-label">Snippets</span>
          </button>
          <button 
            className={`dock-item ${activeTab === 'scratchpad' ? 'active' : ''}`} 
            onClick={() => setActiveTab('scratchpad')}
          >
            <PenTool size={22} style={{ flexShrink: 0 }} />
            <span className="dock-label">Scratchpad</span>
          </button>
        </div>

        <div className="dock-spacer" />

        <div className="dock-menu">
          <button className="dock-item">
            <Settings2 size={22} style={{ flexShrink: 0 }} />
            <span className="dock-label">Settings</span>
          </button>
          <button className="dock-item">
            <HelpCircle size={22} style={{ flexShrink: 0 }} />
            <span className="dock-label">Help</span>
          </button>
        </div>
      </div>

      {/* CENTRAL STAGE */}
      <div className="main-content">
        {renderContent()}
      </div>

      {/* RIGHT SIDEBAR (GLASS CARDS) */}
      <div className="right-sidebar">
        <div className="glass-card">
          <h3>Words Dictated</h3>
          <div className="stat-hero">
            <span className="number">{totalWords.toLocaleString()}</span>
            <span className="label">total words</span>
          </div>
          <Sparkline data={analytics?.daily_words} />
        </div>

        <div className="glass-card">
          <h3>Speaking Speed</h3>
          <div className="stat-hero">
            <span className="number">{analytics?.avg_wpm || 0}</span>
            <span className="label">wpm avg</span>
          </div>
        </div>

        <div className="glass-card">
          <h3>🔥 Streak</h3>
          <div className="stat-hero">
            <span className="number">{analytics?.streak || 0}</span>
            <span className="label">{(analytics?.streak || 0) === 1 ? 'day' : 'days'}</span>
          </div>
        </div>
        
        <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.1), rgba(168,85,247,0.1))' }}>
          <h3>Voice Profile</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6' }}>
            Your dictations are currently being styled as <strong>Professional &amp; Concise</strong>.
          </p>
        </div>
      </div>

    </div>
  );
}

export default App;
