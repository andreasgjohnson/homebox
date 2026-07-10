import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
} from '@expo-google-fonts/hanken-grotesk';
import {
  Newsreader_300Light,
  Newsreader_300Light_Italic,
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
} from '@expo-google-fonts/newsreader';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { type FontSource, useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/lib/theme';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';

SplashScreen.preventAutoHideAsync();

// On web the families load via the Google Fonts <link> in app/+html.tsx; only
// native needs the bundled files (registered under the exact names lib/theme.ts
// resolves to).
const nativeFonts: Record<string, FontSource> =
  Platform.OS === 'web'
    ? {}
    : {
        Newsreader_300Light,
        Newsreader_300Light_Italic,
        Newsreader_400Regular,
        Newsreader_400Regular_Italic,
        HankenGrotesk_400Regular,
        HankenGrotesk_500Medium,
        HankenGrotesk_600SemiBold,
        SpaceMono_400Regular,
        SpaceMono_700Bold,
      };

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
        <ActivityIndicator color={colors.ink} size="large" />
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
  const [fontsLoaded, fontError] = useFonts(nativeFonts);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

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
