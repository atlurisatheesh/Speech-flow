import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const MicRecorder = ({ onRecordingComplete, disabled }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const updateLevel = () => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(avg / 128);
        animationRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const ext = mimeType.includes('webm') ? 'webm' : 'mp4';
        const file = new File([blob], `recording-${Date.now()}.${ext}`, { type: mimeType });
        onRecordingComplete(file, blob);
        stream.getTracks().forEach(t => t.stop());
        audioContext.close();
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        setAudioLevel(0);
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Recording error:', error);
      toast.error('Microphone access denied or unavailable');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
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
      <div className="flex flex-col items-center gap-4" data-testid="recording-active">
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
            Stop Recording
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm font-mono font-semibold text-[#EF4444]" data-testid="recording-timer">
          <div className="w-2 h-2 bg-[#EF4444] rounded-full pulse-recording"></div>
          {formatTime(recordingTime)}
        </div>
      </div>
    );
  }

  return (
    <Button
      onClick={startRecording}
      disabled={disabled}
      size="lg"
      className="bg-[#EF4444] hover:bg-[#DC2626] text-white px-8 py-6 text-base font-semibold rounded-sm transition-colors duration-200 shadow-lg"
      data-testid="start-recording-button"
    >
      <Mic className="w-5 h-5 mr-2" />
      Start Recording
    </Button>
  );
};

export default MicRecorder;
