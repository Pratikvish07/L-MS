import { Redirect, Stack } from 'expo-router';

import { LoadingView } from '@/components/common/LoadingView';
import { useAuth } from '@/hooks/useAuth';

export default function AuthLayout() {
  const { status } = useAuth();

  if (status === 'loading') return <LoadingView />;
  // Once signed in (or rejected), the index route decides where to go.
  if (status !== 'signedOut') return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
