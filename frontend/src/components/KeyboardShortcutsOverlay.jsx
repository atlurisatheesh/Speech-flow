import { X } from 'lucide-react';
import { motion } from 'framer-motion';

const shortcuts = [
  { keys: ['?'], description: 'Show/hide keyboard shortcuts' },
  { keys: ['Ctrl', 'Shift', 'E'], description: 'AI Enhance transcript' },
  { keys: ['Ctrl', 'Shift', 'D'], description: 'Identify speakers (diarize)' },
  { keys: ['Ctrl', 'Shift', 'F'], description: 'Focus search bar' },
  { keys: ['Ctrl', 'Shift', 'S'], description: 'Open settings' },
  { keys: ['Esc'], description: 'Close dialogs & overlays' },
];

const KeyboardShortcutsOverlay = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-background border border-border rounded-sm shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        data-testid="shortcuts-overlay"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Keyboard Shortcuts
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-3">
          {shortcuts.map((shortcut, idx) => (
            <div key={idx} className="flex items-center justify-between">
              <span className="text-sm text-foreground">{shortcut.description}</span>
              <div className="flex gap-1">
                {shortcut.keys.map((key, kidx) => (
                  <span key={kidx}>
                    <kbd className="px-2 py-1 text-xs font-mono font-semibold bg-secondary border border-border rounded text-foreground">
                      {key}
                    </kbd>
                    {kidx < shortcut.keys.length - 1 && (
                      <span className="text-xs text-muted-foreground mx-0.5">+</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-3 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-secondary border border-border rounded">?</kbd> to toggle this overlay
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default KeyboardShortcutsOverlay;
