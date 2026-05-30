import { useState, useRef, useEffect } from 'react';
import { Wand2, Loader2, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { motion } from 'framer-motion';

const QUICK_COMMANDS = [
  { label: 'Make Professional', instruction: 'Rewrite this text in a professional, formal tone' },
  { label: 'Make Casual', instruction: 'Rewrite this in a casual, friendly tone' },
  { label: 'Summarize', instruction: 'Summarize this text concisely' },
  { label: 'Fix Grammar', instruction: 'Fix all grammar, spelling, and punctuation errors' },
  { label: 'Expand', instruction: 'Expand this text with more detail and explanation' },
  { label: 'Simplify', instruction: 'Simplify this text to be easier to understand' },
  { label: 'Make Bullet Points', instruction: 'Convert this text into organized bullet points' },
];

const CommandBar = ({ selectedText, onSubmit, onClose }) => {
  const [instruction, setInstruction] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (cmd) => {
    const finalInstruction = cmd || instruction;
    if (!finalInstruction.trim()) return;
    setIsLoading(true);
    try {
      await onSubmit(finalInstruction);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      className="bg-background border-2 border-primary rounded-sm p-4 shadow-lg"
      data-testid="command-bar"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-primary" />
          <p className="text-xs uppercase tracking-[0.2em] font-bold text-primary">Command Mode</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-muted-foreground mb-3 bg-secondary px-3 py-2 rounded-sm font-mono truncate">
        Selected: "{selectedText.substring(0, 80)}{selectedText.length > 80 ? '...' : ''}"
      </p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {QUICK_COMMANDS.map((cmd) => (
          <button
            key={cmd.label}
            onClick={() => handleSubmit(cmd.instruction)}
            disabled={isLoading}
            className="text-xs px-3 py-1.5 bg-secondary hover:bg-primary hover:text-primary-foreground rounded-sm font-medium transition-colors disabled:opacity-50"
            data-testid={`quick-cmd-${cmd.label.toLowerCase().replace(/\s/g, '-')}`}
          >
            {cmd.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Type a custom instruction... (e.g., 'translate to Spanish')"
          className="flex-1 text-sm rounded-sm"
          disabled={isLoading}
          data-testid="command-input"
        />
        <Button
          onClick={() => handleSubmit()}
          disabled={!instruction.trim() || isLoading}
          size="sm"
          className="bg-primary rounded-sm"
          data-testid="command-submit"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
        </Button>
      </div>
    </motion.div>
  );
};

export default CommandBar;
