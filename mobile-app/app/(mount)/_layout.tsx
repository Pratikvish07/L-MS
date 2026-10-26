import { Redirect, Stack } from 'expo-router';

import { LoadingView } from '@/components/common/LoadingView';
import { colors } from '@/constants/theme';
import { MountProvider } from '@/context/MountContext';
import { useAuth } from '@/hooks/useAuth';

export default function MountLayout() {
  const { status, user } = useAuth();

  if (status === 'loading') return <LoadingView dark />;
  if (status !== 'signedIn' || user?.role !== 'mount') return <Redirect href="/" />;

  return (
    <MountProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.dark } }} />
    </MountProvider>
  );
}
