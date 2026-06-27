import { Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/lib/theme';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';

function RootNavigator() {
  const { configError, isLoading, session } = useAuth();

  if (configError) {
    return (
      <View style={styles.configError}>
        <Text style={styles.configTitle}>Configuration needed</Text>
        <Text style={styles.configText}>{configError}</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.charcoal} size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={Boolean(session)}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  configError: {
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  configTitle: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 10,
  },
  configText: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
});
