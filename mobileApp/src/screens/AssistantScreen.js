import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { startRecording, stopRecording, playBase64Audio } from '../audio';
import { assistantText, assistantVoice, getAssistantHistory } from '../api';
import { getVoice } from '../settings';

export default function AssistantScreen() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [recording, setRecording] = useState(null);
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const hist = await getAssistantHistory();
        const msgs = [];
        hist.forEach((m) => {
          msgs.push({ role: 'user', text: m.user_text });
          msgs.push({ role: 'assistant', text: m.assistant_text });
        });
        setMessages(msgs);
      } catch (e) { /* offline ok */ }
    })();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, thinking]);

  const sendText = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    setMessages((p) => [...p, { role: 'user', text }]);
    setThinking(true);
    try {
      const res = await assistantText(text, getVoice());
      setMessages((p) => [...p, { role: 'assistant', text: res.reply_text, audio: res.reply_audio_base64 }]);
      playBase64Audio(res.reply_audio_base64);
    } catch (e) {
      Alert.alert('Assistant error', e?.message || 'Failed');
    } finally {
      setThinking(false);
    }
  };

  const onMic = async () => {
    try {
      if (recording) {
        const rec = recording;
        setRecording(null);
        setThinking(true);
        const uri = await stopRecording(rec);
        const res = await assistantVoice(uri, getVoice());
        setMessages((p) => [
          ...p,
          { role: 'user', text: res.transcript },
          { role: 'assistant', text: res.reply_text, audio: res.reply_audio_base64 },
        ]);
        playBase64Audio(res.reply_audio_base64);
      } else {
        const rec = await startRecording();
        setRecording(rec);
      }
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed');
    } finally {
      setThinking(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={{ padding: 16 }}>
        {messages.length === 0 && !thinking && (
          <Text style={styles.empty}>Talk or type to your assistant. It uses your Personal Memory and replies aloud.</Text>
        )}
        {messages.map((m, i) => (
          <View key={i} style={[styles.bubbleRow, m.role === 'user' ? styles.rowRight : styles.rowLeft]}>
            <View style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
              <Text style={m.role === 'user' ? styles.userText : styles.assistantText}>{m.text}</Text>
              {m.role === 'assistant' && m.audio ? (
                <TouchableOpacity style={styles.playRow} onPress={() => playBase64Audio(m.audio)}>
                  <Ionicons name="volume-high" size={14} color={colors.primary} />
                  <Text style={styles.playText}>Play voice</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ))}
        {thinking && (
          <View style={[styles.bubbleRow, styles.rowLeft]}>
            <View style={[styles.bubble, styles.assistantBubble, { flexDirection: 'row', alignItems: 'center' }]}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.assistantText, { marginLeft: 8 }]}>Thinking…</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputBar}>
        <TouchableOpacity
          onPress={onMic}
          style={[styles.micBtn, recording && styles.micBtnActive]}
          testID="assistant-mic-button"
        >
          <Ionicons name={recording ? 'stop' : 'mic'} size={22} color="#fff" />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={recording ? 'Listening…' : 'Type a message…'}
          editable={!recording}
          onSubmitEditing={sendText}
          returnKeyType="send"
        />
        <TouchableOpacity onPress={sendText} style={styles.sendBtn} disabled={!input.trim() || thinking}>
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  messages: { flex: 1 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 60, paddingHorizontal: 24, lineHeight: 20 },
  bubbleRow: { marginBottom: 12, flexDirection: 'row' },
  rowRight: { justifyContent: 'flex-end' },
  rowLeft: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  userBubble: { backgroundColor: colors.userBubble },
  assistantBubble: { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border },
  userText: { color: '#fff', fontSize: 15, lineHeight: 21 },
  assistantText: { color: colors.fg, fontSize: 15, lineHeight: 21 },
  playRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  playText: { color: colors.primary, fontWeight: '700', fontSize: 12, marginLeft: 6 },
  inputBar: {
    flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg,
  },
  input: {
    flex: 1, backgroundColor: colors.secondary, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: colors.fg,
  },
  micBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  micBtnActive: { backgroundColor: colors.primaryDark },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.fg, alignItems: 'center', justifyContent: 'center' },
});
