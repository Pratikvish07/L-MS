import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { LoadingView } from '@/components/common/LoadingView';
import { colors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { MountProvider } from '@/context/MountContext';

type IconName = ComponentProps<typeof Ionicons>['name'];

const tabIcon =
  (name: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color as string} size={size} />;

export default function FacultyLayout() {
  const { status, user } = useAuth();

  if (status === 'loading') return <LoadingView />;
  if (status !== 'signedIn' || user?.role !== 'faculty') return <Redirect href="/" />;

  return (
    <MountProvider>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Home', tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="recordings" options={{ title: 'Recordings', tabBarIcon: tabIcon('film-outline') }} />
      <Tabs.Screen name="subjects" options={{ title: 'Subjects', tabBarIcon: tabIcon('library-outline') }} />
      <Tabs.Screen name="devices" options={{ title: 'Devices', tabBarIcon: tabIcon('phone-portrait-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('person-outline') }} />
      <Tabs.Screen name="new-recording" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="recording-details/[id]" options={{ href: null }} />
      <Tabs.Screen name="subject/[id]" options={{ href: null }} />
      <Tabs.Screen name="faculty-camera" options={{ href: null }} />
      <Tabs.Screen name="faculty-upload" options={{ href: null }} />
    </Tabs>
    </MountProvider>
  );
}
