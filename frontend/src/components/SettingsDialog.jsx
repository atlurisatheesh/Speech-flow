import { useState } from 'react';
import { X, Settings } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { motion } from 'framer-motion';

const SettingsDialog = ({ settings, languages, onSave, onClose }) => {
  const [local, setLocal] = useState({ ...settings });

  const update = (key, value) => {
    setLocal(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(local);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-background border border-border rounded-sm shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        data-testid="settings-dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>Settings</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[500px] overflow-y-auto">
          {/* Language */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.15em] font-bold text-muted-foreground">Preferred Language</Label>
            <Select value={local.preferred_language} onValueChange={(v) => update('preferred_language', v)}>
              <SelectTrigger className="rounded-sm" data-testid="settings-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                <SelectItem value="auto">Auto-detect</SelectItem>
                {Object.entries(languages).map(([code, name]) => (
                  <SelectItem key={code} value={code}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Default Tone */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.15em] font-bold text-muted-foreground">Default AI Tone</Label>
            <Select value={local.default_tone} onValueChange={(v) => update('default_tone', v)}>
              <SelectTrigger className="rounded-sm" data-testid="settings-tone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
                <SelectItem value="technical">Technical</SelectItem>
                <SelectItem value="creative">Creative</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Default Format */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.15em] font-bold text-muted-foreground">Default AI Format</Label>
            <Select value={local.default_format} onValueChange={(v) => update('default_format', v)}>
              <SelectTrigger className="rounded-sm" data-testid="settings-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paragraph">Paragraph</SelectItem>
                <SelectItem value="bullets">Bullets</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="code">Code/Tech</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Default Export Format */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.15em] font-bold text-muted-foreground">Default Export Format</Label>
            <Select value={local.default_export_format} onValueChange={(v) => update('default_export_format', v)}>
              <SelectTrigger className="rounded-sm" data-testid="settings-export">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="txt">Plain Text (.txt)</SelectItem>
                <SelectItem value="srt">SubRip (.srt)</SelectItem>
                <SelectItem value="vtt">WebVTT (.vtt)</SelectItem>
                <SelectItem value="json">JSON (.json)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Playback Speed */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.15em] font-bold text-muted-foreground">Playback Speed</Label>
            <Select value={String(local.playback_speed)} onValueChange={(v) => update('playback_speed', parseFloat(v))}>
              <SelectTrigger className="rounded-sm" data-testid="settings-speed">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.5">0.5x</SelectItem>
                <SelectItem value="0.75">0.75x</SelectItem>
                <SelectItem value="1">1x (Normal)</SelectItem>
                <SelectItem value="1.25">1.25x</SelectItem>
                <SelectItem value="1.5">1.5x</SelectItem>
                <SelectItem value="2">2x</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Auto Enhance */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium text-foreground">Auto-enhance on transcription</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Automatically clean up text after transcription completes</p>
            </div>
            <Switch
              checked={local.auto_enhance}
              onCheckedChange={(v) => update('auto_enhance', v)}
              data-testid="settings-auto-enhance"
            />
          </div>

          {/* Theme */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium text-foreground">Dark Mode</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Switch between light and dark themes</p>
            </div>
            <Switch
              checked={local.theme === 'dark'}
              onCheckedChange={(v) => update('theme', v ? 'dark' : 'light')}
              data-testid="settings-dark-mode"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={onClose} className="rounded-sm">Cancel</Button>
          <Button onClick={handleSave} className="bg-primary rounded-sm" data-testid="settings-save">Save Settings</Button>
        </div>
      </motion.div>
    </div>
  );
};

export default SettingsDialog;
