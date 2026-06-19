import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  type ListRenderItem,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { formatShortDate } from '@/lib/dateFormat';
import { listMemories, type MemoryListItem } from '@/lib/memories';
import { getProfile, getProfileDisplayName } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';
import { colors, radii, typography } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

export default function HomeScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [memories, setMemories] = useState<MemoryListItem[]>([]);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [isLoadingMemories, setIsLoadingMemories] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadMemories = useCallback(async () => {
    if (!session?.user.id) {
      return;
    }

    setIsLoadingMemories(true);
    setErrorMessage(null);

    const [{ data, error }, { data: profile }] = await Promise.all([
      listMemories(session.user.id),
      getProfile(session.user.id),
    ]);

    if (error) {
      setErrorMessage(error.message);
    } else {
      setMemories(data ?? []);
    }

    setProfileName(getProfileDisplayName(profile ?? null));
    setIsLoadingMemories(false);
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      void loadMemories();
    }, [loadMemories]),
  );

  async function signOut() {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    setIsSigningOut(false);
  }

  const renderMemory = useCallback<ListRenderItem<MemoryListItem>>(
    ({ item }) => (
      <Pressable
        onPress={() => router.push(`/memories/${item.id}` as Href)}
        style={({ pressed }) => [styles.memoryCard, pressed && styles.cardPressed]}
      >
        <View style={styles.memoryCardHeader}>
          <Text style={styles.memoryTitle}>{item.title || 'Untitled memory'}</Text>
          <Text style={styles.memoryDate}>{formatShortDate(item.recorded_at)}</Text>
        </View>
        <Text style={styles.memorySummary} numberOfLines={2}>
          {item.summary || 'No summary yet.'}
        </Text>
        <View style={styles.tagRow}>
          {(item.tags?.length ? item.tags : ['draft']).slice(0, 3).map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      </Pressable>
    ),
    [router],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.container}
        data={memories}
        ItemSeparatorComponent={MemorySeparator}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          !isLoadingMemories && !errorMessage ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No memories yet</Text>
              <Text style={styles.emptyText}>
                Begin with one story, reflection, or small moment worth keeping.
              </Text>
            </View>
          ) : null
        }
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>YOUR PRIVATE ARCHIVE</Text>
                <Text style={styles.title}>Memory timeline</Text>
                <Text style={styles.body}>
                  Signed in as {profileName || session?.user.email}
                </Text>
              </View>
              <View style={styles.headerActions}>
                <Pressable
                  onPress={() => router.push('/profile' as Href)}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
                >
                  <Text style={styles.secondaryButtonText}>Settings</Text>
                </Pressable>
                <Pressable
                  disabled={isSigningOut}
                  onPress={() => void signOut()}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
                >
                {isSigningOut ? (
                  <ActivityIndicator color={colors.charcoal} />
                  ) : (
                    <Text style={styles.secondaryButtonText}>Sign out</Text>
                  )}
                </Pressable>
              </View>
            </View>

            <Pressable
              onPress={() => router.push('/memories/new' as Href)}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.primaryButtonText}>Record a memory</Text>
            </Pressable>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Saved memories</Text>
              <Text style={styles.sectionCount}>{memories.length}</Text>
            </View>

            {isLoadingMemories ? (
              <View style={styles.feedback}>
                <ActivityIndicator color={colors.charcoal} />
                <Text style={styles.feedbackText}>Opening your archive...</Text>
              </View>
            ) : null}

            {errorMessage ? (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>{errorMessage}</Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={renderMemory}
      />
    </SafeAreaView>
  );
}

function MemorySeparator() {
  return <View style={styles.memorySeparator} />;
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  container: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerCopy: {
    flex: 1,
  },
  headerActions: {
    gap: 10,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.goldDark,
    marginBottom: 12,
  },
  title: {
    ...typography.screenTitle,
    color: colors.ink,
    marginBottom: 10,
  },
  body: {
    ...typography.body,
    color: colors.muted,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.charcoal,
    borderRadius: radii.control,
    marginBottom: 26,
    paddingVertical: 16,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radii.control,
    borderWidth: 1,
    minWidth: 88,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: colors.charcoal,
    fontSize: 14,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.65,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.ink,
  },
  sectionCount: {
    color: colors.blueDark,
    fontSize: 14,
    fontWeight: '700',
  },
  feedback: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    padding: 24,
  },
  feedbackText: {
    color: colors.muted,
    fontSize: 15,
    marginTop: 12,
  },
  notice: {
    backgroundColor: colors.dangerSurface,
    borderColor: colors.dangerBorder,
    borderRadius: radii.card,
    borderWidth: 1,
    padding: 16,
  },
  noticeText: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    padding: 22,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  memoryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    padding: 16,
  },
  cardPressed: {
    opacity: 0.72,
  },
  memoryCardHeader: {
    gap: 10,
    marginBottom: 8,
  },
  memoryTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  memoryDate: {
    color: colors.blueDark,
    fontSize: 13,
    fontWeight: '600',
  },
  memorySummary: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  tag: {
    alignItems: 'center',
    backgroundColor: colors.surfaceBlue,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagText: {
    color: colors.blueDark,
    fontSize: 12,
    fontWeight: '700',
  },
  memorySeparator: {
    height: 12,
  },
});
