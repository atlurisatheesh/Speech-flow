import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, Radio } from 'lucide-react';
import { Button } from './ui/button';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import axios from 'axios';

const CHUNK_INTERVAL = 5000; // 5 seconds per chunk

const MicRecorder = ({ onRecordingComplete, onLiveText, apiUrl, disabled }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [chunksTranscribing, setChunksTranscribing] = useState(0);
  
  const mainRecorderRef = useRef(null);
  const allChunksRef = useRef([]); // full recording for final save
  const timerRef = useRef(null);
  const animationRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const liveModeRef = useRef(false);
  const chunkIntervalRef = useRef(null);
  const liveRecorderRef = useRef(null);
  const liveChunksRef = useRef([]);
  const wsRef = useRef(null);

  useEffect(() => {
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (chunkIntervalRef.current) clearInterval(chunkIntervalRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  const startLiveChunkLoop = (stream, mimeType) => {
    const wsUrl = apiUrl.replace(/^http/, 'ws') + '/transcribe/stream';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.text) {
          onLiveText?.(data.text);
        }
      } catch (e) {
        console.error("WS message parse error:", e);
      }
    };

    ws.onopen = () => {
      const recordOneChunk = () => {
        if (!liveModeRef.current) return;
        
        liveChunksRef.current = [];
        const recorder = new MediaRecorder(stream, { mimeType });
        liveRecorderRef.current = recorder;
        
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) liveChunksRef.current.push(e.data);
        };
        
        recorder.onstop = () => {
          const blob = new Blob(liveChunksRef.current, { type: mimeType });
          if (blob.size >= 1000 && ws.readyState === WebSocket.OPEN) {
            ws.send(blob);
          }
          if (liveModeRef.current) {
            recordOneChunk();
          }
        };
        
        recorder.start();
        setTimeout(() => {
          if (recorder.state === 'recording') {
            recorder.stop();
          }
        }, 1500); // 1.5 seconds for true real-time feel
      };
      
      recordOneChunk();
    };
    
    ws.onerror = (error) => {
      console.error("WebSocket Error:", error);
    };
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
        setAudioLevel(avg / 128);
        animationRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      
      // Main recorder for full recording (for save at end)
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
        stream.getTracks().forEach(t => t.stop());
        if (audioContext.state !== 'closed') audioContext.close();
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        setAudioLevel(0);
      };
      mainRecorder.start();
      mainRecorderRef.current = mainRecorder;

      // Live chunk loop (parallel recorder for streaming)
      if (liveMode) {
        liveModeRef.current = true;
        startLiveChunkLoop(stream, mimeType);
      }

      setIsRecording(true);
      setIsLiveMode(liveMode);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
    } catch (error) {
      console.error('Recording error:', error);
      toast.error('Microphone access denied or unavailable');
    }
  };

  const stopRecording = () => {
    liveModeRef.current = false;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (liveRecorderRef.current && liveRecorderRef.current.state === 'recording') {
      liveRecorderRef.current.stop();
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
