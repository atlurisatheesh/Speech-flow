import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface PlaceholderViewProps {
  title: string;
  icon: LucideIcon;
  description: string;
}

export const PlaceholderView: React.FC<PlaceholderViewProps> = ({ title, icon: Icon, description }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
    <Icon size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
    <h2 style={{ marginBottom: '8px', color: 'var(--text-main)' }}>{title}</h2>
    <p style={{ textAlign: 'center', maxWidth: '400px' }}>{description}</p>
  </div>
);
