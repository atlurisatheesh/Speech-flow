import { useState, useEffect, useCallback } from 'react';
import { Trash2 } from 'lucide-react';

const BACKEND_URL = 'http://localhost:1993';

interface Word {
  id: string;
  word: string;
}

export const DictionaryView = () => {
  const [words, setWords] = useState<Word[]>([]);
  const [newWord, setNewWord] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/dictionary`);
      if (res.ok) setWords(await res.json());
    } catch {
      /* backend offline */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addWord = async () => {
    const word = newWord.trim();
    if (!word) return;
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/dictionary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word }),
      });
      if (res.ok) {
        setNewWord('');
        load();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || 'Could not add word');
      }
    } catch {
      setError('Backend not reachable');
    }
  };

  const remove = async (id: string) => {
    try {
      await fetch(`${BACKEND_URL}/api/dictionary/${id}`, { method: 'DELETE' });
      setWords((prev) => prev.filter((w) => w.id !== id));
    } catch {
      /* noop */
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', paddingRight: '20px' }}>
      <div className="page-header">
        <h1>Dictionary</h1>
      </div>

      <div className="hero-banner" style={{ background: 'linear-gradient(135deg, #78350f, #451a03)' }}>
        <h2>Flow spells the way <em>you</em> do.</h2>
        <p>Add custom words, names, company jargon or client names. They are sent to the transcriber so your dictation spells them correctly — automatically.</p>
      </div>

      <div style={{ display: 'flex', gap: '8px', margin: '16px 0' }}>
        <input
          value={newWord}
          onChange={(e) => setNewWord(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addWord()}
          placeholder="Add a word or name (e.g. Satheesh, Spyder)"
          style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}
        />
        <button className="btn-primary" onClick={addWord}>Add</button>
      </div>
      {error ? <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '8px' }}>{error}</p> : null}

      <div className="list-table">
        {words.length === 0 ? (
          <div className="list-row" style={{ opacity: 0.6 }}>No words yet. Add your first custom term above.</div>
        ) : (
          words.map((w) => (
            <div className="list-row" key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{w.word}</span>
              <button onClick={() => remove(w.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }} title="Delete">
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
