import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ErrorBanner } from '@/components/common/ErrorBanner';
import { LoadingView } from '@/components/common/LoadingView';
import { AppHeader } from '@/components/layout/AppHeader';
import { colors, radius } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/useAuth';
import { useCatalog } from '@/hooks/useCatalog';
import { useChapters } from '@/hooks/useChapters';
import { addChapter, addTopic, deleteChapter, removeTopic, renameChapter } from '@/services/chapters.service';
import type { Chapter } from '@/types/catalog.types';
import { academicLabel } from '@/utils/academics';
import { confirm } from '@/utils/confirm';
import { goBack } from '@/utils/navigation';

/** Single-line input with an add button, used for chapters and topics. */
function AddRow({ placeholder, onAdd, autoFocus }: { placeholder: string; onAdd: (value: string) => Promise<void>; autoFocus?: boolean }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!value.trim() || busy) return;
    setBusy(true);
    try {
      await onAdd(value.trim());
      setValue('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.addRow}>
      <TextInput
        accessibilityLabel={placeholder}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        style={styles.addInput}
        maxLength={120}
        returnKeyType="done"
        onSubmitEditing={submit}
        autoFocus={autoFocus}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add ${placeholder.toLowerCase()}`}
        disabled={!value.trim() || busy}
        onPress={submit}
        style={[styles.addButton, (!value.trim() || busy) && { opacity: 0.4 }]}
      >
        <Ionicons name="add" size={22} color={colors.white} />
      </Pressable>
    </View>
  );
}

function ChapterCard({ chapter, subjectId, onError }: { chapter: Chapter; subjectId: string; onError: (m: string) => void }) {
  const [open, setOpen] = useState(chapter.topics.length === 0);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(chapter.name);

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not save. Check that this subject is assigned to you.');
    }
  };

  return (
    <View style={styles.chapter}>
      <View style={styles.chapterHead}>
        {editing ? (
          <TextInput
            accessibilityLabel="Chapter name"
            value={name}
            onChangeText={setName}
            style={[styles.addInput, { flex: 1 }]}
            autoFocus
            maxLength={120}
            onSubmitEditing={() => {
              if (name.trim()) run(() => renameChapter(subjectId, chapter.id, name));
              setEditing(false);
            }}
          />
        ) : (
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((o) => !o)} style={styles.chapterTitle}>
            <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={18} color={colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.chapterName}>{chapter.name}</Text>
              <Text style={styles.meta}>
                {chapter.topics.length} topic{chapter.topics.length === 1 ? '' : 's'}
                {chapter.createdByName ? ` · added by ${chapter.createdByName}` : ''}
              </Text>
            </View>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={editing ? 'Save chapter name' : `Rename ${chapter.name}`}
          hitSlop={8}
          onPress={() => {
            if (editing && name.trim() && name.trim() !== chapter.name) run(() => renameChapter(subjectId, chapter.id, name));
            setEditing((e) => !e);
          }}
          style={styles.iconBtn}
        >
          <Ionicons name={editing ? 'checkmark' : 'create-outline'} size={18} color={colors.text} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${chapter.name}`}
          hitSlop={8}
          onPress={async () => {
            if (await confirm('Delete chapter?', `“${chapter.name}” and its ${chapter.topics.length} topic(s) will be removed. Existing recordings keep their details.`, 'Delete')) {
              run(() => deleteChapter(subjectId, chapter.id));
            }
          }}
          style={styles.iconBtn}
        >
          <Ionicons name="trash-outline" size={18} color={colors.red} />
        </Pressable>
      </View>

      {open && (
        <View style={styles.topics}>
          {chapter.topics.map((topic) => (
            <View key={topic} style={styles.topic}>
              <Ionicons name="ellipse" size={6} color={colors.primary} />
              <Text style={styles.topicText}>{topic}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove topic ${topic}`}
                hitSlop={8}
                onPress={async () => {
                  if (await confirm('Remove topic?', `“${topic}” will be removed from ${chapter.name}.`, 'Remove')) {
                    run(() => removeTopic(subjectId, chapter.id, topic));
                  }
                }}
              >
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
          <AddRow
            placeholder="Topic name"
            onAdd={async (topic) => {
              if (chapter.topics.some((t) => t.toLowerCase() === topic.toLowerCase())) {
                onError(`“${topic}” is already in ${chapter.name}.`);
                return;
              }
              await run(() => addTopic(subjectId, chapter.id, topic));
            }}
          />
        </View>
      )}
    </View>
  );
}

export default function SubjectChaptersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useCurrentUser();
  const { degrees, streams, subjects, loading } = useCatalog();
  const { chapters, loading: chaptersLoading, error: loadError } = useChapters(id);
  const [error, setError] = useState<string | null>(null);

  const subject = subjects.find((s) => s.id === id);
  if (loading) return <LoadingView />;

  const degree = degrees.find((d) => d.id === subject?.degreeId);
  const stream = streams.find((s) => s.id === subject?.streamId);
  const assigned = !!subject?.facultyUids.includes(user.uid);

  return (
    <View style={styles.screen}>
      <AppHeader title={subject?.name ?? 'Subject'} left={{ icon: 'arrow-back', label: 'Back', onPress: () => goBack('/subjects') }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {subject && (
            <Text style={styles.subtitle}>
              {academicLabel(degree?.name ?? '', stream?.code ?? '', subject.year)}
              {subject.code ? ` · ${subject.code}` : ''}
            </Text>
          )}
          {!subject && <ErrorBanner message="This subject is no longer available." />}
          {subject && !assigned && <ErrorBanner message="This subject is not assigned to you, so you can view but not change its chapters." />}
          {(error || loadError) && <ErrorBanner message={(error || loadError)!} />}

          {subject && assigned && (
            <View style={styles.newChapter}>
              <Text style={styles.sectionTitle}>Add chapter</Text>
              <AddRow
                placeholder="Chapter name, e.g. Chapter 1 - Matrices"
                autoFocus={chapters.length === 0}
                onAdd={async (name) => {
                  setError(null);
                  if (chapters.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
                    setError(`“${name}” already exists.`);
                    return;
                  }
                  try {
                    await addChapter(subject.id, name, user);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Could not add the chapter.');
                  }
                }}
              />
            </View>
          )}

          {chaptersLoading ? (
            <LoadingView />
          ) : chapters.length === 0 ? (
            <Text style={styles.empty}>No chapters yet. Add your first chapter above, then its topics.</Text>
          ) : (
            chapters.map((c) => <ChapterCard key={c.id} chapter={c} subjectId={id} onError={setError} />)
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  subtitle: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  newChapter: { gap: 8 },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addInput: {
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  addButton: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  chapter: { borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  chapterHead: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12 },
  chapterTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  chapterName: { fontSize: 15, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topics: { paddingHorizontal: 14, paddingBottom: 14, gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  topic: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  topicText: { flex: 1, fontSize: 14, color: colors.text },
  empty: { fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingVertical: 24 },
});
