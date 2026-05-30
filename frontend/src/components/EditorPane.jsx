import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Sparkles, Copy, Download, Loader2, Users, ChevronDown, FileText, Captions, Pencil, Check, X, Languages, MessageSquare, FileJson, SkipBack, SkipForward, Gauge, Wand2, FileStack, ListChecks, ArrowRightLeft } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from './ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import MicRecorder from './MicRecorder';
import AudioPlayer from './AudioPlayer';
import CommandBar from './CommandBar';
import SummaryPanel from './SummaryPanel';
import TranslationPanel from './TranslationPanel';

const EditorPane = ({ 
  transcript, 
  audioUrl, 
  onTranscribe,
  onBatchTranscribe,
  onProcessText, 
  onCommandEdit,
  onDiarize,
  onSummarize,
  onTranslate,
  onExport,
  onUpdateSpeakerLabels,
  onUpdateTranscription,
  apiUrl,
  loading,
  languages,
  selectedLanguage,
  onLanguageChange,
  settings,
  playbackSpeed
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDiarizing, setIsDiarizing] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const [showOriginal, setShowOriginal] = useState(false);
  const [diarizedSegments, setDiarizedSegments] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [liveText, setLiveText] = useState('');
  const [editingSpeaker, setEditingSpeaker] = useState(null);
  const [editingSpeakerName, setEditingSpeakerName] = useState('');
  const [selectedTone, setSelectedTone] = useState(settings?.default_tone || 'professional');
  const [selectedFormat, setSelectedFormat] = useState(settings?.default_format || 'paragraph');
  const [showCommandBar, setShowCommandBar] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translationData, setTranslationData] = useState(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [editingSegmentIdx, setEditingSegmentIdx] = useState(null);
  const [editingSegmentText, setEditingSegmentText] = useState('');
  const fileInputRef = useRef(null);
  const batchInputRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    setDisplayText('');
    setShowOriginal(false);
    setDiarizedSegments(null);
    setLiveText('');
    setEditingSpeaker(null);
    setShowCommandBar(false);
    setShowSummary(false);
    setShowTranslation(false);
    setSummaryData(null);
    setTranslationData(null);
    setEditingSegmentIdx(null);
  }, [transcript?.id]);

  // Text selection for command mode
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length > 3) {
      setSelectedText(text);
    }
  }, []);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setLiveText('');
      await onTranscribe(file);
    }
  };

  const handleBatchSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      await onBatchTranscribe(files);
    }
  };

  const handleRecordingComplete = async (file, blob) => {
    await onTranscribe(file, blob);
    setLiveText('');
  };

  const handleLiveText = (chunk) => {
    setLiveText(prev => prev ? `${prev} ${chunk}` : chunk);
  };

  const handleAIProcess = async () => {
    if (!transcript?.text) return;
    setIsProcessing(true);
    try {
      const processedText = await onProcessText(transcript.text, selectedTone, selectedFormat);
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

  const handleCommandSubmit = async (instruction) => {
    if (!selectedText) return;
    try {
      const result = await onCommandEdit(selectedText, instruction);
      // Replace selected text in displayText or transcript
      const currentContent = displayText || transcript?.text || '';
      const newText = currentContent.replace(selectedText, result);
      setDisplayText(newText);
      setShowCommandBar(false);
      setSelectedText('');
      toast.success('Command applied!');
    } catch (error) {
      console.error('Command error:', error);
    }
  };

  const handleSummarize = async (style = 'meeting_notes') => {
    const text = displayText || transcript?.text;
    if (!text) return;
    setIsSummarizing(true);
    try {
      const data = await onSummarize(text, style);
      setSummaryData(data);
      setShowSummary(true);
      toast.success('Summary generated!');
    } catch (error) {
      console.error('Summarize error:', error);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleTranslate = async (targetLang) => {
    const text = displayText || transcript?.text;
    if (!text) return;
    setIsTranslating(true);
    try {
      const data = await onTranslate(text, targetLang);
      setTranslationData(data);
      setShowTranslation(true);
      toast.success('Translation complete!');
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsTranslating(false);
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

  const handleStartEditSpeaker = (speakerKey) => {
    const currentName = (transcript?.speaker_labels?.[speakerKey]) || speakerKey;
    setEditingSpeaker(speakerKey);
    setEditingSpeakerName(currentName);
  };

  const handleSaveSpeakerName = async () => {
    if (!editingSpeaker || !editingSpeakerName.trim()) {
      setEditingSpeaker(null);
      return;
    }
    const newLabels = { 
      ...(transcript?.speaker_labels || {}), 
      [editingSpeaker]: editingSpeakerName.trim() 
    };
    await onUpdateSpeakerLabels(transcript.id, newLabels);
    setEditingSpeaker(null);
    setEditingSpeakerName('');
  };

  const handleSegmentEdit = (idx, text) => {
    setEditingSegmentIdx(idx);
    setEditingSegmentText(text);
  };

  const handleSaveSegmentEdit = async () => {
    if (editingSegmentIdx === null) return;
    const segs = [...(diarizedSegments || transcript?.segments || [])];
    segs[editingSegmentIdx] = { ...segs[editingSegmentIdx], text: editingSegmentText };
    if (diarizedSegments) {
      setDiarizedSegments(segs);
    }
    // Persist
    if (transcript?.id) {
      await onUpdateTranscription(transcript.id, { segments: segs });
    }
    setEditingSegmentIdx(null);
    setEditingSegmentText('');
  };

  const getSpeakerDisplay = (speakerKey) => {
    if (!speakerKey) return null;
    return transcript?.speaker_labels?.[speakerKey] || speakerKey;
  };

  const formatTime = (t) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const currentText = showOriginal ? transcript?.original_text : (displayText || transcript?.text);
  const segments = diarizedSegments || transcript?.segments;
  
  const uniqueSpeakers = segments
    ? Array.from(new Set(segments.map(s => s.speaker).filter(Boolean)))
    : [];

  return (
    <div className="flex-1 flex flex-col bg-background" data-testid="editor-pane" onMouseUp={handleTextSelection}>
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
          <div className="absolute inset-0 bg-background/65 backdrop-blur-[2px]"></div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-3xl relative z-10"
          >
            <h1 
              className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-none text-foreground mb-4"
              style={{ fontFamily: 'Outfit, sans-serif' }}
              data-testid="hero-title"
            >
              Transform Speech
              <br />
              Into Perfect Text
            </h1>
            <p className="text-base sm:text-lg text-foreground font-medium mb-8 leading-relaxed max-w-2xl mx-auto">
              AI-powered transcription with live streaming, speaker identification, 
              context-aware formatting, summarization, translation, and more.
            </p>

            {/* Language Selector */}
            <div className="mb-6 flex justify-center">
              <Select value={selectedLanguage} onValueChange={onLanguageChange}>
                <SelectTrigger className="w-[200px] bg-background border-2 border-border rounded-sm" data-testid="language-selector">
                  <Languages className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="auto">Auto-detect</SelectItem>
                  {Object.entries(languages).map(([code, name]) => (
                    <SelectItem key={code} value={code}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm"
              onChange={handleFileSelect}
              className="hidden"
              data-testid="file-input"
            />
            <input
              ref={batchInputRef}
              type="file"
              accept=".mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm"
              onChange={handleBatchSelect}
              className="hidden"
              multiple
              data-testid="batch-file-input"
            />
            
            <div className="flex flex-wrap items-center justify-center gap-3">
              <MicRecorder 
                onRecordingComplete={handleRecordingComplete} 
                onLiveText={handleLiveText}
                apiUrl={apiUrl}
                disabled={loading} 
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                size="lg"
                variant="outline"
                className="bg-background border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground px-6 py-6 text-base font-semibold rounded-sm transition-colors duration-200 shadow-lg"
                data-testid="upload-button"
              >
                <Upload className="w-5 h-5 mr-2" />
                Upload
              </Button>
              <Button
                onClick={() => batchInputRef.current?.click()}
                size="lg"
                variant="outline"
                className="bg-background border-2 border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary px-6 py-6 text-base font-semibold rounded-sm transition-colors duration-200 shadow-lg"
                data-testid="batch-upload-button"
              >
                <FileStack className="w-5 h-5 mr-2" />
                Batch Upload
              </Button>
            </div>

            {liveText && (
              <div 
                className="mt-8 mx-auto max-w-2xl bg-background/90 backdrop-blur-sm border border-primary rounded-sm p-4 text-left"
                data-testid="live-transcription-preview"
              >
                <p className="text-xs uppercase tracking-[0.2em] font-bold text-primary mb-2">
                  Live Transcription
                </p>
                <p className="text-base text-foreground leading-relaxed">
                  {liveText}
                </p>
              </div>
            )}

            <p className="text-xs text-foreground mt-6 uppercase tracking-[0.2em] font-bold bg-background/80 backdrop-blur-sm inline-block px-4 py-2 rounded-sm">
              Supports MP3, WAV, M4A, WEBM • Max 25MB • 30+ Languages
            </p>
          </motion.div>
        </div>
      )}

      {/* Editor Section */}
      {transcript && (
        <div className="flex-1 flex flex-col" data-testid="transcript-view">
          {/* Toolbar */}
          <div className="border-b border-border px-8 py-4 bg-background/70 backdrop-blur-xl">
            <div className="flex items-center justify-between max-w-5xl mx-auto flex-wrap gap-3">
              <div>
                <h2 
                  className="text-xl font-semibold tracking-tight text-foreground" 
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                  data-testid="transcript-title"
                >
                  {transcript.filename || 'Transcript'}
                </h2>
                <div className="flex items-center gap-3 mt-1">
                  {transcript.language && (
                    <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] font-semibold">
                      {languages[transcript.language] || transcript.language}
                    </p>
                  )}
                  {transcript.duration && (
                    <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] font-semibold">
                      {formatTime(transcript.duration)}
                    </p>
                  )}
                  {transcript.audio_path && (
                    <p className="text-xs text-primary uppercase tracking-[0.2em] font-semibold">
                      ● Audio Saved
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <Select value={selectedLanguage} onValueChange={onLanguageChange}>
                  <SelectTrigger className="w-[140px] h-9 text-xs rounded-sm border-border" data-testid="toolbar-language-selector">
                    <Languages className="w-3 h-3 mr-1" />
                    <SelectValue placeholder="Language" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="auto">Auto-detect</SelectItem>
                    {Object.entries(languages).map(([code, name]) => (
                      <SelectItem key={code} value={code}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <MicRecorder 
                  onRecordingComplete={handleRecordingComplete}
                  onLiveText={handleLiveText}
                  apiUrl={apiUrl}
                  disabled={loading} 
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  size="sm"
                  className="rounded-sm border-border"
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
                <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                <p className="text-sm text-muted-foreground font-semibold">Transcribing audio...</p>
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
                    playbackSpeed={playbackSpeed}
                  />
                )}

                {/* Action Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2 items-center">
                    {/* Tone Selector */}
                    <Select value={selectedTone} onValueChange={setSelectedTone}>
                      <SelectTrigger className="w-[130px] h-9 text-xs rounded-sm border-border" data-testid="tone-selector">
                        <SelectValue placeholder="Tone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="technical">Technical</SelectItem>
                        <SelectItem value="creative">Creative</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Format Selector */}
                    <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                      <SelectTrigger className="w-[130px] h-9 text-xs rounded-sm border-border" data-testid="format-selector">
                        <SelectValue placeholder="Format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paragraph">Paragraph</SelectItem>
                        <SelectItem value="bullets">Bullets</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="code">Code/Tech</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      onClick={handleAIProcess}
                      disabled={isProcessing || !transcript.text}
                      className="bg-primary hover:bg-primary/90 rounded-sm"
                      size="sm"
                      data-testid="ai-enhance-button"
                    >
                      {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                      AI Enhance
                    </Button>

                    <Button
                      onClick={handleDiarize}
                      disabled={isDiarizing || !transcript.segments || transcript.segments.length === 0}
                      variant="outline"
                      size="sm"
                      className="rounded-sm border-border"
                      data-testid="diarize-button"
                    >
                      {isDiarizing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}
                      Speakers
                    </Button>

                    {/* Command Mode Button */}
                    {selectedText && (
                      <Button
                        onClick={() => setShowCommandBar(true)}
                        variant="outline"
                        size="sm"
                        className="rounded-sm border-primary text-primary animate-in fade-in"
                        data-testid="command-mode-button"
                      >
                        <Wand2 className="w-4 h-4 mr-2" />
                        Command
                      </Button>
                    )}

                    {displayText && (
                      <Button
                        onClick={() => setShowOriginal(!showOriginal)}
                        variant="outline"
                        size="sm"
                        className="rounded-sm border-border"
                        data-testid="toggle-original-button"
                      >
                        {showOriginal ? 'Show Enhanced' : 'Show Original'}
                      </Button>
                    )}
                  </div>

                  <div className="flex gap-2 items-center">
                    {/* Summarize */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="rounded-sm border-border" disabled={isSummarizing} data-testid="summarize-button">
                          {isSummarizing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ListChecks className="w-4 h-4 mr-2" />}
                          Summarize
                          <ChevronDown className="w-3 h-3 ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-sm">
                        <DropdownMenuItem onClick={() => handleSummarize('meeting_notes')}>Meeting Notes</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSummarize('executive')}>Executive Summary</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSummarize('bullets')}>Bullet Points</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSummarize('action_items')}>Action Items</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Translate */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="rounded-sm border-border" disabled={isTranslating} data-testid="translate-button">
                          {isTranslating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-2" />}
                          Translate
                          <ChevronDown className="w-3 h-3 ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-sm max-h-[300px] overflow-y-auto">
                        <DropdownMenuLabel className="text-xs">Translate to...</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {Object.entries(languages).map(([code, name]) => (
                          <DropdownMenuItem key={code} onClick={() => handleTranslate(code)}>{name}</DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button onClick={handleCopy} variant="outline" size="sm" className="rounded-sm border-border" data-testid="copy-button">
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>

                    {/* Export */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="rounded-sm border-border" data-testid="export-button">
                          <Download className="w-4 h-4 mr-2" />
                          Export
                          <ChevronDown className="w-3 h-3 ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-sm">
                        <DropdownMenuItem onClick={() => onExport(transcript.id, 'txt')} data-testid="export-txt">
                          <FileText className="w-4 h-4 mr-2" />
                          Plain Text (.txt)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onExport(transcript.id, 'srt')} data-testid="export-srt">
                          <Captions className="w-4 h-4 mr-2" />
                          SubRip (.srt)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onExport(transcript.id, 'vtt')} data-testid="export-vtt">
                          <Captions className="w-4 h-4 mr-2" />
                          WebVTT (.vtt)
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onExport(transcript.id, 'json')} data-testid="export-json">
                          <FileJson className="w-4 h-4 mr-2" />
                          JSON (.json)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Command Bar */}
                <AnimatePresence>
                  {showCommandBar && (
                    <CommandBar
                      selectedText={selectedText}
                      onSubmit={handleCommandSubmit}
                      onClose={() => { setShowCommandBar(false); setSelectedText(''); }}
                    />
                  )}
                </AnimatePresence>

                {/* Summary Panel */}
                <AnimatePresence>
                  {showSummary && summaryData && (
                    <SummaryPanel
                      data={summaryData}
                      onClose={() => setShowSummary(false)}
                    />
                  )}
                </AnimatePresence>

                {/* Translation Panel */}
                <AnimatePresence>
                  {showTranslation && translationData && (
                    <TranslationPanel
                      data={translationData}
                      onClose={() => setShowTranslation(false)}
                    />
                  )}
                </AnimatePresence>

                {/* Speaker Rename Panel */}
                {uniqueSpeakers.length > 0 && (
                  <div 
                    className="bg-secondary border border-border rounded-sm p-4"
                    data-testid="speakers-panel"
                  >
                    <p className="text-xs uppercase tracking-[0.2em] font-bold text-muted-foreground mb-3">
                      Speakers ({uniqueSpeakers.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {uniqueSpeakers.map((speakerKey) => (
                        <div key={speakerKey} className="flex items-center gap-2 bg-background border border-border rounded-sm px-3 py-2" data-testid={`speaker-${speakerKey}`}>
                          {editingSpeaker === speakerKey ? (
                            <>
                              <Input
                                value={editingSpeakerName}
                                onChange={(e) => setEditingSpeakerName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveSpeakerName();
                                  if (e.key === 'Escape') setEditingSpeaker(null);
                                }}
                                autoFocus
                                className="h-7 w-32 text-sm"
                                data-testid={`speaker-name-input-${speakerKey}`}
                              />
                              <button onClick={handleSaveSpeakerName} className="text-primary hover:bg-primary/10 p-1 rounded" data-testid={`save-speaker-${speakerKey}`}>
                                <Check className="w-4 h-4" />
                              </button>
                              <button onClick={() => setEditingSpeaker(null)} className="text-destructive hover:bg-destructive/10 p-1 rounded" data-testid={`cancel-speaker-${speakerKey}`}>
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="text-sm font-semibold text-foreground" data-testid={`speaker-label-${speakerKey}`}>
                                {getSpeakerDisplay(speakerKey)}
                              </span>
                              <button 
                                onClick={() => handleStartEditSpeaker(speakerKey)} 
                                className="text-muted-foreground hover:text-primary p-1 rounded transition-colors" 
                                data-testid={`edit-speaker-${speakerKey}`}
                                title="Rename speaker"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Segments View with click-to-seek and inline editing */}
                {audioUrl && segments && segments.length > 0 && !displayText && (
                  <div className="bg-background border border-border rounded-sm p-6 space-y-3" data-testid="segments-view">
                    <p className="text-xs uppercase tracking-[0.2em] font-bold text-muted-foreground mb-2">
                      Interactive Transcript {diarizedSegments && '• Speakers Identified'}
                    </p>
                    {segments.map((seg, idx) => {
                      const isActive = currentTime >= seg.start && currentTime <= seg.end;
                      const isEditing = editingSegmentIdx === idx;
                      return (
                        <div
                          key={idx}
                          className={`
                            flex gap-3 p-3 rounded-sm cursor-pointer transition-colors duration-200 group
                            ${isActive ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-secondary border-l-2 border-transparent'}
                          `}
                          data-testid={`segment-${idx}`}
                        >
                          <div className="flex-shrink-0 w-16" onClick={() => handleSegmentClick(seg.start)}>
                            <span className="text-xs font-mono font-semibold text-primary">
                              {formatTime(seg.start)}
                            </span>
                          </div>
                          <div className="flex-1">
                            {seg.speaker && (
                              <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1">
                                {getSpeakerDisplay(seg.speaker)}
                              </p>
                            )}
                            {isEditing ? (
                              <div className="flex gap-2 items-start">
                                <Textarea
                                  value={editingSegmentText}
                                  onChange={(e) => setEditingSegmentText(e.target.value)}
                                  className="min-h-[60px] text-sm"
                                  autoFocus
                                />
                                <div className="flex flex-col gap-1">
                                  <button onClick={handleSaveSegmentEdit} className="text-primary hover:bg-primary/10 p-1 rounded">
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => setEditingSegmentIdx(null)} className="text-destructive hover:bg-destructive/10 p-1 rounded">
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-2">
                                <p 
                                  className={`text-base leading-relaxed flex-1 ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
                                  onClick={() => handleSegmentClick(seg.start)}
                                >
                                  {seg.text.trim()}
                                </p>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleSegmentEdit(idx, seg.text.trim()); }}
                                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary p-1 rounded transition-opacity"
                                  title="Edit segment"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Plain Text View */}
                {(!audioUrl || !segments || segments.length === 0 || displayText) && (
                  <div className="bg-background border border-border rounded-sm p-8" data-testid="transcript-content">
                    <Textarea
                      ref={textareaRef}
                      value={currentText || ''}
                      onChange={(e) => {
                        if (displayText) setDisplayText(e.target.value);
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
