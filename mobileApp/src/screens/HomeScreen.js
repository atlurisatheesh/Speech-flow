import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { startRecording, stopRecording } from '../audio';
import { transcribeFile } from '../api';

export default function HomeScreen() {
  const [recording, setRecording] = useState(null);
  const [busy, setBusy] = useState(false);
  const [transcript, setTranscript] = useState('');

  const onToggle = async () => {
    try {
      if (recording) {
        const rec = recording;
        setRecording(null);
        setBusy(true);
        const uri = await stopRecording(rec);
        const result = await transcribeFile(uri);
        setTranscript(result.text || '');
      } else {
        const rec = await startRecording();
        setRecording(rec);
        setTranscript('');
      }
    } catch (e) {
      Alert.alert('Error', e?.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.title}>Transform speech{'\n'}into perfect text</Text>
        <Text style={styles.subtitle}>Tap the mic, speak, and SpeechFlow transcribes it instantly.</Text>
      </View>

      <View style={styles.micWrap}>
        <TouchableOpacity
          onPress={onToggle}
          disabled={busy}
          style={[styles.micButton, recording && styles.micButtonActive]}
          testID="dictate-mic-button"
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons name={recording ? 'stop' : 'mic'} size={40} color="#fff" />
          )}
        </TouchableOpacity>
        <Text style={styles.micLabel}>
          {busy ? 'Transcribing…' : recording ? 'Recording — tap to stop' : 'Tap to record'}
        </Text>
      </View>

      <ScrollView style={styles.resultBox} contentContainerStyle={{ padding: 16 }}>
        {transcript ? (
          <Text style={styles.resultText}>{transcript}</Text>
        ) : (
          <Text style={styles.placeholder}>Your transcript will appear here.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20 },
  hero: { marginTop: 8 },
  title: { fontSize: 30, fontWeight: '900', color: colors.fg, letterSpacing: -1 },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 8 },
  micWrap: { alignItems: 'center', marginTop: 28, marginBottom: 18 },
  micButton: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  micButtonActive: { backgroundColor: colors.primaryDark },
  micLabel: { marginTop: 14, color: colors.muted, fontWeight: '600' },
  resultBox: { flex: 1, backgroundColor: colors.secondary, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  resultText: { fontSize: 16, lineHeight: 24, color: colors.fg },
  placeholder: { fontSize: 14, color: colors.muted },
});
