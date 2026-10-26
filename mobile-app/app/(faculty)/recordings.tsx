import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ErrorBanner } from '@/components/common/ErrorBanner';
import { LoadingView } from '@/components/common/LoadingView';
import { AppHeader } from '@/components/layout/AppHeader';
import { RecordingCard } from '@/components/recording/RecordingCard';
import { colors, radius } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/useAuth';
import { useRecordings } from '@/hooks/useRecordings';
import { PENDING_STATUSES, UPLOADED_STATUSES, type Recording } from '@/types/recording.types';

const FILTERS = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'uploaded', label: 'Uploaded', match: (r: Recording) => UPLOADED_STATUSES.includes(r.status) },
  { key: 'uploading', label: 'Uploading', match: (r: Recording) => r.status === 'uploading' },
  { key: 'pending', label: 'Pending', match: (r: Recording) => PENDING_STATUSES.includes(r.status) && r.status !== 'failed' },
  { key: 'failed', label: 'Failed', match: (r: Recording) => r.status === 'failed' },
] as const;

export default function RecordingsScreen() {
  const user = useCurrentUser();
  const { recordings, loading, error } = useRecordings(user.uid);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matcher = FILTERS.find((f) => f.key === filter)!.match;
    return recordings.filter(
      (r) =>
        matcher(r) &&
        (!term || [r.topic, r.chapter, r.className, r.classroomName].some((v) => v.toLowerCase().includes(term))),
    );
  }, [recordings, search, filter]);

  return (
    <View style={styles.screen}>
      <AppHeader title="Recordings" />
      <View style={styles.controls}>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            accessibilityLabel="Search recordings"
            placeholder="Search by topic, chapter, class…"
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />
        </View>
        <View style={styles.chips}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === f.key }}
              onPress={() => setFilter(f.key)}
              style={[styles.chip, filter === f.key && styles.chipActive]}
            >
              <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading ? (
        <LoadingView />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={error ? <ErrorBanner message={error} /> : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="film-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>
                {recordings.length ? 'No recordings match your search.' : 'No recordings yet. Start one from the Home tab.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <RecordingCard
              recording={item}
              onPress={() => router.push({ pathname: '/recording-details/[id]', params: { id: item.id } })}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  controls: { padding: 16, paddingBottom: 4, gap: 12 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 11, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.text, fontWeight: '500' },
  chipTextActive: { color: colors.white },
  list: { padding: 16, gap: 10 },
  empty: { alignItems: 'center', gap: 10, paddingTop: 48 },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
});
