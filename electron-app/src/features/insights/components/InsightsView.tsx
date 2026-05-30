import { Sparkline } from './Sparkline';

interface InsightsViewProps {
  analytics: {
    total_words: number;
    total_transcriptions: number;
    avg_wpm: number;
    streak: number;
    daily_words: number[];
    total_duration_minutes: number;
  } | null;
}

export const InsightsView = ({ analytics }: InsightsViewProps) => {
  const data = analytics || {
    total_words: 0,
    total_transcriptions: 0,
    avg_wpm: 0,
    streak: 0,
    daily_words: [],
    total_duration_minutes: 0,
  };

  // Calculate gauge angle for WPM (0-200 range)
  const wpmPercent = Math.min(data.avg_wpm / 200, 1);
  const dashOffset = 125 - (125 * wpmPercent);

  // Streak calendar: last 48 days
  const streakDays = data.streak;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', paddingRight: '20px' }}>
      <div className="page-header">
        <h1>Insights</h1>
      </div>
      <div className="tabs-row">
        <span className="tab-link active">Your Usage</span>
        <span className="tab-link">Your Voice</span>
      </div>
      
      <div className="insights-grid">
        <div className="insight-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 style={{ alignSelf: 'flex-start' }}>WORDS PER MINUTE</h3>
          <div style={{ position: 'relative', width: '120px', height: '60px', marginTop: '20px' }}>
            <svg viewBox="0 0 100 50">
              <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#E5E7EB" strokeWidth="12" />
              <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#0f766e" strokeWidth="12" strokeDasharray="125" strokeDashoffset={dashOffset} />
            </svg>
            <div style={{ position: 'absolute', top: '25px', left: 0, right: 0, textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '700' }}>{data.avg_wpm}</div>
            </div>
          </div>
          <div style={{ marginTop: '16px', fontSize: '14px', color: 'var(--text-muted)' }}>
            {data.avg_wpm > 120 ? 'Top 5%' : data.avg_wpm > 80 ? 'Above average' : 'Keep going!'}
          </div>
        </div>
        
        <div className="insight-card">
          <div className="insight-value">{data.total_transcriptions}</div>
          <div className="insight-label" style={{ marginBottom: '24px' }}>Total transcriptions</div>
          <div style={{ fontSize: '13px', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{data.total_duration_minutes} min recorded</span> <span>⏱️</span></div>
          </div>
        </div>
        
        <div className="insight-card">
          <div className="insight-value">{data.total_words.toLocaleString()}</div>
          <div className="insight-label" style={{ marginBottom: '24px' }}>Total words dictated</div>
          <div style={{ marginTop: '8px' }}>
            <Sparkline data={data.daily_words} />
          </div>
        </div>
      </div>
      
      <div className="insights-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="insight-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '20px' }}>Daily Activity</h3>
            <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)' }}>LAST 30 DAYS</span>
          </div>
          <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '80px' }}>
            {data.daily_words.map((words, i) => {
              const max = Math.max(...data.daily_words, 1);
              const heightPct = Math.max((words / max) * 100, 4);
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: `${heightPct}%`,
                    background: words > 0 ? 'linear-gradient(to top, #a855f7, #06b6d4)' : '#F3F4F6',
                    borderRadius: '2px',
                    transition: 'height 0.3s ease',
                  }}
                  title={`${words} words`}
                />
              );
            })}
          </div>
        </div>
        
        <div className="insight-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '24px' }}>
            <h3 style={{ margin: 0, fontSize: '20px' }}>{streakDays} day streak 🔥</h3>
            <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)' }}>CURRENT STREAK</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '4px' }}>
            {Array.from({ length: 48 }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: '100%',
                  aspectRatio: '1/1',
                  background: i >= (48 - streakDays) ? 'linear-gradient(135deg, #a855f7, #06b6d4)' : '#F3F4F6',
                  borderRadius: '3px',
                  transition: 'background 0.3s ease',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
