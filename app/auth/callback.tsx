import { type Href, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      router.replace('/' as Href);
    }
  }, [isLoading, router]);

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
