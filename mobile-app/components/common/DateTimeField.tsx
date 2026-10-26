import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/constants/theme';
import { formatDate, formatTime } from '@/utils/date';

interface DateTimeFieldProps {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  error?: string;
}

/** Android shows date and time as two native dialogs in sequence. */
export function DateTimeField({ label, value, onChange, error }: DateTimeFieldProps) {
  const [mode, setMode] = useState<'date' | 'time' | null>(null);
  const current = value ? new Date(value) : new Date();

  const handleChange = (event: DateTimePickerEvent, picked?: Date) => {
    if (event.type !== 'set' || !picked) {
      setMode(null);
      return;
    }
    const next = new Date(current);
    if (mode === 'date') {
      next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
      onChange(next.toISOString());
      setMode('time');
    } else {
      next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
      onChange(next.toISOString());
      setMode(null);
    }
  };

  return (
    <View style={styles.row}>
      <View style={styles.iconCol}>
        <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={styles.label}>{label}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value ? `${formatDate(value)} ${formatTime(value)}` : 'not set'}`}
          onPress={() => setMode('date')}
          style={[styles.field, !!error && { borderColor: colors.red }]}
        >
          <Ionicons name="calendar" size={16} color={colors.primary} />
          <Text style={styles.value}>{value ? `${formatDate(value)} · ${formatTime(value)}` : 'Select date and time'}</Text>
        </Pressable>
        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>
      {mode && <DateTimePicker value={current} mode={mode} onChange={handleChange} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  iconCol: { width: 28, paddingTop: 30, alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '500', color: colors.textMuted },
  field: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
  },
  value: { fontSize: 15, color: colors.text },
  error: { fontSize: 12, color: colors.red },
});
