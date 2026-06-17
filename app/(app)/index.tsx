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
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export default function HomeScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [memories, setMemories] = useState<MemoryListItem[]>([]);
  const [isLoadingMemories, setIsLoadingMemories] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadMemories = useCallback(async () => {
    if (!session?.user.id) {
      return;
    }

    setIsLoadingMemories(true);
    setErrorMessage(null);

    const { data, error } = await listMemories(session.user.id);

    if (error) {
      setErrorMessage(error.message);
    } else {
      setMemories(data ?? []);
    }

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
                Phase 2 stores placeholder memories now. Audio recording arrives in Phase 3.
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
                <Text style={styles.body}>Signed in as {session?.user.email}.</Text>
              </View>
              <Pressable
                disabled={isSigningOut}
                onPress={() => void signOut()}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
              >
                {isSigningOut ? (
                  <ActivityIndicator color="#6D4C36" />
                ) : (
                  <Text style={styles.secondaryButtonText}>Sign out</Text>
                )}
              </Pressable>
            </View>

            <Pressable
              onPress={() => router.push('/memories/new' as Href)}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.primaryButtonText}>Create memory placeholder</Text>
            </Pressable>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Saved memories</Text>
              <Text style={styles.sectionCount}>{memories.length}</Text>
            </View>

            {isLoadingMemories ? (
              <View style={styles.feedback}>
                <ActivityIndicator color="#6D4C36" />
                <Text style={styles.feedbackText}>Loading your archive...</Text>
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
    backgroundColor: '#F5EFE5',
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
  eyebrow: {
    color: '#946A47',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
    marginBottom: 12,
  },
  title: {
    color: '#332B24',
    fontFamily: 'Georgia',
    fontSize: 36,
    lineHeight: 43,
    marginBottom: 10,
  },
  body: {
    color: '#6E6257',
    fontSize: 16,
    lineHeight: 23,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#6D4C36',
    borderRadius: 14,
    marginBottom: 26,
    paddingVertical: 16,
  },
  primaryButtonText: {
    color: '#FFF9F0',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#BCA893',
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 88,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: '#6D4C36',
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
    color: '#332B24',
    fontSize: 19,
    fontWeight: '700',
  },
  sectionCount: {
    color: '#8B7764',
    fontSize: 14,
    fontWeight: '700',
  },
  feedback: {
    alignItems: 'center',
    backgroundColor: '#FFFDF9',
    borderColor: '#E4D8C8',
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
  },
  feedbackText: {
    color: '#6E6257',
    fontSize: 15,
    marginTop: 12,
  },
  notice: {
    backgroundColor: '#FFF1ED',
    borderColor: '#E4B8A8',
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  noticeText: {
    color: '#8A473A',
    fontSize: 14,
    lineHeight: 20,
  },
  emptyState: {
    backgroundColor: '#FFFDF9',
    borderColor: '#E4D8C8',
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  emptyTitle: {
    color: '#332B24',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    color: '#6E6257',
    fontSize: 15,
    lineHeight: 22,
  },
  memoryCard: {
    backgroundColor: '#FFFDF9',
    borderColor: '#E4D8C8',
    borderRadius: 16,
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
    color: '#332B24',
    fontSize: 18,
    fontWeight: '700',
  },
  memoryDate: {
    color: '#8B7764',
    fontSize: 13,
    fontWeight: '600',
  },
  memorySummary: {
    color: '#6E6257',
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
    backgroundColor: '#F3E7D8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagText: {
    color: '#74543D',
    fontSize: 12,
    fontWeight: '700',
  },
  memorySeparator: {
    height: 12,
  },
});
