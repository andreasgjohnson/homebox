import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatLongDate } from '@/lib/dateFormat';
import { getMemory, type Memory } from '@/lib/memories';
import { useAuth } from '@/providers/AuthProvider';

export default function MemoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [memory, setMemory] = useState<Memory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadMemory = useCallback(async () => {
    if (!session?.user.id || !id) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const { data, error } = await getMemory(id, session.user.id);

    if (error) {
      setErrorMessage(error.message);
    } else {
      setMemory(data);
    }

    setIsLoading(false);
  }, [id, session?.user.id]);

  useEffect(() => {
    void loadMemory();
  }, [loadMemory]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back to timeline</Text>
        </Pressable>

        {isLoading ? (
          <View style={styles.feedback}>
            <ActivityIndicator color="#6D4C36" />
            <Text style={styles.feedbackText}>Opening memory...</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{errorMessage}</Text>
          </View>
        ) : null}

        {!isLoading && memory ? (
          <View>
            <Text style={styles.eyebrow}>MEMORY DETAIL</Text>
            <Text style={styles.title}>{memory.title || 'Untitled memory'}</Text>
            <Text style={styles.date}>{formatLongDate(memory.recorded_at)}</Text>

            <InfoSection title="Summary" value={memory.summary || 'No summary yet.'} />
            <InfoSection title="Transcript" value={memory.transcript || 'Transcript arrives in Phase 5.'} />
            <InfoSection
              title="Emotional tone"
              value={memory.emotional_tone || 'Not processed yet.'}
            />

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Tags</Text>
              <View style={styles.tagRow}>
                {(memory.tags?.length ? memory.tags : ['draft']).map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoSection({ title, value }: { title: string; value: string }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{title}</Text>
      <Text style={styles.panelText}>{value}</Text>
    </View>
  );
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
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 28,
  },
  backButtonText: {
    color: '#74543D',
    fontSize: 15,
    fontWeight: '700',
  },
  eyebrow: {
    color: '#946A47',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
    marginBottom: 14,
  },
  title: {
    color: '#332B24',
    fontFamily: 'Georgia',
    fontSize: 36,
    lineHeight: 43,
    marginBottom: 10,
  },
  date: {
    color: '#8B7764',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 24,
  },
  panel: {
    backgroundColor: '#FFFDF9',
    borderColor: '#E4D8C8',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
    padding: 18,
  },
  panelTitle: {
    color: '#332B24',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
  },
  panelText: {
    color: '#6E6257',
    fontSize: 15,
    lineHeight: 22,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
});
