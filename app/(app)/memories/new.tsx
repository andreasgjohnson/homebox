import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { createPlaceholderMemory } from '@/lib/memories';
import { useAuth } from '@/providers/AuthProvider';

export default function NewMemoryScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function createMemory() {
    if (!session?.user.id) {
      return;
    }

    setIsCreating(true);
    setErrorMessage(null);

    const { data, error } = await createPlaceholderMemory(session.user.id);

    if (error) {
      setErrorMessage(error.message);
      setIsCreating(false);
      return;
    }

    router.replace(`/memories/${data.id}` as Href);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>

        <Text style={styles.eyebrow}>CREATE MEMORY</Text>
        <Text style={styles.title}>Save a placeholder memory.</Text>
        <Text style={styles.body}>
          Phase 2 creates a database record now. Recording, upload, transcription, and AI
          processing arrive in later phases.
        </Text>

        <View style={styles.preview}>
          <Text style={styles.previewTitle}>Untitled memory</Text>
          <Text style={styles.previewText}>A saved placeholder for a future recorded memory.</Text>
        </View>

        {errorMessage ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{errorMessage}</Text>
          </View>
        ) : null}

        <Pressable
          disabled={isCreating}
          onPress={() => void createMemory()}
          style={({ pressed }) => [
            styles.primaryButton,
            (pressed || isCreating) && styles.buttonPressed,
          ]}
        >
          {isCreating ? (
            <ActivityIndicator color="#FFF9F0" />
          ) : (
            <Text style={styles.primaryButtonText}>Save placeholder</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#F5EFE5',
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
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
    marginBottom: 14,
  },
  body: {
    color: '#6E6257',
    fontSize: 16,
    lineHeight: 24,
  },
  preview: {
    backgroundColor: '#FFFDF9',
    borderColor: '#E4D8C8',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 28,
    padding: 18,
  },
  previewTitle: {
    color: '#332B24',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  previewText: {
    color: '#6E6257',
    fontSize: 15,
    lineHeight: 22,
  },
  notice: {
    backgroundColor: '#FFF1ED',
    borderColor: '#E4B8A8',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 18,
    padding: 16,
  },
  noticeText: {
    color: '#8A473A',
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#6D4C36',
    borderRadius: 14,
    marginTop: 18,
    paddingVertical: 16,
  },
  primaryButtonText: {
    color: '#FFF9F0',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.65,
  },
});
