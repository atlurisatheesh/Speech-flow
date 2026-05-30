import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { VOICE_OPTIONS, getVoice, setVoice } from '../settings';
import { getMemory, addMemory, deleteMemory } from '../api';
import { BACKEND_URL } from '../config';

export default function SettingsScreen() {
  const [voice, setVoiceState] = useState(getVoice());
  const [memory, setMemory] = useState([]);
  const [newMem, setNewMem] = useState('');

  const loadMemory = useCallback(async () => {
    try {
      const data = await getMemory();
      setMemory(data);
    } catch (e) { /* offline */ }
  }, []);

  useFocusEffect(useCallback(() => { loadMemory(); }, [loadMemory]));
  useEffect(() => { setVoice(voice); }, [voice]);

  const onAdd = async () => {
    const c = newMem.trim();
    if (!c) return;
    try {
      await addMemory(c);
      setNewMem('');
      loadMemory();
    } catch (e) {
      Alert.alert('Error', 'Could not save memory');
    }
  };

  const onDelete = async (id) => {
    try {
      await deleteMemory(id);
      setMemory((p) => p.filter((m) => m.id !== id));
    } catch (e) { /* noop */ }
  };

  return (
    <FlatList
      style={styles.container}
      data={memory}
      keyExtractor={(m) => m.id}
      contentContainerStyle={{ padding: 16 }}
      ListHeaderComponent={
        <View>
          <Text style={styles.section}>Assistant Voice</Text>
          <Text style={styles.hint}>Preset neural voices (no cloning).</Text>
          <View style={styles.voiceWrap}>
            {VOICE_OPTIONS.map((v) => (
              <TouchableOpacity
                key={v}
                onPress={() => setVoiceState(v)}
                style={[styles.chip, voice === v && styles.chipActive]}
              >
                <Text style={[styles.chipText, voice === v && styles.chipTextActive]}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.section, { marginTop: 24 }]}>Personal Memory</Text>
          <Text style={styles.hint}>Facts your assistant uses to answer & draft replies.</Text>
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              value={newMem}
              onChangeText={setNewMem}
              placeholder="e.g. I'm a software engineer named Satheesh"
              onSubmitEditing={onAdd}
              returnKeyType="done"
            />
            <TouchableOpacity onPress={onAdd} style={styles.addBtn}>
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.memCard}>
          <Text style={styles.memText}>{item.content}</Text>
          <TouchableOpacity onPress={() => onDelete(item.id)}>
            <Ionicons name="close" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>No memories yet.</Text>}
      ListFooterComponent={
        <Text style={styles.footer}>Connected to{'\n'}{BACKEND_URL}</Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  section: { fontSize: 18, fontWeight: '900', color: colors.fg },
  hint: { color: colors.muted, fontSize: 13, marginTop: 4, marginBottom: 12 },
  voiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondary },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.fg, fontWeight: '600', textTransform: 'capitalize' },
  chipTextActive: { color: '#fff' },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, backgroundColor: colors.secondary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: colors.fg },
  addBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  memCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginTop: 10,
  },
  memText: { flex: 1, color: colors.fg, marginRight: 10 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 20 },
  footer: { color: colors.muted, fontSize: 11, textAlign: 'center', marginTop: 28 },
});
