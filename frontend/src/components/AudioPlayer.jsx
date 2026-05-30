import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { Button } from './ui/button';
import WaveSurfer from 'wavesurfer.js';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const AudioPlayer = forwardRef(({ audioUrl, onTimeUpdate, playbackSpeed = 1 }, ref) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(playbackSpeed);
  const [waveReady, setWaveReady] = useState(false);
  const waveContainerRef = useRef(null);
  const wavesurferRef = useRef(null);

  useImperativeHandle(ref, () => ({
    seekTo: (time) => {
      if (wavesurferRef.current && duration > 0) {
        wavesurferRef.current.seekTo(time / duration);
        wavesurferRef.current.play();
        setIsPlaying(true);
      }
    }
  }));

  // Initialize WaveSurfer
  useEffect(() => {
    if (!waveContainerRef.current || !audioUrl) return;

    // Clean up old instance
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
      wavesurferRef.current = null;
      setWaveReady(false);
    }

    const isDark = document.documentElement.classList.contains('dark');

    const ws = WaveSurfer.create({
      container: waveContainerRef.current,
      waveColor: isDark ? 'rgba(147, 197, 253, 0.4)' : 'rgba(37, 99, 235, 0.3)',
      progressColor: isDark ? '#3b82f6' : '#1d4ed8',
      cursorColor: isDark ? '#60a5fa' : '#2563eb',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 56,
      responsive: true,
      normalize: true,
      backend: 'WebAudio',
    });

    ws.load(audioUrl);

    ws.on('ready', () => {
      setDuration(ws.getDuration());
      setWaveReady(true);
      ws.setPlaybackRate(speed);
    });

    ws.on('audioprocess', () => {
      const time = ws.getCurrentTime();
      setCurrentTime(time);
      onTimeUpdate?.(time);
    });

    ws.on('seeking', () => {
      const time = ws.getCurrentTime();
      setCurrentTime(time);
      onTimeUpdate?.(time);
    });

    ws.on('finish', () => {
      setIsPlaying(false);
    });

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));

    wavesurferRef.current = ws;

    return () => {
      ws.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]);

  // Sync speed
  useEffect(() => {
    if (wavesurferRef.current && waveReady) {
      wavesurferRef.current.setPlaybackRate(speed);
    }
  }, [speed, waveReady]);

  useEffect(() => {
    setSpeed(playbackSpeed);
  }, [playbackSpeed]);

  // Update waveform colors on theme change
  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (wavesurferRef.current && waveReady) {
        const isDark = document.documentElement.classList.contains('dark');
        wavesurferRef.current.setOptions({
          waveColor: isDark ? 'rgba(147, 197, 253, 0.4)' : 'rgba(37, 99, 235, 0.3)',
          progressColor: isDark ? '#3b82f6' : '#1d4ed8',
          cursorColor: isDark ? '#60a5fa' : '#2563eb',
        });
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [waveReady]);

  const togglePlay = () => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.playPause();
  };

  const skip = (seconds) => {
    if (!wavesurferRef.current) return;
    const newTime = Math.max(0, Math.min(duration, wavesurferRef.current.getCurrentTime() + seconds));
    wavesurferRef.current.seekTo(newTime / duration);
  };

  const cycleSpeed = () => {
    const currentIdx = SPEEDS.indexOf(speed);
    const nextIdx = (currentIdx + 1) % SPEEDS.length;
    setSpeed(SPEEDS[nextIdx]);
  };

  const formatTime = (t) => {
    if (!t || isNaN(t)) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!audioUrl) return null;

  return (
    <div 
      className="bg-background border border-border rounded-sm p-3 space-y-2"
      data-testid="audio-player"
    >
      {/* Waveform */}
      <div 
        ref={waveContainerRef}
        className="w-full rounded-sm overflow-hidden"
        data-testid="waveform-container"
        style={{ minHeight: 56 }}
      />
      
      {/* Controls */}
      <div className="flex items-center gap-3">
        {/* Skip Back */}
        <button
          onClick={() => skip(-5)}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
          title="Skip back 5s"
          data-testid="skip-back-button"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        {/* Play/Pause */}
        <Button
          onClick={togglePlay}
          size="sm"
          variant="outline"
          className="rounded-sm border-border flex-shrink-0"
          data-testid="play-pause-button"
          disabled={!waveReady}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>

        {/* Skip Forward */}
        <button
          onClick={() => skip(5)}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
          title="Skip forward 5s"
          data-testid="skip-forward-button"
        >
          <SkipForward className="w-4 h-4" />
        </button>

        {/* Time */}
        <span className="text-xs font-mono text-muted-foreground flex-shrink-0" data-testid="current-time">
          {formatTime(currentTime)}
        </span>

        <span className="text-xs text-muted-foreground">/</span>

        {/* Duration */}
        <span className="text-xs font-mono text-muted-foreground flex-shrink-0" data-testid="duration-time">
          {formatTime(duration)}
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Speed Control */}
        <button
          onClick={cycleSpeed}
          className="text-xs font-mono font-bold px-2 py-1 rounded-sm bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors min-w-[40px] text-center"
          title="Playback speed"
          data-testid="speed-button"
        >
          {speed}x
        </button>
      </div>
    </div>
  );
});

AudioPlayer.displayName = 'AudioPlayer';

export default AudioPlayer;
