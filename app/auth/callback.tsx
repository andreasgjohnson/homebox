import { type Href, Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

// Give the token exchange a moment to finish, but never strand the user here:
// after the timeout we fall back to the root, where the guarded stack shows
// either the daybook (session landed) or the auth screen with redirectError.
const REDIRECT_GRACE_MS = 6000;

export default function AuthCallbackScreen() {
  const { isLoading, redirectError, session } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), REDIRECT_GRACE_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!isLoading && (session || redirectError || timedOut)) {
    // "/" is ambiguous here: both (app)/index and (auth)/index resolve to it,
    // and Stack.Protected silently drops navigation to the guarded group.
    // Target the group whose guard is active instead.
    return <Redirect href={(session ? '/(app)' : '/(auth)') as Href} />;
  }

  return (
    <View style={styles.screen}>
      <ActivityIndicator color={colors.ink} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
});
