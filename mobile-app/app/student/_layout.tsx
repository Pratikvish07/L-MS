import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { LoadingView } from '@/components/common/LoadingView';
import { sColors } from '@/constants/studentTheme';
import { useAuth } from '@/hooks/useAuth';

type IconName = ComponentProps<typeof Ionicons>['name'];
function icon(name: IconName, active: IconName) {
  function TabIcon({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) {
    return <Ionicons name={focused ? active : name} color={color as string} size={size} />;
  }
  return TabIcon;
}

/** Student area: bottom tabs Home · Courses · Tests · Marks · Profile. */
export default function StudentLayout() {
  const { status, user } = useAuth();
  if (status === 'loading') return <LoadingView />;
  if (status !== 'signedIn' || user?.role !== 'student') return <Redirect href="/" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: sColors.primary,
        tabBarInactiveTintColor: '#9A96AE',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarStyle: { height: 64, paddingTop: 6, paddingBottom: 8, borderTopColor: sColors.border, backgroundColor: sColors.surface },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="my-course" options={{ title: 'Courses', tabBarIcon: icon('book-outline', 'book') }} />
      <Tabs.Screen name="assessments" options={{ title: 'Tests', tabBarIcon: icon('reader-outline', 'reader') }} />
      <Tabs.Screen name="marks" options={{ title: 'Marks', tabBarIcon: icon('bar-chart-outline', 'bar-chart') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-outline', 'person') }} />
      <Tabs.Screen name="courses" options={{ href: null }} />
      <Tabs.Screen name="assessment/[id]" options={{ href: null }} />
    </Tabs>
  );
}
