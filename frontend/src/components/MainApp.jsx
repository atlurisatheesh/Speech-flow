import { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from './Sidebar';
import EditorPane from './EditorPane';
import { Toaster, toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MainApp = () => {
  const [transcriptions, setTranscriptions] = useState([]);
  const [dictionary, setDictionary] = useState([]);
  const [currentTranscript, setCurrentTranscript] = useState(null);
  const [currentAudioUrl, setCurrentAudioUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTranscriptions();
    fetchDictionary();
  }, []);

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

  const handleTranscribe = async (file, audioBlob = null) => {
    setLoading(true);

    // Set audio URL for playback (use blob for recordings, file for uploads)
    const blob = audioBlob || file;
    const audioUrl = URL.createObjectURL(blob);
    setCurrentAudioUrl(audioUrl);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API}/transcribe/file`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setCurrentTranscript(response.data);
      await fetchTranscriptions();
      toast.success('Transcription completed!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Transcription failed');
      console.error('Transcription error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessText = async (text) => {
    try {
      const response = await axios.post(`${API}/transcribe/process`, { text });
      return response.data.processed_text;
    } catch (error) {
      toast.error('Failed to process text');
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

  const handleSelectTranscript = (trans) => {
    setCurrentTranscript(trans);
    setCurrentAudioUrl(null); // Audio not available for historical transcripts
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

  return (
    <div className="flex h-screen" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
      <Sidebar
        transcriptions={transcriptions}
        dictionary={dictionary}
        onSelectTranscript={handleSelectTranscript}
        onDeleteTranscript={handleDeleteTranscript}
        onAddWord={handleAddWord}
        onDeleteWord={handleDeleteWord}
        currentTranscriptId={currentTranscript?.id}
      />
      <EditorPane
        transcript={currentTranscript}
        audioUrl={currentAudioUrl}
        onTranscribe={handleTranscribe}
        onProcessText={handleProcessText}
        onDiarize={handleDiarize}
        onExport={handleExport}
        loading={loading}
      />
      <Toaster position="top-right" richColors />
    </div>
  );
};

export default MainApp;
