import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ErrorBanner } from '@/components/common/ErrorBanner';
import { LoadingView } from '@/components/common/LoadingView';
import { AppHeader } from '@/components/layout/AppHeader';
import { colors, radius } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/useAuth';
import { useCatalog } from '@/hooks/useCatalog';
import { academicLabel } from '@/utils/academics';

/** Subjects assigned to this faculty member; tap one to manage its chapters and topics. */
export default function SubjectsScreen() {
  const user = useCurrentUser();
  const { degrees, streams, subjects, loading, error } = useCatalog();
  const mine = subjects.filter((s) => s.facultyUids.includes(user.uid));

  if (loading) return <LoadingView />;

  return (
    <View style={styles.screen}>
      <AppHeader title="My Subjects" />
      <FlatList
        data={mine}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            {error && <ErrorBanner message={error} />}
            {mine.length > 0 && <Text style={styles.intro}>Add the chapters and topics you teach. They appear when you start a recording.</Text>}
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="library-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>No subjects are assigned to you yet. Ask the administrator to assign them in the Admin CMS.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const degree = degrees.find((d) => d.id === item.degreeId);
          const stream = streams.find((s) => s.id === item.streamId);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.name}. Manage chapters and topics`}
              onPress={() => router.push({ pathname: '/subject/[id]', params: { id: item.id } })}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.icon}>
                <Ionicons name="library" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.title}>{item.name}</Text>
                <Text style={styles.meta}>
                  {academicLabel(degree?.name ?? '', stream?.code ?? '', item.year)}
                  {item.code ? ` · ${item.code}` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, gap: 10 },
  intro: { fontSize: 13, color: colors.textMuted, marginBottom: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted },
  empty: { alignItems: 'center', gap: 10, paddingTop: 48, paddingHorizontal: 24 },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
});
