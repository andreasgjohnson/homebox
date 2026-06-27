import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  finalizePendingFirstMemory,
  type FirstMemoryProgress,
} from '@/lib/onboardingFirstMemory';
import { colors } from '@/lib/theme';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';

type FirstMemoryState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'preparing'; progress: FirstMemoryProgress }
  | { phase: 'error'; message: string; memoryId?: string };

function RootNavigator() {
  const { configError, isLoading, session } = useAuth();
  const [firstMemoryState, setFirstMemoryState] = useState<FirstMemoryState>({ phase: 'idle' });
  const [checkedFirstMemoryUserId, setCheckedFirstMemoryUserId] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!session?.user.id) {
      setFirstMemoryState({ phase: 'idle' });
      setCheckedFirstMemoryUserId(null);
      return;
    }

    let isCancelled = false;

    async function finalizeFirstMemory() {
      if (!session?.user.id) {
        return;
      }

      setFirstMemoryState({ phase: 'checking' });

      const result = await finalizePendingFirstMemory(session.user.id, {
        onProgress: (progress) => {
          if (!isCancelled) {
            setFirstMemoryState({ phase: 'preparing', progress });
          }
        },
        userEmail: session.user.email,
      });

      if (isCancelled) {
        return;
      }

      if (result.status === 'retryable-error') {
        setCheckedFirstMemoryUserId(session.user.id);
        setFirstMemoryState({
          phase: 'error',
          message: result.message,
          memoryId: result.memoryId,
        });
        return;
      }

      setCheckedFirstMemoryUserId(session.user.id);
      setFirstMemoryState({ phase: 'idle' });
    }

    void finalizeFirstMemory();

    return () => {
      isCancelled = true;
    };
  }, [retryCount, session?.user.email, session?.user.id]);

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

  if (
    session?.user.id &&
    (checkedFirstMemoryUserId !== session.user.id ||
      firstMemoryState.phase === 'checking' ||
      firstMemoryState.phase === 'preparing')
  ) {
    const progress =
      firstMemoryState.phase === 'preparing'
        ? firstMemoryState.progress
        : { label: 'Preparing your archive...', progress: 20 };

    return <PreparingArchive progress={progress} />;
  }

  if (firstMemoryState.phase === 'error') {
    return (
      <PreparingArchive
        errorMessage={firstMemoryState.message}
        onRetry={() => setRetryCount((current) => current + 1)}
        progress={{ label: 'Your first memory needs another try.', progress: 70 }}
      />
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

function PreparingArchive({
  errorMessage,
  onRetry,
  progress,
}: {
  errorMessage?: string;
  onRetry?: () => void;
  progress: FirstMemoryProgress;
}) {
  return (
    <View style={styles.preparing}>
      <Text style={styles.preparingEyebrow}>STOREYBOX</Text>
      <Text style={styles.preparingTitle}>Preparing your archive.</Text>
      <Text style={styles.preparingText}>
        Your hello is becoming the first memory in your private box.
      </Text>
      <View style={styles.progressPanel}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>{progress.label}</Text>
          <Text style={styles.progressPercent}>{progress.progress}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress.progress}%` }]} />
        </View>
      </View>
      {errorMessage ? (
        <View style={styles.preparingNotice}>
          <Text style={styles.preparingNoticeText}>{errorMessage}</Text>
          {onRetry ? (
            <Pressable onPress={onRetry} style={styles.retryButton}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
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
  preparing: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  preparingEyebrow: {
    color: colors.blue,
    fontSize: 12,
    letterSpacing: 3.6,
    marginBottom: 22,
  },
  preparingTitle: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: '300',
    marginBottom: 12,
    textAlign: 'center',
  },
  preparingText: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 380,
    textAlign: 'center',
  },
  progressPanel: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 30,
    maxWidth: 420,
    padding: 18,
    width: '100%',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  progressLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '600',
  },
  progressPercent: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  progressTrack: {
    backgroundColor: '#e4ddcf',
    borderRadius: 999,
    height: 6,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: colors.blue,
    height: '100%',
  },
  preparingNotice: {
    alignItems: 'center',
    marginTop: 18,
    maxWidth: 420,
  },
  preparingNoticeText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.ink,
    borderRadius: 999,
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  retryText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '700',
  },
});
