import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, Radio } from 'lucide-react';
import { Button } from './ui/button';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

// Low-latency live dictation tuning
const SEND_INTERVAL = 1000;       // push an interim transcription roughly every 1s
const SILENCE_THRESHOLD = 0.08;   // normalized audio level below which we treat as a pause
const PAUSE_COMMIT_MS = 1200;     // commit the current segment after this much silence
const MAX_SEGMENT_MS = 12000;     // hard cap so a single segment never grows too large

const MicRecorder = ({ onRecordingComplete, onLiveText, apiUrl, disabled, language = 'auto' }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const mainRecorderRef = useRef(null);
  const allChunksRef = useRef([]); // full recording for final accurate save
  const timerRef = useRef(null);
  const animationRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const liveModeRef = useRef(false);
  const wsRef = useRef(null);

  // Live streaming refs
  const liveRecorderRef = useRef(null);
  const segFragsRef = useRef([]);
  const segStartRef = useRef(0);
  const committedRef = useRef('');
  const interimRef = useRef('');
  const seqRef = useRef(0);
  const sendIntervalRef = useRef(null);
  const audioLevelRef = useRef(0);
  const lastVoiceTimeRef = useRef(0);
  const mimeTypeRef = useRef('audio/webm');

  useEffect(() => {
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (sendIntervalRef.current) clearInterval(sendIntervalRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    if (wsRef.current) wsRef.current.close();
  };

  const emitLive = () => {
    const full = `${committedRef.current} ${interimRef.current}`.trim();
    onLiveText?.(full);
  };

  const startSegment = () => {
    if (!streamRef.current) return;
    segFragsRef.current = [];
    segStartRef.current = Date.now();
    const recorder = new MediaRecorder(streamRef.current, { mimeType: mimeTypeRef.current });
    liveRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) segFragsRef.current.push(e.data);
    };
    recorder.start(250); // emit data every 250ms for a continuous, self-contained segment
  };

  const commitSegment = () => {
    if (interimRef.current.trim()) {
      committedRef.current = `${committedRef.current} ${interimRef.current.trim()}`.trim();
    }
    interimRef.current = '';
    seqRef.current += 1; // invalidate any in-flight responses from the previous segment
    emitLive();
    const rec = liveRecorderRef.current;
    if (rec && rec.state === 'recording') {
      try { rec.stop(); } catch (e) { /* noop */ }
    }
    if (liveModeRef.current) startSegment();
  };

  const sendInterim = () => {
    if (!liveModeRef.current) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const segElapsed = Date.now() - segStartRef.current;
    const silentFor = Date.now() - lastVoiceTimeRef.current;

    // Commit on a natural pause (with something transcribed) or when the segment is too long
    if ((interimRef.current.trim() && silentFor > PAUSE_COMMIT_MS) || segElapsed > MAX_SEGMENT_MS) {
      commitSegment();
      return;
    }

    const frags = segFragsRef.current;
    if (!frags.length) return;
    const blob = new Blob(frags, { type: mimeTypeRef.current });
    if (blob.size < 1200) return;

    // Send continuity context + sequence id, then the audio for this segment
    ws.send(JSON.stringify({ prompt: committedRef.current.slice(-400), seq: seqRef.current }));
    ws.send(blob);
  };

  const startLiveStreaming = () => {
    const langQuery = language && language !== 'auto' ? `?language=${encodeURIComponent(language)}` : '';
    const wsUrl = apiUrl.replace(/^http/, 'ws') + '/transcribe/live' + langQuery;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    committedRef.current = '';
    interimRef.current = '';
    seqRef.current = 0;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.seq !== seqRef.current) return; // ignore stale results from a committed segment
        interimRef.current = data.text || '';
        emitLive();
      } catch (e) {
        console.error('WS message parse error:', e);
      }
    };

    ws.onopen = () => {
      startSegment();
      sendIntervalRef.current = setInterval(sendInterim, SEND_INTERVAL);
    };

    ws.onerror = (error) => console.error('Live WebSocket error:', error);
  };

  const startRecording = async (liveMode = false) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const updateLevel = () => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const level = avg / 128;
        audioLevelRef.current = level;
        if (level >= SILENCE_THRESHOLD) lastVoiceTimeRef.current = Date.now();
        setAudioLevel(level);
        animationRef.current = requestAnimationFrame(updateLevel);
      };
      lastVoiceTimeRef.current = Date.now();
      updateLevel();

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      mimeTypeRef.current = mimeType;

      // Main recorder: captures the whole take for a final, fully-accurate transcription on stop
      allChunksRef.current = [];
      const mainRecorder = new MediaRecorder(stream, { mimeType });
      mainRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) allChunksRef.current.push(e.data);
      };
      mainRecorder.onstop = () => {
        const blob = new Blob(allChunksRef.current, { type: mimeType });
        const ext = mimeType.includes('webm') ? 'webm' : 'mp4';
        const file = new File([blob], `recording-${Date.now()}.${ext}`, { type: mimeType });
        onRecordingComplete(file, blob);
        stream.getTracks().forEach((t) => t.stop());
        if (audioContext.state !== 'closed') audioContext.close();
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        setAudioLevel(0);
      };
      mainRecorder.start();
      mainRecorderRef.current = mainRecorder;

      if (liveMode) {
        liveModeRef.current = true;
        startLiveStreaming();
      }

      setIsRecording(true);
      setIsLiveMode(liveMode);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((p) => p + 1), 1000);
    } catch (error) {
      console.error('Recording error:', error);
      toast.error('Microphone access denied or unavailable');
    }
  };

  const stopRecording = () => {
    liveModeRef.current = false;
    if (sendIntervalRef.current) {
      clearInterval(sendIntervalRef.current);
      sendIntervalRef.current = null;
    }
    if (liveRecorderRef.current && liveRecorderRef.current.state === 'recording') {
      try { liveRecorderRef.current.stop(); } catch (e) { /* noop */ }
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (mainRecorderRef.current && isRecording) {
      mainRecorderRef.current.stop();
      setIsRecording(false);
      setIsLiveMode(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (isRecording) {
    return (
      <div className="flex flex-col items-center gap-3" data-testid="recording-active">
        <div className="relative">
          <motion.div
            animate={{ scale: 1 + audioLevel * 0.3 }}
            transition={{ duration: 0.1 }}
            className="absolute inset-0 bg-[#EF4444] rounded-full opacity-30"
          />
          <Button
            onClick={stopRecording}
            size="lg"
            className="relative bg-[#EF4444] hover:bg-[#DC2626] text-white px-8 py-6 text-base font-semibold rounded-sm transition-colors duration-200 pulse-recording"
            data-testid="stop-recording-button"
          >
            <Square className="w-5 h-5 mr-2 fill-current" />
            Stop {isLiveMode ? 'Live' : 'Recording'}
          </Button>
        </div>
        <div className="flex items-center gap-3 text-sm font-mono font-semibold">
          <div className="flex items-center gap-2 text-[#EF4444]" data-testid="recording-timer">
            <div className="w-2 h-2 bg-[#EF4444] rounded-full pulse-recording"></div>
            {formatTime(recordingTime)}
          </div>
          {isLiveMode && (
            <div className="flex items-center gap-1.5 text-[#002FA7]" data-testid="live-indicator">
              <Radio className="w-3.5 h-3.5" />
              <span className="uppercase tracking-wider text-xs">Live</span>
              <Loader2 className="w-3 h-3 animate-spin ml-1" />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2" data-testid="mic-recorder-controls">
      <Button
        onClick={() => startRecording(false)}
        disabled={disabled}
        size="lg"
        className="bg-[#EF4444] hover:bg-[#DC2626] text-white px-6 py-6 text-base font-semibold rounded-sm transition-colors duration-200 shadow-lg"
        data-testid="start-recording-button"
      >
        <Mic className="w-5 h-5 mr-2" />
        Record
      </Button>
      <Button
        onClick={() => startRecording(true)}
        disabled={disabled}
        size="lg"
        variant="outline"
        className="bg-white border-2 border-[#EF4444] text-[#EF4444] hover:bg-[#EF4444] hover:text-white px-6 py-6 text-base font-semibold rounded-sm transition-colors duration-200 shadow-lg"
        data-testid="start-live-recording-button"
      >
        <Radio className="w-5 h-5 mr-2" />
        Live
      </Button>
    </div>
  );
};

export default MicRecorder;
