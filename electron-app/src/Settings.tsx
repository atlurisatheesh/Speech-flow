import { useState } from 'react';
import { X, Wand2, BookA, Keyboard, BarChart3, ShieldCheck } from 'lucide-react';
import './settings.css';

const TABS = [
  { id: 'general', label: 'General', icon: ShieldCheck },
  { id: 'voice', label: 'Voice Profile', icon: Wand2 },
  { id: 'dictionary', label: 'Dictionary', icon: BookA },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
  { id: 'stats', label: 'Flow State', icon: BarChart3 },
];

export default function Settings({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState('general');

  return (
    <div className="settings-overlay">
      <div className="settings-window">
        {/* Sidebar */}
        <div className="settings-sidebar">
          <div className="settings-header">
            <h2>Speech-Flow</h2>
          </div>
          <nav className="settings-nav">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  className={`nav-btn ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content Area */}
        <div className="settings-content">
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
          
          <div className="tab-content">
            {activeTab === 'general' && (
              <div className="animate-fade-in">
                <h3>General Settings</h3>
                <div className="setting-row">
                  <label>Launch at login</label>
                  <input type="checkbox" defaultChecked />
                </div>
                <div className="setting-row">
                  <label>Show in System Tray</label>
                  <input type="checkbox" defaultChecked />
                </div>
                <div className="setting-row">
                  <label>Microphone</label>
                  <select>
                    <option>Default (System)</option>
                  </select>
                </div>
              </div>
            )}
            
            {activeTab === 'voice' && (
              <div className="animate-fade-in">
                <h3>Voice Profile & Personalization</h3>
                <p className="setting-desc">How should the AI polish your raw speech?</p>
                <div className="setting-row">
                  <label>Work Tone</label>
                  <select defaultValue="excited">
                    <option value="excited">Excited & Energetic</option>
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                  </select>
                </div>
                <div className="setting-row">
                  <label>Email Tone</label>
                  <select defaultValue="professional">
                    <option value="professional">Professional</option>
                    <option value="direct">Direct & Concise</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'dictionary' && (
              <div className="animate-fade-in">
                <h3>Custom Dictionary</h3>
                <p className="setting-desc">Add names, acronyms, or technical jargon so the AI spells them correctly.</p>
                <div className="dictionary-input">
                  <input type="text" placeholder="Add word (e.g. Wispr Flow, PyInstaller)" />
                  <button>Add</button>
                </div>
                <div className="dictionary-list">
                  <div className="dict-tag">Speech-Flow <X size={12}/></div>
                  <div className="dict-tag">Vite <X size={12}/></div>
                  <div className="dict-tag">Electron <X size={12}/></div>
                </div>
              </div>
            )}

            {activeTab === 'stats' && (
              <div className="animate-fade-in stats-grid">
                <div className="stat-card">
                  <h4>Total Words</h4>
                  <p>12,450</p>
                </div>
                <div className="stat-card">
                  <h4>Time Saved</h4>
                  <p>4.2 hrs</p>
                </div>
                <div className="stat-card">
                  <h4>Top App</h4>
                  <p>VS Code</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
