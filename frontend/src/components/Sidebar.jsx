import { useState } from 'react';
import { Clock, Trash2, Plus, X, FileText, BookMarked } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { motion } from 'framer-motion';

const Sidebar = ({
  transcriptions,
  dictionary,
  onSelectTranscript,
  onDeleteTranscript,
  onAddWord,
  onDeleteWord,
  currentTranscriptId
}) => {
  const [newWord, setNewWord] = useState('');

  const handleAddWord = () => {
    if (newWord.trim()) {
      onAddWord(newWord.trim());
      setNewWord('');
    }
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div 
      className="w-[280px] border-r border-[#E4E4E7] bg-[#F7F7F8] flex flex-col"
      data-testid="sidebar"
    >
      <div className="p-6 border-b border-[#E4E4E7]">
        <h1 
          className="text-2xl font-black tracking-tighter leading-none" 
          style={{ fontFamily: 'Outfit, sans-serif' }}
          data-testid="app-title"
        >
          SpeechFlow
        </h1>
        <p className="text-xs text-[#52525B] mt-1">AI-Powered Transcription</p>
      </div>

      <Tabs defaultValue="history" className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-4 grid w-auto grid-cols-2 bg-white" data-testid="sidebar-tabs">
          <TabsTrigger value="history" className="text-xs font-semibold" data-testid="history-tab">
            <FileText className="w-3 h-3 mr-1" />
            HISTORY
          </TabsTrigger>
          <TabsTrigger value="dictionary" className="text-xs font-semibold" data-testid="dictionary-tab">
            <BookMarked className="w-3 h-3 mr-1" />
            DICTIONARY
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="flex-1 mt-4 mx-0">
          <ScrollArea className="h-[calc(100vh-200px)] px-4">
            <div className="space-y-2">
              {transcriptions.length === 0 ? (
                <p className="text-sm text-[#A1A1AA] text-center py-8" data-testid="empty-history">
                  No transcriptions yet
                </p>
              ) : (
                transcriptions.map((trans, index) => (
                  <motion.div
                    key={trans.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => onSelectTranscript(trans)}
                    className={`
                      p-3 rounded-sm border cursor-pointer
                      transition-colors duration-200
                      ${
                        currentTranscriptId === trans.id
                          ? 'bg-white border-[#002FA7] shadow-sm'
                          : 'bg-white border-[#E4E4E7] hover:border-[#002FA7]/40'
                      }
                    `}
                    data-testid={`transcript-item-${trans.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#0A0A0B] truncate">
                          {trans.filename || 'Untitled'}
                        </p>
                        <p className="text-xs text-[#52525B] mt-1 line-clamp-2">
                          {trans.text.substring(0, 60)}...
                        </p>
                        <div className="flex items-center mt-2 text-xs text-[#A1A1AA]">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatDate(trans.timestamp)}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTranscript(trans.id);
                        }}
                        className="ml-2 p-1 hover:bg-[#EF4444]/10 rounded transition-colors"
                        data-testid={`delete-transcript-${trans.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-[#EF4444]" />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="dictionary" className="flex-1 mt-4 mx-0">
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
                className="bg-[#002FA7] hover:bg-[#002FA7]/90 rounded-sm"
                data-testid="add-word-button"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <ScrollArea className="h-[calc(100vh-280px)] px-4">
            <div className="space-y-1">
              {dictionary.length === 0 ? (
                <p className="text-sm text-[#A1A1AA] text-center py-8" data-testid="empty-dictionary">
                  No custom words yet
                </p>
              ) : (
                dictionary.map((word) => (
                  <div
                    key={word.id}
                    className="flex items-center justify-between p-2 bg-white border border-[#E4E4E7] rounded-sm hover:border-[#002FA7]/40 transition-colors"
                    data-testid={`dictionary-word-${word.id}`}
                  >
                    <span className="text-sm font-medium text-[#0A0A0B]">{word.word}</span>
                    <button
                      onClick={() => onDeleteWord(word.id)}
                      className="p-1 hover:bg-[#EF4444]/10 rounded transition-colors"
                      data-testid={`delete-word-${word.id}`}
                    >
                      <X className="w-3.5 h-3.5 text-[#EF4444]" />
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
