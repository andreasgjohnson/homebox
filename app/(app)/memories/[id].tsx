import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AudioPlayback } from '@/components/AudioPlayback';
import {
  createMemoryAudioSignedUrl,
  isUploadedMemoryAudioPath,
  removeMemoryAudio,
} from '@/lib/audioStorage';
import { formatLongDate } from '@/lib/dateFormat';
import { deleteMemory, getMemory, updateMemoryTitle, type Memory } from '@/lib/memories';
import { colors, radii, typography } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

export default function MemoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [memory, setMemory] = useState<Memory | null>(null);
  const [playbackUri, setPlaybackUri] = useState<string | null>(null);
  const [playbackErrorMessage, setPlaybackErrorMessage] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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
      setTitleDraft(data.title || '');
    }

    setIsLoading(false);
  }, [id, session?.user.id]);

  useEffect(() => {
    void loadMemory();
  }, [loadMemory]);

  useEffect(() => {
    let isMounted = true;

    async function loadPlaybackUri() {
      setPlaybackUri(null);
      setPlaybackErrorMessage(null);

      if (!memory?.audio_url) {
        return;
      }

      if (!isUploadedMemoryAudioPath(memory.audio_url)) {
        setPlaybackUri(memory.audio_url);
        return;
      }

      const { data, error } = await createMemoryAudioSignedUrl(memory.audio_url);

      if (!isMounted) {
        return;
      }

      if (error) {
        setPlaybackErrorMessage(error.message);
        return;
      }

      setPlaybackUri(data.signedUrl);
    }

    void loadPlaybackUri();

    return () => {
      isMounted = false;
    };
  }, [memory?.audio_url]);

  async function confirmDeleteMemory() {
    if (!session?.user.id || !memory) {
      return;
    }

    const shouldDelete = await confirmDelete(memory.title || 'Untitled memory');

    if (!shouldDelete) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    if (memory.audio_url && isUploadedMemoryAudioPath(memory.audio_url)) {
      await removeMemoryAudio(memory.audio_url);
    }

    const { error } = await deleteMemory(memory.id, session.user.id);

    if (error) {
      setErrorMessage(error.message);
      setIsDeleting(false);
      return;
    }

    router.replace('/' as Href);
  }

  async function saveTitle() {
    if (!session?.user.id || !memory) {
      return;
    }

    const nextTitle = titleDraft.trim() || 'Untitled memory';

    setIsSavingTitle(true);
    setErrorMessage(null);

    const { data, error } = await updateMemoryTitle(memory.id, session.user.id, nextTitle);

    if (error) {
      setErrorMessage(error.message);
      setIsSavingTitle(false);
      return;
    }

    setMemory(data);
    setTitleDraft(data.title || '');
    setIsSavingTitle(false);
  }

  const canSaveTitle =
    Boolean(memory) &&
    !isSavingTitle &&
    titleDraft.trim() !== (memory?.title || 'Untitled memory').trim();

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.replace('/' as Href)} style={styles.backButton}>
            <Text style={styles.backButtonText}>Back to timeline</Text>
          </Pressable>

          {isLoading ? (
            <View style={styles.feedback}>
              <ActivityIndicator color={colors.charcoal} />
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
              <View style={styles.titlePanel}>
                <Text style={styles.inputLabel}>Edit title</Text>
                <Text style={styles.inputHint}>Rename this memory anytime.</Text>
                <View style={styles.titleEditRow}>
                  <TextInput
                    autoCapitalize="sentences"
                    editable={!isSavingTitle}
                    onChangeText={setTitleDraft}
                    placeholder="Untitled memory"
                    placeholderTextColor={colors.faint}
                    returnKeyType="done"
                    style={styles.titleInput}
                    value={titleDraft}
                  />
                  <Pressable
                    disabled={!canSaveTitle}
                    onPress={() => void saveTitle()}
                    style={({ pressed }) => [
                      styles.saveTitleButton,
                      !canSaveTitle && styles.buttonDisabled,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    {isSavingTitle ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={styles.saveTitleButtonText}>Save</Text>
                    )}
                  </Pressable>
                </View>
              </View>
              <Text style={styles.date}>{formatLongDate(memory.recorded_at)}</Text>

              {memory.audio_url ? (
                <View style={styles.audioPanel}>
                  <AudioPlayback
                    emptyText="Preparing private playback link..."
                    title="Recorded audio"
                    uri={playbackUri}
                  />
                  {playbackErrorMessage ? (
                    <Text style={styles.playbackErrorText}>{playbackErrorMessage}</Text>
                  ) : null}
                </View>
              ) : null}

              <InfoSection title="Summary" value={memory.summary || 'No summary yet.'} />
              <InfoSection title="Transcript" value={memory.transcript || 'No transcript yet.'} />
              <InfoSection
                title="Emotional tone"
                value={memory.emotional_tone || 'Not processed yet.'}
              />
              <InfoSection
                title="Memorable quotes"
                value={
                  memory.memorable_quotes?.length
                    ? memory.memorable_quotes.join('\n\n')
                    : 'No memorable quotes yet.'
                }
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

              <View style={styles.dangerPanel}>
                <Text style={styles.dangerTitle}>Delete memory</Text>
                <Text style={styles.dangerText}>
                  Remove this memory from your archive. This cannot be undone.
                </Text>
                <Pressable
                  disabled={isDeleting}
                  onPress={() => void confirmDeleteMemory()}
                  style={({ pressed }) => [
                    styles.deleteButton,
                    (pressed || isDeleting) && styles.buttonPressed,
                  ]}
                >
                  {isDeleting ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.deleteButtonText}>Delete memory</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
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

function confirmDelete(title: string) {
  if (Platform.OS === 'web') {
    return Promise.resolve(
      globalThis.confirm(`Delete "${title}"?\n\nThis will remove it from your archive.`),
    );
  }

  return new Promise<boolean>((resolve) => {
    Alert.alert('Delete memory?', `Delete "${title}" from your archive?`, [
      { style: 'cancel', text: 'Cancel', onPress: () => resolve(false) },
      { style: 'destructive', text: 'Delete', onPress: () => resolve(true) },
    ]);
  });
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  container: {
    padding: 24,
    paddingBottom: 40,
  },
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.gold,
    borderRadius: radii.control,
    borderWidth: 1,
    marginBottom: 28,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  backButtonText: {
    color: colors.charcoal,
    fontSize: 16,
    fontWeight: '800',
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.goldDark,
    marginBottom: 14,
  },
  date: {
    color: colors.blueDark,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 24,
  },
  inputLabel: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  inputHint: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  titlePanel: {
    backgroundColor: colors.surfaceBlue,
    borderColor: colors.blue,
    borderRadius: radii.card,
    borderWidth: 2,
    boxShadow: '0 8px 18px rgba(32, 39, 43, 0.08)',
    marginBottom: 14,
    padding: 16,
  },
  titleEditRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  titleInput: {
    backgroundColor: colors.surface,
    borderColor: colors.blue,
    borderRadius: radii.control,
    borderWidth: 2,
    color: colors.ink,
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  saveTitleButton: {
    alignItems: 'center',
    backgroundColor: colors.charcoal,
    borderRadius: radii.control,
    justifyContent: 'center',
    minWidth: 78,
    paddingHorizontal: 14,
  },
  saveTitleButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    marginBottom: 14,
    padding: 18,
  },
  audioPanel: {
    marginBottom: 14,
  },
  playbackErrorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  panelTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
  },
  panelText: {
    color: colors.muted,
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
  dangerPanel: {
    backgroundColor: colors.dangerSurface,
    borderColor: colors.dangerBorder,
    borderRadius: radii.card,
    borderWidth: 1,
    marginTop: 10,
    padding: 18,
  },
  dangerTitle: {
    color: colors.danger,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
  },
  dangerText: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  deleteButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.danger,
    borderRadius: radii.control,
    minWidth: 140,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  deleteButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.65,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
});
