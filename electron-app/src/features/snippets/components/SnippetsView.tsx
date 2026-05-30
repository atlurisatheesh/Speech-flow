import { useState, useEffect, useCallback } from 'react';
import { Trash2 } from 'lucide-react';

const BACKEND_URL = 'http://localhost:1993';

interface Snippet {
  id: string;
  trigger_phrase: string;
  content: string;
}

export const SnippetsView = () => {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [trigger, setTrigger] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/snippets`);
      if (res.ok) setSnippets(await res.json());
    } catch {
      /* backend offline */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    const t = trigger.trim();
    const c = content.trim();
    if (!t || !c) return;
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/snippets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger_phrase: t, content: c }),
      });
      if (res.ok) {
        setTrigger('');
        setContent('');
        load();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || 'Could not add snippet');
      }
    } catch {
      setError('Backend not reachable');
    }
  };

  const remove = async (id: string) => {
    try {
      await fetch(`${BACKEND_URL}/api/snippets/${id}`, { method: 'DELETE' });
      setSnippets((prev) => prev.filter((s) => s.id !== id));
    } catch {
      /* noop */
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', paddingRight: '20px' }}>
      <div className="page-header">
        <h1>Snippets</h1>
      </div>

      <div className="hero-banner" style={{ background: 'linear-gradient(135deg, #064e3b, #022c22)' }}>
        <h2>The stuff <em>you</em> shouldn't have to re-type.</h2>
        <p>Save anything you type often — your email, an intro, a prompt — and say the trigger phrase while dictating to expand it in place.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '16px 0' }}>
        <input
          value={trigger}
          onChange={(e) => setTrigger(e.target.value)}
          placeholder='Trigger phrase (e.g. "my email")'
          style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Expands to… (e.g. satheesh.atluri56@gmail.com)"
            style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}
          />
          <button className="btn-primary" onClick={add}>Add</button>
        </div>
      </div>
      {error ? <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '8px' }}>{error}</p> : null}

      <div className="list-table">
        {snippets.length === 0 ? (
          <div className="list-row" style={{ opacity: 0.6 }}>No snippets yet. Create your first shortcut above.</div>
        ) : (
          snippets.map((s) => (
            <div className="list-row" key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{s.trigger_phrase} <span className="arrow">→</span> {s.content}</span>
              <button onClick={() => remove(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }} title="Delete">
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
