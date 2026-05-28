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

  const handleTranscribe = async (file) => {
    setLoading(true);
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

  const handleDeleteTranscript = async (id) => {
    try {
      await axios.delete(`${API}/transcriptions/${id}`);
      setTranscriptions(transcriptions.filter(t => t.id !== id));
      if (currentTranscript?.id === id) {
        setCurrentTranscript(null);
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
        onSelectTranscript={setCurrentTranscript}
        onDeleteTranscript={handleDeleteTranscript}
        onAddWord={handleAddWord}
        onDeleteWord={handleDeleteWord}
        currentTranscriptId={currentTranscript?.id}
      />
      <EditorPane
        transcript={currentTranscript}
        onTranscribe={handleTranscribe}
        onProcessText={handleProcessText}
        loading={loading}
      />
      <Toaster position="top-right" richColors />
    </div>
  );
};

export default MainApp;
