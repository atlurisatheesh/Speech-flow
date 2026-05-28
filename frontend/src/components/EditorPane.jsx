import { useState, useRef, useEffect } from 'react';
import { Upload, Sparkles, Copy, Download, Loader2, Users, ChevronDown, FileText, Captions } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import MicRecorder from './MicRecorder';
import AudioPlayer from './AudioPlayer';

const EditorPane = ({ 
  transcript, 
  audioUrl, 
  onTranscribe, 
  onProcessText, 
  onDiarize, 
  onExport,
  loading 
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDiarizing, setIsDiarizing] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const [showOriginal, setShowOriginal] = useState(false);
  const [diarizedSegments, setDiarizedSegments] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const fileInputRef = useRef(null);
  const audioPlayerRef = useRef(null);

  useEffect(() => {
    // Reset processed state when transcript changes
    setDisplayText('');
    setShowOriginal(false);
    setDiarizedSegments(null);
  }, [transcript?.id]);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await onTranscribe(file);
    }
  };

  const handleRecordingComplete = async (file, blob) => {
    await onTranscribe(file, blob);
  };

  const handleAIProcess = async () => {
    if (!transcript?.text) return;
    setIsProcessing(true);
    try {
      const processedText = await onProcessText(transcript.text);
      setDisplayText(processedText);
      setShowOriginal(false);
      toast.success('Text enhanced with AI!');
    } catch (error) {
      console.error('Processing error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDiarize = async () => {
    if (!transcript?.segments || transcript.segments.length === 0) {
      toast.error('No timestamp data available for diarization');
      return;
    }
    setIsDiarizing(true);
    try {
      const segments = await onDiarize(transcript.segments);
      setDiarizedSegments(segments);
      toast.success('Speakers identified!');
    } catch (error) {
      console.error('Diarization error:', error);
    } finally {
      setIsDiarizing(false);
    }
  };

  const handleCopy = () => {
    const textToCopy = displayText || transcript?.text || '';
    navigator.clipboard.writeText(textToCopy);
    toast.success('Copied to clipboard!');
  };

  const handleSegmentClick = (start) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.seekTo(start);
    }
  };

  const formatTime = (t) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const currentText = showOriginal ? transcript?.original_text : (displayText || transcript?.text);
  const segments = diarizedSegments || transcript?.segments;

  return (
    <div className="flex-1 flex flex-col" data-testid="editor-pane">
      {/* Hero Section */}
      {!transcript && (
        <div 
          className="flex-1 flex flex-col items-center justify-center px-8 relative"
          style={{
            backgroundImage: 'url(https://static.prod-images.emergentagent.com/jobs/0a532f4d-fffc-4e94-9a3a-681b67b54330/images/f4bf8d280a193b6baadb8c0ccac52d556e2a05bbbc3ba2961091a1d119ef0d60.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px]"></div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-3xl relative z-10"
          >
            <h1 
              className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-none text-[#0A0A0B] mb-4"
              style={{ fontFamily: 'Outfit, sans-serif' }}
              data-testid="hero-title"
            >
              Transform Speech
              <br />
              Into Perfect Text
            </h1>
            <p className="text-base sm:text-lg text-[#0A0A0B] font-medium mb-8 leading-relaxed max-w-2xl mx-auto">
              AI-powered transcription with automatic grammar correction, filler word removal,
              speaker identification, and 100+ language support.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm"
              onChange={handleFileSelect}
              className="hidden"
              data-testid="file-input"
            />
            
            <div className="flex flex-wrap items-center justify-center gap-4">
              <MicRecorder onRecordingComplete={handleRecordingComplete} disabled={loading} />
              <Button
                onClick={() => fileInputRef.current?.click()}
                size="lg"
                variant="outline"
                className="bg-white border-2 border-[#002FA7] text-[#002FA7] hover:bg-[#002FA7] hover:text-white px-8 py-6 text-base font-semibold rounded-sm transition-colors duration-200 shadow-lg"
                data-testid="upload-button"
              >
                <Upload className="w-5 h-5 mr-2" />
                Upload Audio File
              </Button>
            </div>

            <p className="text-xs text-[#0A0A0B] mt-6 uppercase tracking-[0.2em] font-bold bg-white/80 backdrop-blur-sm inline-block px-4 py-2 rounded-sm">
              Supports MP3, WAV, M4A, WEBM • Max 25MB
            </p>
          </motion.div>
        </div>
      )}

      {/* Editor Section */}
      {transcript && (
        <div className="flex-1 flex flex-col" data-testid="transcript-view">
          {/* Toolbar */}
          <div className="border-b border-[#E4E4E7] px-8 py-4 bg-white/70 backdrop-blur-xl">
            <div className="flex items-center justify-between max-w-5xl mx-auto">
              <div>
                <h2 
                  className="text-xl font-semibold tracking-tight" 
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                  data-testid="transcript-title"
                >
                  {transcript.filename || 'Transcript'}
                </h2>
                <div className="flex items-center gap-3 mt-1">
                  {transcript.language && (
                    <p className="text-xs text-[#52525B] uppercase tracking-[0.2em] font-semibold">
                      {transcript.language}
                    </p>
                  )}
                  {transcript.duration && (
                    <p className="text-xs text-[#52525B] uppercase tracking-[0.2em] font-semibold">
                      {formatTime(transcript.duration)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <MicRecorder onRecordingComplete={handleRecordingComplete} disabled={loading} />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  size="sm"
                  className="rounded-sm border-[#E4E4E7]"
                  data-testid="new-transcription-button"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  New
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-12 h-12 animate-spin text-[#002FA7] mx-auto mb-4" />
                <p className="text-sm text-[#52525B] font-semibold">Transcribing audio...</p>
              </div>
            </div>
          )}

          {/* Transcript Content */}
          {!loading && (
            <div className="flex-1 overflow-auto px-8 py-8">
              <div className="max-w-5xl mx-auto space-y-4">
                {/* Audio Player */}
                {audioUrl && (
                  <AudioPlayer
                    ref={audioPlayerRef}
                    audioUrl={audioUrl}
                    onTimeUpdate={setCurrentTime}
                  />
                )}

                {/* Action Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={handleAIProcess}
                      disabled={isProcessing || !transcript.text}
                      className="bg-[#002FA7] hover:bg-[#002FA7]/90 rounded-sm"
                      size="sm"
                      data-testid="ai-enhance-button"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      AI Enhance
                    </Button>
                    <Button
                      onClick={handleDiarize}
                      disabled={isDiarizing || !transcript.segments || transcript.segments.length === 0}
                      variant="outline"
                      size="sm"
                      className="rounded-sm border-[#E4E4E7]"
                      data-testid="diarize-button"
                    >
                      {isDiarizing ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Users className="w-4 h-4 mr-2" />
                      )}
                      Identify Speakers
                    </Button>
                    {displayText && (
                      <Button
                        onClick={() => setShowOriginal(!showOriginal)}
                        variant="outline"
                        size="sm"
                        className="rounded-sm border-[#E4E4E7]"
                        data-testid="toggle-original-button"
                      >
                        {showOriginal ? 'Show Enhanced' : 'Show Original'}
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleCopy}
                      variant="outline"
                      size="sm"
                      className="rounded-sm border-[#E4E4E7]"
                      data-testid="copy-button"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-sm border-[#E4E4E7]"
                          data-testid="export-button"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Export
                          <ChevronDown className="w-3 h-3 ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-sm">
                        <DropdownMenuItem
                          onClick={() => onExport(transcript.id, 'txt')}
                          data-testid="export-txt"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Plain Text (.txt)
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onExport(transcript.id, 'srt')}
                          data-testid="export-srt"
                        >
                          <Captions className="w-4 h-4 mr-2" />
                          SubRip (.srt)
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onExport(transcript.id, 'vtt')}
                          data-testid="export-vtt"
                        >
                          <Captions className="w-4 h-4 mr-2" />
                          WebVTT (.vtt)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Segments View with click-to-seek (when audio + segments available) */}
                {audioUrl && segments && segments.length > 0 && !displayText && (
                  <div 
                    className="bg-white border border-[#E4E4E7] rounded-sm p-6 space-y-3"
                    data-testid="segments-view"
                  >
                    <p className="text-xs uppercase tracking-[0.2em] font-bold text-[#52525B] mb-2">
                      Interactive Transcript {diarizedSegments && '• Speaker Identified'}
                    </p>
                    {segments.map((seg, idx) => {
                      const isActive = currentTime >= seg.start && currentTime <= seg.end;
                      return (
                        <div
                          key={idx}
                          onClick={() => handleSegmentClick(seg.start)}
                          className={`
                            flex gap-3 p-3 rounded-sm cursor-pointer transition-colors duration-200
                            ${isActive ? 'bg-[#002FA7]/10 border-l-2 border-[#002FA7]' : 'hover:bg-[#F7F7F8] border-l-2 border-transparent'}
                          `}
                          data-testid={`segment-${idx}`}
                        >
                          <div className="flex-shrink-0 w-16">
                            <span className="text-xs font-mono font-semibold text-[#002FA7]">
                              {formatTime(seg.start)}
                            </span>
                          </div>
                          <div className="flex-1">
                            {seg.speaker && (
                              <p className="text-xs font-bold uppercase tracking-wider text-[#002FA7] mb-1">
                                {seg.speaker}
                              </p>
                            )}
                            <p className={`text-base leading-relaxed ${isActive ? 'text-[#0A0A0B] font-medium' : 'text-[#52525B]'}`}>
                              {seg.text.trim()}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Plain Text View (when no audio or text is enhanced) */}
                {(!audioUrl || !segments || segments.length === 0 || displayText) && (
                  <div 
                    className="bg-white border border-[#E4E4E7] rounded-sm p-8"
                    data-testid="transcript-content"
                  >
                    <Textarea
                      value={currentText || ''}
                      onChange={(e) => {
                        if (displayText) {
                          setDisplayText(e.target.value);
                        }
                      }}
                      className="transcript-editor min-h-[400px] border-0 focus-visible:ring-0 p-0 resize-none text-base leading-relaxed"
                      style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
                      data-testid="transcript-textarea"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EditorPane;
