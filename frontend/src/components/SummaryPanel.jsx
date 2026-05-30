import { Copy, X } from 'lucide-react';
import { Button } from './ui/button';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const SummaryPanel = ({ data, onClose }) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(data.summary);
    toast.success('Summary copied!');
  };

  const styleLabels = {
    meeting_notes: 'Meeting Notes',
    executive: 'Executive Summary',
    bullets: 'Bullet Points',
    action_items: 'Action Items',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-background border border-primary/30 rounded-sm shadow-lg overflow-hidden"
      data-testid="summary-panel"
    >
      <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border-b border-primary/20">
        <div className="flex items-center gap-3">
          <p className="text-xs uppercase tracking-[0.2em] font-bold text-primary">
            {styleLabels[data.style] || 'Summary'}
          </p>
          <span className="text-xs text-muted-foreground">
            {data.original_length} chars → {data.summary_length} chars
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleCopy} variant="ghost" size="sm" className="h-7 text-xs">
            <Copy className="w-3 h-3 mr-1" /> Copy
          </Button>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="p-5 max-h-[400px] overflow-y-auto">
        <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap leading-relaxed" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
          {data.summary}
        </div>
      </div>
    </motion.div>
  );
};

export default SummaryPanel;
