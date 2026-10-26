import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/common/AppButton';
import { Avatar } from '@/components/common/Avatar';
import { AppHeader } from '@/components/layout/AppHeader';
import { colors, radius } from '@/constants/theme';
import { useAuth, useCurrentUser } from '@/hooks/useAuth';
import { confirm } from '@/utils/confirm';

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || '—'}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const user = useCurrentUser();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    if (await confirm('Sign out?', 'You will need to sign in again to record lectures.', 'Sign out')) {
      await signOut();
    }
  };

  return (
    <View style={styles.screen}>
      <AppHeader title="Profile" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Avatar name={user.displayName} uri={user.photoURL} size={80} />
          <Text style={styles.name}>{user.displayName}</Text>
          <Text style={styles.email}>{user.email}</Text>
        </View>
        <View style={styles.card}>
          <Row label="Role" value="Faculty" />
          <Row label="Faculty ID" value={user.facultyId} />
          <Row label="Subject" value={user.subject} />
        </View>
        <Text style={styles.note}>Profile details are managed by your LMS administrator.</Text>
        <AppButton title="Sign out" icon="log-out-outline" variant="danger" onPress={handleSignOut} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16 },
  header: { alignItems: 'center', gap: 6, paddingVertical: 12 },
  name: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 6 },
  email: { fontSize: 14, color: colors.textMuted },
  card: { borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  label: { fontSize: 14, color: colors.textMuted },
  value: { fontSize: 14, color: colors.text, fontWeight: '600' },
  note: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
});
