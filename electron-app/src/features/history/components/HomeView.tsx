import { useState } from 'react';
import { Copy, Trash2, Check, Search } from 'lucide-react';

interface HistoryItem {
  id: string;
  time: string;
  text: string;
}

interface HistoryGroup {
  date: string;
  items: HistoryItem[];
}

interface HomeViewProps {
  history: HistoryGroup[];
  onDelete: (id: string) => void;
  onCopy: (text: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const CopyButton = ({ text, onCopy }: { text: string; onCopy: (text: string) => void }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return copied ? (
    <Check size={16} style={{ color: '#34d399', cursor: 'default' }} />
  ) : (
    <Copy size={16} style={{ cursor: 'pointer' }} onClick={handleCopy} />
  );
};

const HighlightText = ({ text, query }: { text: string; query: string }) => {
  if (!query.trim()) return <>{text}</>;
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} style={{ background: 'rgba(168, 85, 247, 0.25)', color: 'inherit', borderRadius: '2px', padding: '0 2px' }}>{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
};

export const HomeView = ({ history, onDelete, onCopy, searchQuery, onSearchChange }: HomeViewProps) => (
  <>
    <div className="header-row">
      <h1>Speech-Flow</h1>
    </div>
    
    {/* Search Bar */}
    <div className="search-bar">
      <Search size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      <input
        type="text"
        placeholder="Search your history..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="search-input"
      />
      {searchQuery && (
        <button
          className="search-clear"
          onClick={() => onSearchChange('')}
        >
          ✕
        </button>
      )}
    </div>

    <div className="timeline-container">
      {history.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>
          {searchQuery ? `No results for "${searchQuery}"` : 'No dictation history yet. Click the mic or use the desktop widget to start flowing!'}
        </div>
      ) : (
        history.map((group, idx) => (
          <div key={idx}>
            <div className="timeline-date">{group.date}</div>
            {group.items.map((item) => (
              <div key={item.id} className="timeline-item">
                <div className="timeline-node">
                  <div className="timeline-node-inner" />
                </div>
                <div className="timeline-content">
                  <div className="timeline-header">
                    <span className="timeline-time">{item.time}</span>
                    <div className="timeline-actions">
                      <CopyButton text={item.text} onCopy={onCopy} />
                      <Trash2 
                        size={16} 
                        style={{ cursor: 'pointer' }} 
                        onClick={() => onDelete(item.id)} 
                      />
                    </div>
                  </div>
                  <div className="timeline-text">
                    <HighlightText text={item.text} query={searchQuery} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  </>
);
