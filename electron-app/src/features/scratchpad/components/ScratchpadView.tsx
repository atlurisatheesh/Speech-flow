import { useState, useRef } from 'react';
import { Mic, Square, Wand2, Copy, Trash2, Check } from 'lucide-react';

const electron = (window as any).electron;

export const ScratchpadView = () => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const buffer = await blob.arrayBuffer();
        setBusy(true);
        try {
          const result: string = await electron.transcribeText(buffer);
          if (result && !result.startsWith('Error')) {
            setText((prev) => (prev ? `${prev} ${result}` : result));
          }
        } finally {
          setBusy(false);
        }
      };
      mr.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Recording failed:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const cleanWithAI = async () => {
    if (!text.trim() || !electron?.enhanceText) return;
    setBusy(true);
    try {
      const cleaned = await electron.enhanceText(text);
      if (cleaned) setText(cleaned);
    } finally {
      setBusy(false);
    }
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  };

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', paddingRight: '20px' }}>
      <div className="page-header">
        <h1>Scratchpad</h1>
        <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{wordCount} words</span>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <button
          className="btn-primary"
          onClick={isRecording ? stopRecording : startRecording}
          style={isRecording ? { background: '#ef4444' } : {}}
        >
          {isRecording ? <Square size={16} /> : <Mic size={16} />}
          <span style={{ marginLeft: 6 }}>{isRecording ? 'Stop' : 'Dictate'}</span>
        </button>
        <button className="btn-primary" onClick={cleanWithAI} disabled={busy || !text.trim()} style={{ background: '#8b5cf6' }}>
          <Wand2 size={16} /><span style={{ marginLeft: 6 }}>Clean with AI</span>
        </button>
        <button className="btn-primary" onClick={copyText} disabled={!text.trim()} style={{ background: '#10b981' }}>
          {copied ? <Check size={16} /> : <Copy size={16} />}<span style={{ marginLeft: 6 }}>{copied ? 'Copied' : 'Copy'}</span>
        </button>
        <button className="btn-primary" onClick={() => setText('')} disabled={!text.trim()} style={{ background: '#6b7280' }}>
          <Trash2 size={16} /><span style={{ marginLeft: 6 }}>Clear</span>
        </button>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={busy ? 'Transcribing…' : 'Dictate or type long-form content here, clean it with AI, then copy it anywhere…'}
        style={{
          flex: 1, width: '100%', resize: 'none', padding: '20px',
          borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '16px',
          lineHeight: 1.7, fontFamily: 'inherit', outline: 'none',
        }}
      />
    </div>
  );
};
