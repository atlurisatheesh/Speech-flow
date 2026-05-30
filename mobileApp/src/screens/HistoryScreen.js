import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { getTranscriptions, deleteTranscription } from '../api';

export default function HistoryScreen() {
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await getTranscriptions();
      setItems(data);
    } catch (e) {
      // ignore — likely offline
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onDelete = (id) => {
    Alert.alert('Delete', 'Remove this transcription?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteTranscription(id);
            setItems((p) => p.filter((t) => t.id !== id));
          } catch (e) { /* noop */ }
        },
      },
    ]);
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.filename || 'Untitled'}</Text>
        <Text style={styles.cardText} numberOfLines={2}>{item.text}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={12} color={colors.muted} />
          <Text style={styles.meta}>{new Date(item.timestamp).toLocaleString()}</Text>
          {item.language ? <Text style={styles.lang}>{String(item.language).toUpperCase()}</Text> : null}
        </View>
      </View>
      <TouchableOpacity onPress={() => onDelete(item.id)} style={styles.delBtn}>
        <Ionicons name="trash-outline" size={18} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={<Text style={styles.empty}>No transcriptions yet. Record one in the Dictate tab.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, marginBottom: 10,
  },
  cardTitle: { fontWeight: '700', color: colors.fg, marginBottom: 4 },
  cardText: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  meta: { color: colors.muted, fontSize: 11 },
  lang: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  delBtn: { padding: 8, marginLeft: 8 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 60 },
});
