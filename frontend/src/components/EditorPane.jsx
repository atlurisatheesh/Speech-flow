import { useState, useRef } from 'react';
import { Upload, Sparkles, Copy, Download, Loader2, Mic } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const EditorPane = ({ transcript, onTranscribe, onProcessText, loading }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const [showOriginal, setShowOriginal] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await onTranscribe(file);
    }
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

  const handleCopy = () => {
    const textToCopy = displayText || transcript?.text || '';
    navigator.clipboard.writeText(textToCopy);
    toast.success('Copied to clipboard!');
  };

  const handleDownload = () => {
    const textToDownload = displayText || transcript?.text || '';
    const blob = new Blob([textToDownload], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded!');
  };

  const currentText = showOriginal ? transcript?.original_text : (displayText || transcript?.text);

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
              and support for 100+ languages. More accurate than ever.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm"
              onChange={handleFileSelect}
              className="hidden"
              data-testid="file-input"
            />
            
            <Button
              onClick={() => fileInputRef.current?.click()}
              size="lg"
              className="bg-[#002FA7] hover:bg-[#002FA7]/90 text-white px-8 py-6 text-base font-semibold rounded-sm transition-colors duration-200 shadow-lg"
              data-testid="upload-button"
            >
              <Upload className="w-5 h-5 mr-2" />
              Upload Audio File
            </Button>

            <p className="text-xs text-[#0A0A0B] mt-4 uppercase tracking-[0.2em] font-bold bg-white/80 backdrop-blur-sm inline-block px-4 py-2 rounded-sm">
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
            <div className="flex items-center justify-between max-w-4xl mx-auto">
              <div>
                <h2 
                  className="text-xl font-semibold tracking-tight" 
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                  data-testid="transcript-title"
                >
                  {transcript.filename || 'Transcript'}
                </h2>
                {transcript.language && (
                  <p className="text-xs text-[#52525B] mt-1 uppercase tracking-[0.2em] font-semibold">
                    Language: {transcript.language}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
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
              <div className="max-w-4xl mx-auto">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex gap-2">
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
                    <Button
                      onClick={handleDownload}
                      variant="outline"
                      size="sm"
                      className="rounded-sm border-[#E4E4E7]"
                      data-testid="download-button"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>

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
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EditorPane;
