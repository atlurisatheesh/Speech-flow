import { useState, useEffect, useCallback } from 'react';
import { Sliders, Keyboard } from 'lucide-react';

const BACKEND_URL = 'http://localhost:1993';
const electron = (window as any).electron;

const CLEANUP_STEPS = ['none', 'low', 'medium', 'high'];
const STYLES = ['professional', 'casual', 'technical', 'creative'];

interface Settings {
  cleanupLevel: string;
  style: string;
  language: string;
}

export const SettingsView = () => {
  const [settings, setSettings] = useState<Settings>({ cleanupLevel: 'medium', style: 'professional', language: 'auto' });
  const [languages, setLanguages] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      try {
        if (electron?.getSettings) {
          const s = await electron.getSettings();
          if (s) setSettings((prev) => ({ ...prev, ...s }));
        }
      } catch { /* noop */ }
      try {
        const res = await fetch(`${BACKEND_URL}/api/languages`);
        if (res.ok) {
          const data = await res.json();
          setLanguages(data.languages || {});
        }
      } catch { /* offline */ }
    })();
  }, []);

  const save = useCallback((next: Settings) => {
    setSettings(next);
    try { electron?.updateSettings?.(next); } catch { /* noop */ }
  }, []);

  const cleanupIdx = Math.max(0, CLEANUP_STEPS.indexOf(settings.cleanupLevel));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', paddingRight: '20px' }}>
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      <div className="hero-banner" style={{ background: 'linear-gradient(135deg, #1e3a8a, #0c1844)' }}>
        <h2>Tune how Flow writes for <em>you</em>.</h2>
        <p>Control how aggressively your dictation is cleaned, the writing style, and the spoken language.</p>
      </div>

      {/* Cleanup level slider */}
      <div className="glass-card" style={{ marginTop: '20px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Sliders size={18} /> Auto Cleanup</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '6px 0 16px' }}>
          How much AI cleans your dictation before pasting.
        </p>
        <input
          type="range"
          min={0}
          max={3}
          step={1}
          value={cleanupIdx}
          onChange={(e) => save({ ...settings, cleanupLevel: CLEANUP_STEPS[Number(e.target.value)] })}
          style={{ width: '100%' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
          {CLEANUP_STEPS.map((s) => (
            <span key={s} style={{ fontWeight: s === settings.cleanupLevel ? 700 : 400, textTransform: 'capitalize', color: s === settings.cleanupLevel ? '#3b82f6' : undefined }}>{s}</span>
          ))}
        </div>
      </div>

      {/* Style */}
      <div className="glass-card" style={{ marginTop: '16px' }}>
        <h3>Writing Style</h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
          {STYLES.map((s) => (
            <button
              key={s}
              onClick={() => save({ ...settings, style: s })}
              className="tag"
              style={{
                textTransform: 'capitalize', cursor: 'pointer',
                background: s === settings.style ? '#3b82f6' : undefined,
                color: s === settings.style ? '#fff' : undefined,
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Language */}
      <div className="glass-card" style={{ marginTop: '16px' }}>
        <h3>Dictation Language</h3>
        <select
          value={settings.language}
          onChange={(e) => save({ ...settings, language: e.target.value })}
          style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }}
        >
          <option value="auto">Auto-detect</option>
          {Object.entries(languages).map(([code, name]) => (
            <option key={code} value={code}>{name as string}</option>
          ))}
        </select>
      </div>

      {/* Hotkeys */}
      <div className="glass-card" style={{ marginTop: '16px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Keyboard size={18} /> Hotkeys</h3>
        <div style={{ marginTop: '12px', fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.9 }}>
          <div><strong>Ctrl/Cmd + Shift + Space</strong> — Start / stop dictation anywhere</div>
          <div><strong>Ctrl/Cmd + Shift + E</strong> — Polish highlighted text in place</div>
        </div>
      </div>
    </div>
  );
};
