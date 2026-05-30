import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';

const BACKEND_URL = 'http://localhost:1993';

interface VoiceProfile {
  id: string;
  name: string;
  tone: string;
  format: string;
  system_prompt?: string;
  icon: string;
}

const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional', desc: 'Formal & authoritative' },
  { value: 'casual', label: 'Casual', desc: 'Friendly & conversational' },
  { value: 'technical', label: 'Technical', desc: 'Precise & domain-specific' },
  { value: 'creative', label: 'Creative', desc: 'Engaging & expressive' },
];

const FORMAT_OPTIONS = [
  { value: 'paragraph', label: 'Paragraphs' },
  { value: 'bullets', label: 'Bullet Points' },
  { value: 'email', label: 'Email Format' },
  { value: 'code', label: 'Code / Technical' },
];

const ICON_OPTIONS = ['✨', '💼', '💻', '📧', '📝', '🎯', '🧪', '🎨', '📋', '🔬'];

export const VoiceProfilesView = () => {
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // New profile form state
  const [name, setName] = useState('');
  const [tone, setTone] = useState('professional');
  const [format, setFormat] = useState('paragraph');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [icon, setIcon] = useState('✨');

  const fetchProfiles = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/voice-profiles`);
      if (res.ok) setProfiles(await res.json());
    } catch (err) {
      console.warn('Could not fetch profiles:', err);
    }
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/voice-profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, tone, format, system_prompt: systemPrompt || undefined, icon }),
      });
      if (res.ok) {
        setShowCreate(false);
        setName(''); setTone('professional'); setFormat('paragraph'); setSystemPrompt(''); setIcon('✨');
        fetchProfiles();
      }
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${BACKEND_URL}/api/voice-profiles/${id}`, { method: 'DELETE' });
      setProfiles(prev => prev.filter(p => p.id !== id));
      if (activeId === id) setActiveId(null);
    } catch (err) { console.error(err); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', paddingRight: '20px' }}>
      <div className="page-header">
        <h1>Voice Profiles</h1>
        <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>
          <Plus size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          New Profile
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div style={{
          background: 'white',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '18px' }}>Create Voice Profile</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., Code Review"
                style={{ width: '100%', padding: '10px 14px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '8px', fontSize: '14px', fontFamily: 'Outfit', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Icon</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {ICON_OPTIONS.map(i => (
                  <button
                    key={i}
                    onClick={() => setIcon(i)}
                    style={{
                      width: '36px', height: '36px', border: icon === i ? '2px solid var(--accent-purple)' : '1px solid rgba(0,0,0,0.1)',
                      borderRadius: '8px', background: icon === i ? 'rgba(168,85,247,0.1)' : 'white', fontSize: '18px', cursor: 'pointer',
                    }}
                  >{i}</button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Tone</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {TONE_OPTIONS.map(t => (
                  <button key={t.value} onClick={() => setTone(t.value)} style={{
                    padding: '8px 12px', border: tone === t.value ? '2px solid var(--accent-purple)' : '1px solid rgba(0,0,0,0.1)',
                    borderRadius: '8px', background: tone === t.value ? 'rgba(168,85,247,0.1)' : 'white', textAlign: 'left', cursor: 'pointer',
                    fontSize: '13px', fontFamily: 'Outfit',
                  }}>
                    <strong>{t.label}</strong> <span style={{ color: 'var(--text-muted)' }}>— {t.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Format</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {FORMAT_OPTIONS.map(f => (
                  <button key={f.value} onClick={() => setFormat(f.value)} style={{
                    padding: '8px 12px', border: format === f.value ? '2px solid var(--accent-purple)' : '1px solid rgba(0,0,0,0.1)',
                    borderRadius: '8px', background: format === f.value ? 'rgba(168,85,247,0.1)' : 'white', textAlign: 'left', cursor: 'pointer',
                    fontSize: '13px', fontFamily: 'Outfit',
                  }}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Custom System Prompt (optional)</label>
            <textarea
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              placeholder="Add custom instructions for how AI should format your text..."
              rows={3}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '8px', fontSize: '14px', fontFamily: 'Outfit', resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowCreate(false)} style={{ padding: '8px 16px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '8px', background: 'white', cursor: 'pointer', fontFamily: 'Outfit' }}>Cancel</button>
            <button onClick={handleCreate} className="btn-primary">Create Profile</button>
          </div>
        </div>
      )}

      {/* Profile Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
        {profiles.map(p => (
          <div
            key={p.id}
            onClick={() => setActiveId(p.id === activeId ? null : p.id)}
            style={{
              background: p.id === activeId ? 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(6,182,212,0.08))' : 'white',
              border: p.id === activeId ? '2px solid var(--accent-purple)' : '1px solid rgba(0,0,0,0.06)',
              borderRadius: '16px',
              padding: '24px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              position: 'relative',
            }}
          >
            {p.id === activeId && (
              <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'var(--accent-purple)', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={12} />
              </div>
            )}
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>{p.icon}</div>
            <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '4px' }}>{p.name}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              {p.tone} · {p.format}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
              style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}

        {profiles.length === 0 && !showCreate && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✨</div>
            <p>No voice profiles yet. Create one to customize how AI formats your dictations!</p>
          </div>
        )}
      </div>
    </div>
  );
};
