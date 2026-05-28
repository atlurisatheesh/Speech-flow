import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Play, Pause } from 'lucide-react';
import { Button } from './ui/button';

const AudioPlayer = forwardRef(({ audioUrl, onTimeUpdate }, ref) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  useImperativeHandle(ref, () => ({
    seekTo: (time) => {
      if (audioRef.current) {
        audioRef.current.currentTime = time;
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  }));

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoaded = () => setDuration(audio.duration || 0);
    const onTime = () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdate?.(audio.currentTime);
    };
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audioUrl, onTimeUpdate]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (t) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = percent * duration;
  };

  if (!audioUrl) return null;

  return (
    <div 
      className="flex items-center gap-3 bg-white border border-[#E4E4E7] rounded-sm p-3"
      data-testid="audio-player"
    >
      <audio ref={audioRef} src={audioUrl} preload="metadata" data-testid="audio-element" />
      <Button
        onClick={togglePlay}
        size="sm"
        variant="outline"
        className="rounded-sm border-[#E4E4E7] flex-shrink-0"
        data-testid="play-pause-button"
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </Button>
      <span className="text-xs font-mono text-[#52525B] flex-shrink-0 w-12" data-testid="current-time">
        {formatTime(currentTime)}
      </span>
      <div 
        onClick={handleSeek}
        className="flex-1 h-2 bg-[#F7F7F8] rounded-sm cursor-pointer relative overflow-hidden"
        data-testid="seek-bar"
      >
        <div 
          className="absolute inset-y-0 left-0 bg-[#002FA7] transition-all"
          style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
        />
      </div>
      <span className="text-xs font-mono text-[#52525B] flex-shrink-0 w-12 text-right" data-testid="duration-time">
        {formatTime(duration)}
      </span>
    </div>
  );
});

AudioPlayer.displayName = 'AudioPlayer';

export default AudioPlayer;
