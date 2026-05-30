import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Sidebar from './Sidebar';
import EditorPane from './EditorPane';
import AnalyticsDashboard from './AnalyticsDashboard';
import SettingsDialog from './SettingsDialog';
import KeyboardShortcutsOverlay from './KeyboardShortcutsOverlay';
import VoiceAssistant from './VoiceAssistant';
import { Toaster, toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MainApp = () => {
  const [transcriptions, setTranscriptions] = useState([]);
  const [dictionary, setDictionary] = useState([]);
  const [snippets, setSnippets] = useState([]);
  const [currentTranscript, setCurrentTranscript] = useState(null);
  const [currentAudioUrl, setCurrentAudioUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [languages, setLanguages] = useState({});
  const [selectedLanguage, setSelectedLanguage] = useState('auto');
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [settings, setSettings] = useState({
    preferred_language: 'auto',
    default_export_format: 'txt',
    auto_enhance: false,
    default_tone: 'professional',
    default_format: 'paragraph',
    theme: 'light',
    playback_speed: 1.0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [stats, setStats] = useState(null);

  const [activeTab, setActiveTab] = useState('editor');

  useEffect(() => {
    fetchTranscriptions();
    fetchDictionary();
    fetchSnippets();
    fetchLanguages();
    fetchSettings();
    fetchStats();
  }, []);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e) => {
    // ? — show shortcuts overlay
    if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const tagName = e.target.tagName.toLowerCase();
      if (tagName !== 'input' && tagName !== 'textarea') {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      }
    }
    // Ctrl+Shift+E — AI Enhance
    if (e.ctrlKey && e.shiftKey && e.key === 'E') {
      e.preventDefault();
      document.querySelector('[data-testid="ai-enhance-button"]')?.click();
    }
    // Ctrl+Shift+D — Diarize
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      document.querySelector('[data-testid="diarize-button"]')?.click();
    }
    // Ctrl+Shift+F — Search
    if (e.ctrlKey && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      document.querySelector('[data-testid="search-input"]')?.focus();
    }
    // Ctrl+Shift+S — Settings
    if (e.ctrlKey && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      setShowSettings(prev => !prev);
    }
    // Escape — close overlays
    if (e.key === 'Escape') {
      setShowShortcuts(false);
      setShowSettings(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const fetchTranscriptions = async () => {
    try {
      const response = await axios.get(`${API}/transcriptions`);
      setTranscriptions(response.data);
    } catch (error) {
      console.error('Error fetching transcriptions:', error);
    }
  };

  const fetchDictionary = async () => {
    try {
      const response = await axios.get(`${API}/dictionary`);
      setDictionary(response.data);
    } catch (error) {
      console.error('Error fetching dictionary:', error);
    }
  };

  const fetchSnippets = async () => {
    try {
      const response = await axios.get(`${API}/snippets`);
      setSnippets(response.data);
    } catch (error) {
      console.error('Error fetching snippets:', error);
    }
  };

  const fetchLanguages = async () => {
    try {
      const response = await axios.get(`${API}/languages`);
      setLanguages(response.data.languages);
    } catch (error) {
      console.error('Error fetching languages:', error);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/settings`);
      if (response.data) {
        setSettings(prev => ({ ...prev, ...response.data }));
        setSelectedLanguage(response.data.preferred_language || 'auto');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const getAudioUrlForTranscript = (transcript) => {
    if (!transcript) return null;
    if (transcript.audio_path) {
      return `${API}/transcriptions/${transcript.id}/audio`;
    }
    return null;
  };

  const handleTranscribe = async (file, language) => {
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    const params = {};
    if (language && language !== 'auto') {
      params.language = language;
    } else if (selectedLanguage && selectedLanguage !== 'auto') {
      params.language = selectedLanguage;
    }

    try {
      const response = await axios.post(`${API}/transcribe/file`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        params
      });
      
      setCurrentTranscript(response.data);
      const audioUrl = getAudioUrlForTranscript(response.data) ||
        URL.createObjectURL(file);
      setCurrentAudioUrl(audioUrl);
      setActiveTab('editor');
      await fetchTranscriptions();
      await fetchStats();
      toast.success('Transcription completed!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Transcription failed');
      console.error('Transcription error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchTranscribe = async (files) => {
    setLoading(true);
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    const params = {};
    if (selectedLanguage && selectedLanguage !== 'auto') {
      params.language = selectedLanguage;
    }

    try {
      const response = await axios.post(`${API}/transcribe/batch`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        params
      });
      
      const { completed_files, failed_files } = response.data;
      await fetchTranscriptions();
      await fetchStats();
      toast.success(`Batch complete: ${completed_files} transcribed, ${failed_files} failed`);
      return response.data;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Batch transcription failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleProcessText = async (text, tone = null, format = null) => {
    try {
      const response = await axios.post(`${API}/transcribe/process`, { 
        text,
        tone: tone || settings.default_tone,
        format: format || settings.default_format
      });
      return response.data.processed_text;
    } catch (error) {
      toast.error('Failed to process text');
      throw error;
    }
  };

  const handleCommandEdit = async (text, instruction) => {
    try {
      const response = await axios.post(`${API}/transcribe/command`, { text, instruction });
      return response.data.result_text;
    } catch (error) {
      toast.error('Command failed');
      throw error;
    }
  };

  const handleSummarize = async (text, style = 'meeting_notes') => {
    try {
      const response = await axios.post(`${API}/transcribe/summarize`, { text, style });
      return response.data;
    } catch (error) {
      toast.error('Summarization failed');
      throw error;
    }
  };

  const handleTranslate = async (text, targetLanguage) => {
    try {
      const response = await axios.post(`${API}/transcribe/translate`, { 
        text, 
        target_language: targetLanguage 
      });
      return response.data;
    } catch (error) {
      toast.error('Translation failed');
      throw error;
    }
  };

  const handleDiarize = async (segments) => {
    try {
      const response = await axios.post(`${API}/transcribe/diarize`, { segments });
      return response.data.segments;
    } catch (error) {
      toast.error('Failed to identify speakers');
      throw error;
    }
  };

  const handleExport = async (transcriptId, format) => {
    try {
      const response = await axios.get(
        `${API}/transcriptions/${transcriptId}/export/${format}`,
        { responseType: 'blob' }
      );
      const blob = new Blob([response.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transcript-${Date.now()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${format.toUpperCase()}!`);
    } catch (error) {
      toast.error(`Failed to export as ${format.toUpperCase()}`);
    }
  };

  const handleUpdateSpeakerLabels = async (transcriptId, labels) => {
    try {
      await axios.patch(`${API}/transcriptions/${transcriptId}/speakers`, {
        speaker_labels: labels
      });
      setCurrentTranscript(prev => prev ? { ...prev, speaker_labels: labels } : prev);
      setTranscriptions(prev => prev.map(t => 
        t.id === transcriptId ? { ...t, speaker_labels: labels } : t
      ));
      toast.success('Speaker names updated!');
    } catch (error) {
      toast.error('Failed to update speaker names');
    }
  };

  const handleUpdateTranscription = async (transcriptId, updateData) => {
    try {
      await axios.patch(`${API}/transcriptions/${transcriptId}`, updateData);
      if (updateData.text && currentTranscript?.id === transcriptId) {
        setCurrentTranscript(prev => ({ ...prev, ...updateData }));
      }
      toast.success('Transcript saved');
    } catch (error) {
      toast.error('Failed to save changes');
    }
  };

  const handleSelectTranscript = (trans) => {
    setCurrentTranscript(trans);
    setCurrentAudioUrl(getAudioUrlForTranscript(trans));
    setActiveTab('editor');
  };

  const handleDeleteTranscript = async (id) => {
    try {
      await axios.delete(`${API}/transcriptions/${id}`);
      setTranscriptions(transcriptions.filter(t => t.id !== id));
      if (currentTranscript?.id === id) {
        setCurrentTranscript(null);
        setCurrentAudioUrl(null);
      }
      toast.success('Transcript deleted');
      fetchStats();
    } catch (error) {
      toast.error('Failed to delete transcript');
    }
  };

  const handleAddWord = async (word) => {
    try {
      await axios.post(`${API}/dictionary`, { word });
      await fetchDictionary();
      toast.success('Word added to dictionary');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add word');
    }
  };

  const handleDeleteWord = async (id) => {
    try {
      await axios.delete(`${API}/dictionary/${id}`);
      await fetchDictionary();
      toast.success('Word removed from dictionary');
    } catch (error) {
      toast.error('Failed to remove word');
    }
  };

  // Snippet handlers
  const handleAddSnippet = async (snippet) => {
    try {
      await axios.post(`${API}/snippets`, snippet);
      await fetchSnippets();
      toast.success('Snippet created');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create snippet');
    }
  };

  const handleUpdateSnippet = async (id, update) => {
    try {
      await axios.put(`${API}/snippets/${id}`, update);
      await fetchSnippets();
      toast.success('Snippet updated');
    } catch (error) {
      toast.error('Failed to update snippet');
    }
  };

  const handleDeleteSnippet = async (id) => {
    try {
      await axios.delete(`${API}/snippets/${id}`);
      await fetchSnippets();
      toast.success('Snippet deleted');
    } catch (error) {
      toast.error('Failed to delete snippet');
    }
  };

  // Search
  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    try {
      const response = await axios.get(`${API}/transcriptions/search`, { params: { q: query } });
      setSearchResults(response.data);
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  // Settings
  const handleSaveSettings = async (newSettings) => {
    try {
      await axios.put(`${API}/settings`, { ...newSettings, id: 'default' });
      setSettings(newSettings);
      if (newSettings.preferred_language) {
        setSelectedLanguage(newSettings.preferred_language);
      }
      toast.success('Settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'dashboard') {
      fetchStats();
    }
  };

  return (
    <div className={`flex h-screen ${settings.theme === 'dark' ? 'dark' : ''}`} style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
      <Sidebar
        transcriptions={searchResults || transcriptions}
        dictionary={dictionary}
        snippets={snippets}
        onSelectTranscript={handleSelectTranscript}
        onDeleteTranscript={handleDeleteTranscript}
        onAddWord={handleAddWord}
        onDeleteWord={handleDeleteWord}
        onAddSnippet={handleAddSnippet}
        onUpdateSnippet={handleUpdateSnippet}
        onDeleteSnippet={handleDeleteSnippet}
        onSearch={handleSearch}
        searchQuery={searchQuery}
        currentTranscriptId={currentTranscript?.id}
        onOpenSettings={() => setShowSettings(true)}
        stats={stats}
        theme={settings.theme}
        onToggleTheme={() => handleSaveSettings({ ...settings, theme: settings.theme === 'dark' ? 'light' : 'dark' })}
        isSearching={searchResults !== null}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />
      {activeTab === 'dashboard' ? (
        <div className="flex-1 bg-background">
          <AnalyticsDashboard stats={stats} />
        </div>
      ) : activeTab === 'assistant' ? (
        <VoiceAssistant />
      ) : (
        <EditorPane
          transcript={currentTranscript}
          audioUrl={currentAudioUrl}
          onTranscribe={handleTranscribe}
          onBatchTranscribe={handleBatchTranscribe}
          onProcessText={handleProcessText}
          onCommandEdit={handleCommandEdit}
          onDiarize={handleDiarize}
          onSummarize={handleSummarize}
          onTranslate={handleTranslate}
          onExport={handleExport}
          onUpdateSpeakerLabels={handleUpdateSpeakerLabels}
          onUpdateTranscription={handleUpdateTranscription}
          apiUrl={API}
          loading={loading}
          languages={languages}
          selectedLanguage={selectedLanguage}
          onLanguageChange={setSelectedLanguage}
          settings={settings}
          playbackSpeed={settings.playback_speed}
        />
      )}
      
      {showSettings && (
        <SettingsDialog
          settings={settings}
          languages={languages}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showShortcuts && (
        <KeyboardShortcutsOverlay onClose={() => setShowShortcuts(false)} />
      )}

      <Toaster position="top-right" richColors />
    </div>
  );
};

export default MainApp;
