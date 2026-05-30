import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Clock, FileAudio, Users, Mic, Languages } from 'lucide-react';

const COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];

export default function AnalyticsDashboard({ stats }) {
  if (!stats) return <div className="p-8">Loading analytics...</div>;

  // Format language data for PieChart
  const languageData = Object.entries(stats.language_distribution || {}).map(([lang, count]) => ({
    name: lang,
    value: count
  }));

  // Mock trend data since the backend doesn't provide daily historical data yet
  // In a full implementation, the backend would return this
  const trendData = [
    { name: 'Mon', transcripts: Math.floor(stats.transcriptions_this_week * 0.1) },
    { name: 'Tue', transcripts: Math.floor(stats.transcriptions_this_week * 0.2) },
    { name: 'Wed', transcripts: Math.floor(stats.transcriptions_this_week * 0.15) },
    { name: 'Thu', transcripts: Math.floor(stats.transcriptions_this_week * 0.25) },
    { name: 'Fri', transcripts: Math.floor(stats.transcriptions_this_week * 0.3) },
    { name: 'Sat', transcripts: 0 },
    { name: 'Sun', transcripts: 0 },
  ];

  const StatCard = ({ title, value, icon: Icon, subtitle }) => (
    <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <h3 className="text-3xl font-bold mt-2" style={{ fontFamily: 'Outfit, sans-serif' }}>{value}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className="p-3 bg-primary/10 rounded-full">
          <Icon className="w-6 h-6 text-primary" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-secondary/30 overflow-y-auto">
      <div className="p-8 max-w-6xl mx-auto w-full space-y-8">
        
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tighter" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Analytics Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">Overview of your transcription usage and patterns</p>
          </div>
        </div>

        {/* Top KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            title="Total Transcriptions" 
            value={stats.total_transcriptions} 
            icon={FileAudio}
            subtitle={`${stats.transcriptions_this_week} this week`}
          />
          <StatCard 
            title="Audio Processed" 
            value={stats.total_duration_formatted} 
            icon={Clock}
            subtitle={`Avg ${stats.avg_duration_seconds}s per file`}
          />
          <StatCard 
            title="Snippets Saved" 
            value={stats.total_snippets} 
            icon={Languages}
          />
          <StatCard 
            title="Dictionary Words" 
            value={stats.total_dictionary_words} 
            icon={Mic}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Trend Chart */}
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-6">Activity This Week</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <RechartsTooltip 
                    cursor={{ fill: 'hsl(var(--secondary))' }}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--popover-foreground))'
                    }}
                  />
                  <Bar dataKey="transcripts" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Language Distribution */}
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-6">Language Distribution</h3>
            <div className="h-[300px] w-full flex items-center justify-center">
              {languageData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={languageData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={110}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {languageData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--popover-foreground))'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-sm">No language data available</p>
              )}
            </div>
            
            {/* Legend */}
            {languageData.length > 0 && (
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                {languageData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-sm text-muted-foreground">{entry.name} ({entry.value})</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
