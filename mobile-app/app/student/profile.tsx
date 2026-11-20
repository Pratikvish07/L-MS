import { Ionicons } from '@expo/vector-icons';
import { useState, type ComponentProps } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { AppInput } from '@/components/common/AppInput';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Card, Chip, StudentButton, StudentHeader, studentStyles as s } from '@/components/student/StudentUi';
import { sColors } from '@/constants/studentTheme';
import { useStudentEnrollment } from '@/hooks/useStudent';
import { updateMyProfile } from '@/services/student.service';

function Row({ icon, label, value }: { icon: ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
  return (
    <View style={s.row}>
      <Ionicons name={icon} size={18} color={sColors.muted} />
      <Text style={[s.meta, { width: 96 }]}>{label}</Text>
      <Text style={[s.title, { flex: 1, fontWeight: '600' }]}>{value || '—'}</Text>
    </View>
  );
}

export default function StudentProfileScreen() {
  const { user, enrollments } = useStudentEnrollment();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.displayName);
  const [phone, setPhone] = useState((user as { phone?: string }).phone ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) { setError('Enter your name.'); return; }
    setBusy(true); setError(null);
    try { await updateMyProfile(user.uid, { displayName: name, phone }); setEditing(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save.'); }
    finally { setBusy(false); }
  };

  return (
    <View style={s.screen}>
      <StudentHeader title="My Profile" />
      <ScrollView contentContainerStyle={s.content}>
        <Card>
          <Text style={s.sectionTitle}>{user.displayName}</Text>
          <Chip label={user.active ? 'Active student' : 'Pending approval'} tone={user.active ? 'green' : 'amber'} icon="checkmark-circle" />
          {editing ? (
            <>
              <AppInput label="Full name" icon="person-outline" value={name} onChangeText={setName} />
              <AppInput label="Phone" icon="call-outline" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              {error && <ErrorBanner message={error} />}
              <StudentButton title="Save" onPress={() => void save()} loading={busy} />
              <StudentButton title="Cancel" variant="ghost" onPress={() => setEditing(false)} />
            </>
          ) : (
            <>
              <Row icon="mail-outline" label="Email" value={user.email} />
              <Row icon="call-outline" label="Phone" value={(user as { phone?: string }).phone ?? ''} />
              <StudentButton title="Edit name & phone" icon="create-outline" variant="soft" onPress={() => setEditing(true)} />
            </>
          )}
        </Card>

        <Text style={s.sectionTitle}>My enrolments</Text>
        {enrollments.map((e) => (
          <Card key={e.id}>
            <Text style={s.title}>{e.courseName}</Text>
            <Row icon="people-outline" label="Batch" value={e.batchName} />
            <Row icon="receipt-outline" label="Purchase ID" value={e.purchaseId} />
            {e.couponCode ? <Row icon="pricetag-outline" label="Coupon" value={e.couponCode} /> : null}
            <Row icon="calendar-outline" label="Enrolled" value={e.enrolledAt ? new Date(e.enrolledAt).toLocaleDateString() : ''} />
          </Card>
        ))}
        {!enrollments.length && <Text style={s.meta}>No enrolments yet. Request one from Live Courses.</Text>}
      </ScrollView>
    </View>
  );
}
