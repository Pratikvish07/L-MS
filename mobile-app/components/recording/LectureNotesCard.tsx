import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/common/AppButton';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { colors, radius } from '@/constants/theme';
import { pickNotesFile, previewNote, removeLectureNote, uploadLectureNote } from '@/services/notes.service';
import type { Recording } from '@/types/recording.types';
import { confirm } from '@/utils/confirm';
import { formatBytes } from '@/utils/file-size';

/** Lecture notes (Word / PDF): list with Preview, add, remove. Students of the batch see the same files. */
export function LectureNotesCard({ recording, uploadedBy, editable = true }: { recording: Recording; uploadedBy: string; editable?: boolean }) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    setError(null);
    try {
      const file = await pickNotesFile();
      if (!file) return;
      setProgress(0);
      await uploadLectureNote(recording, recording.id, file, uploadedBy, setProgress);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not upload the notes.');
    } finally {
      setProgress(null);
    }
  };
  const remove = async (index: number) => {
    const note = recording.lectureNotes[index];
    if (!(await confirm('Remove notes?', `${note.name} will be removed for students too.`, 'Remove'))) return;
    try { await removeLectureNote(recording.id, note); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not remove the notes.'); }
  };
  const open = async (index: number) => {
    try { await previewNote(recording.lectureNotes[index]); } catch { setError('Could not open the preview on this device.'); }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Notes</Text>
      {recording.lectureNotes.map((note, index) => (
        <View key={note.path} style={styles.row}>
          <Ionicons name={note.contentType === 'application/pdf' ? 'document-text-outline' : 'document-outline'} size={22} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={styles.name}>{note.name}</Text>
            <Text style={styles.meta}>{formatBytes(note.size)}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Preview ${note.name}`} onPress={() => void open(index)} style={styles.preview}><Text style={styles.previewText}>Preview</Text></Pressable>
          {editable && <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${note.name}`} onPress={() => void remove(index)} hitSlop={8}><Ionicons name="trash-outline" size={19} color={colors.red} /></Pressable>}
        </View>
      ))}
      {!recording.lectureNotes.length && <Text style={styles.meta}>No notes added yet.</Text>}
      {progress !== null && <Text style={styles.meta}>Uploading… {Math.round(progress * 100)}%</Text>}
      {error && <ErrorBanner message={error} />}
      {editable && <AppButton title="Add notes (Word / PDF)" icon="attach" variant="secondary" onPress={() => void add()} loading={progress !== null} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 12, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 14, fontWeight: '600', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted },
  preview: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  previewText: { fontSize: 13, fontWeight: '600', color: colors.primary },
});
