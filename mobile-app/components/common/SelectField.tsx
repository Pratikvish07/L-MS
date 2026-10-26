import { Ionicons } from '@expo/vector-icons';
import { useState, type ComponentProps } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius } from '@/constants/theme';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
  error?: string;
  /** Lets the user type a value that is not in the list. */
  allowCustom?: boolean;
  disabled?: boolean;
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select',
  icon,
  error,
  allowCustom,
  disabled,
}: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = options.find((o) => o.value === value);
  const filtered = options.filter((o) => o.label.toLowerCase().includes(search.trim().toLowerCase()));
  const canUseCustom =
    allowCustom && search.trim().length > 0 && !options.some((o) => o.label.toLowerCase() === search.trim().toLowerCase());

  const choose = (next: string) => {
    onChange(next);
    setSearch('');
    setOpen(false);
  };

  return (
    <View style={styles.row}>
      {icon && (
        <View style={styles.iconCol}>
          <Ionicons name={icon} size={20} color={colors.textMuted} />
        </View>
      )}
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={styles.label}>{label}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${selected?.label ?? (value || placeholder)}`}
          accessibilityHint="Opens a list of options"
          disabled={disabled}
          onPress={() => setOpen(true)}
          style={[styles.field, !!error && { borderColor: colors.red }, disabled && { opacity: 0.6 }]}
        >
          <Text numberOfLines={1} style={[styles.value, !value && { color: '#9CA3AF' }]}>
            {selected?.label ?? (value || placeholder)}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        </Pressable>
        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{label}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} onPress={() => setOpen(false)}>
              <Ionicons name="close" size={26} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.search}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              accessibilityLabel={`Search ${label}`}
              placeholder={allowCustom ? 'Search or type a new value' : 'Search'}
              value={search}
              onChangeText={setSearch}
              style={{ flex: 1, fontSize: 15, paddingVertical: 10 }}
              autoFocus
            />
          </View>
          {canUseCustom && (
            <Pressable accessibilityRole="button" style={styles.option} onPress={() => choose(search.trim())}>
              <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
              <Text style={[styles.optionText, { color: colors.primaryDark }]}>Use “{search.trim()}”</Text>
            </Pressable>
          )}
          <FlatList
            data={filtered}
            keyExtractor={(o) => o.value}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={styles.empty}>
                {options.length ? 'No matches.' : 'No options yet. An administrator can add them in the Admin CMS.'}
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: item.value === value }}
                style={styles.option}
                onPress={() => choose(item.value)}
              >
                <Text style={styles.optionText}>{item.label}</Text>
                {item.value === value && <Ionicons name="checkmark" size={20} color={colors.primary} />}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
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
    backgroundColor: colors.surface,
  },
  value: { flex: 1, fontSize: 15, color: colors.text },
  error: { fontSize: 12, color: colors.red },
  modal: { flex: 1, backgroundColor: colors.surface },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionText: { flex: 1, fontSize: 16, color: colors.text },
  empty: { padding: 24, textAlign: 'center', color: colors.textMuted },
});
