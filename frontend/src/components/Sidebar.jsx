import { useState } from 'react';
import { Clock, Trash2, Plus, X, FileText, BookMarked, Search, Settings, Zap, Sun, Moon, BarChart3, Pencil, Check, Sparkles } from 'lucide-react';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { motion } from 'framer-motion';

const Sidebar = ({
  transcriptions,
  dictionary,
  snippets = [],
  onSelectTranscript,
  onDeleteTranscript,
  onAddWord,
  onDeleteWord,
  onAddSnippet,
  onUpdateSnippet,
  onDeleteSnippet,
  onSearch,
  searchQuery,
  currentTranscriptId,
  onOpenSettings,
  stats,
  theme,
  onToggleTheme,
  isSearching,
  activeTab,
  onTabChange
}) => {
  const [newWord, setNewWord] = useState('');
  const [newSnippetTrigger, setNewSnippetTrigger] = useState('');
  const [newSnippetContent, setNewSnippetContent] = useState('');
  const [showNewSnippet, setShowNewSnippet] = useState(false);
  const [editingSnippetId, setEditingSnippetId] = useState(null);
  const [editingSnippetContent, setEditingSnippetContent] = useState('');

  const handleAddWord = () => {
    if (newWord.trim()) {
      onAddWord(newWord.trim());
      setNewWord('');
    }
  };

  const handleAddSnippet = () => {
    if (newSnippetTrigger.trim() && newSnippetContent.trim()) {
      onAddSnippet({
        trigger_phrase: newSnippetTrigger.trim(),
        content: newSnippetContent.trim(),
      });
      setNewSnippetTrigger('');
      setNewSnippetContent('');
      setShowNewSnippet(false);
    }
  };

  const handleEditSnippet = (snippet) => {
    setEditingSnippetId(snippet.id);
    setEditingSnippetContent(snippet.content);
  };

  const handleSaveSnippetEdit = (id) => {
    if (editingSnippetContent.trim()) {
      onUpdateSnippet(id, { content: editingSnippetContent.trim() });
    }
    setEditingSnippetId(null);
    setEditingSnippetContent('');
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div 
      className="w-[300px] border-r border-border bg-secondary flex flex-col"
      data-testid="sidebar"
    >
      {/* Header */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 
              className="text-2xl font-black tracking-tighter leading-none text-foreground" 
              style={{ fontFamily: 'Outfit, sans-serif' }}
              data-testid="app-title"
            >
              SpeechFlow
            </h1>
            <p className="text-xs text-muted-foreground mt-1">AI-Powered Transcription</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onTabChange?.('assistant')}
              className={`p-2 rounded-sm transition-colors ${activeTab === 'assistant' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              data-testid="assistant-button"
              title="AI Voice Assistant"
            >
              <Sparkles className="w-4 h-4" />
            </button>
            <button
              onClick={() => onTabChange?.('dashboard')}
              className={`p-2 rounded-sm transition-colors ${activeTab === 'dashboard' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              data-testid="dashboard-button"
              title="Analytics Dashboard"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              onClick={onToggleTheme}
              className="p-2 text-muted-foreground hover:text-foreground rounded-sm transition-colors"
              data-testid="theme-toggle"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={onOpenSettings}
              className="p-2 text-muted-foreground hover:text-foreground rounded-sm transition-colors"
              data-testid="settings-button"
              title="Settings (Ctrl+Shift+S)"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search transcriptions..."
            className="text-sm rounded-sm pl-9 pr-8 bg-background"
            data-testid="search-input"
          />
          {searchQuery && (
            <button
              onClick={() => onSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="px-5 py-3 border-b border-border bg-primary/5">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="w-3 h-3 text-primary" />
              <span className="font-semibold text-foreground">{stats.total_transcriptions}</span>
              <span className="text-muted-foreground">total</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-primary" />
              <span className="font-semibold text-foreground">{stats.total_duration_formatted}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-foreground">{stats.transcriptions_this_week}</span>
              <span className="text-muted-foreground">this week</span>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="history" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-4 mt-4 grid w-auto grid-cols-3 bg-background" data-testid="sidebar-tabs">
          <TabsTrigger value="history" className="text-xs font-semibold" data-testid="history-tab">
            <FileText className="w-3 h-3 mr-1" />
            HISTORY
          </TabsTrigger>
          <TabsTrigger value="snippets" className="text-xs font-semibold" data-testid="snippets-tab">
            <Zap className="w-3 h-3 mr-1" />
            SNIPPETS
          </TabsTrigger>
          <TabsTrigger value="dictionary" className="text-xs font-semibold" data-testid="dictionary-tab">
            <BookMarked className="w-3 h-3 mr-1" />
            DICT
          </TabsTrigger>
        </TabsList>

        {/* History Tab */}
        <TabsContent value="history" className="flex-1 mt-4 mx-0 overflow-hidden">
          {isSearching && (
            <div className="px-4 pb-2">
              <p className="text-xs text-primary font-semibold">
                {transcriptions.length} result{transcriptions.length !== 1 ? 's' : ''} for "{searchQuery}"
              </p>
            </div>
          )}
          <ScrollArea className="h-[calc(100vh-320px)] px-4">
            <div className="space-y-2">
              {transcriptions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8" data-testid="empty-history">
                  {isSearching ? 'No matching transcriptions' : 'No transcriptions yet'}
                </p>
              ) : (
                transcriptions.map((trans, index) => (
                  <motion.div
                    key={trans.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => onSelectTranscript(trans)}
                    className={`
                      p-3 rounded-sm border cursor-pointer
                      transition-colors duration-200
                      ${
                        currentTranscriptId === trans.id
                          ? 'bg-background border-primary shadow-sm'
                          : 'bg-background border-border hover:border-primary/40'
                      }
                    `}
                    data-testid={`transcript-item-${trans.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {trans.filename || 'Untitled'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {trans.text.substring(0, 60)}...
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(trans.timestamp)}</span>
                          {trans.language && (
                            <span className="uppercase font-semibold text-primary">{trans.language}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTranscript(trans.id);
                        }}
                        className="ml-2 p-1 hover:bg-destructive/10 rounded transition-colors"
                        data-testid={`delete-transcript-${trans.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Snippets Tab */}
        <TabsContent value="snippets" className="flex-1 mt-4 mx-0 overflow-hidden">
          <div className="px-4 pb-3">
            {!showNewSnippet ? (
              <Button
                onClick={() => setShowNewSnippet(true)}
                size="sm"
                className="w-full bg-primary hover:bg-primary/90 rounded-sm"
                data-testid="new-snippet-button"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Snippet
              </Button>
            ) : (
              <div className="space-y-2 bg-background border border-border rounded-sm p-3">
                <Input
                  value={newSnippetTrigger}
                  onChange={(e) => setNewSnippetTrigger(e.target.value)}
                  placeholder="Trigger phrase (e.g., 'email sig')"
                  className="text-sm rounded-sm"
                  data-testid="snippet-trigger-input"
                />
                <Textarea
                  value={newSnippetContent}
                  onChange={(e) => setNewSnippetContent(e.target.value)}
                  placeholder="Snippet content..."
                  className="text-sm rounded-sm min-h-[80px] resize-none"
                  data-testid="snippet-content-input"
                />
                <div className="flex gap-2">
                  <Button onClick={handleAddSnippet} size="sm" className="bg-primary rounded-sm flex-1" data-testid="save-snippet-button">
                    Save
                  </Button>
                  <Button onClick={() => setShowNewSnippet(false)} size="sm" variant="outline" className="rounded-sm">
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          <ScrollArea className="h-[calc(100vh-340px)] px-4">
            <div className="space-y-2">
              {snippets.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8" data-testid="empty-snippets">
                  No snippets yet. Create voice shortcuts for frequently used text.
                </p>
              ) : (
                snippets.map((snippet) => (
                  <div
                    key={snippet.id}
                    className="bg-background border border-border rounded-sm p-3 hover:border-primary/40 transition-colors"
                    data-testid={`snippet-${snippet.id}`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-primary">
                        {snippet.trigger_phrase}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => editingSnippetId === snippet.id ? handleSaveSnippetEdit(snippet.id) : handleEditSnippet(snippet)}
                          className="p-1 text-muted-foreground hover:text-primary rounded transition-colors"
                        >
                          {editingSnippetId === snippet.id ? <Check className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                        </button>
                        <button
                          onClick={() => onDeleteSnippet(snippet.id)}
                          className="p-1 hover:bg-destructive/10 rounded transition-colors"
                        >
                          <X className="w-3.5 h-3.5 text-destructive" />
                        </button>
                      </div>
                    </div>
                    {editingSnippetId === snippet.id ? (
                      <Textarea
                        value={editingSnippetContent}
                        onChange={(e) => setEditingSnippetContent(e.target.value)}
                        className="text-xs min-h-[60px] resize-none mt-1"
                        autoFocus
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground line-clamp-3">
                        {snippet.content}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Dictionary Tab */}
        <TabsContent value="dictionary" className="flex-1 mt-4 mx-0 overflow-hidden">
          <div className="px-4 pb-4">
            <div className="flex gap-2">
              <Input
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddWord()}
                placeholder="Add custom word"
                className="text-sm rounded-sm"
                data-testid="dictionary-input"
              />
              <Button
                onClick={handleAddWord}
                size="sm"
                className="bg-primary hover:bg-primary/90 rounded-sm"
                data-testid="add-word-button"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <ScrollArea className="h-[calc(100vh-340px)] px-4">
            <div className="space-y-1">
              {dictionary.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8" data-testid="empty-dictionary">
                  No custom words yet
                </p>
              ) : (
                dictionary.map((word) => (
                  <div
                    key={word.id}
                    className="flex items-center justify-between p-2 bg-background border border-border rounded-sm hover:border-primary/40 transition-colors"
                    data-testid={`dictionary-word-${word.id}`}
                  >
                    <span className="text-sm font-medium text-foreground">{word.word}</span>
                    <button
                      onClick={() => onDeleteWord(word.id)}
                      className="p-1 hover:bg-destructive/10 rounded transition-colors"
                      data-testid={`delete-word-${word.id}`}
                    >
                      <X className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Sidebar;
