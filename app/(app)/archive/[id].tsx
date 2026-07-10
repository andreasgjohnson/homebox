import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StoreyboxWordmark } from '@/components/DaybookChrome';
import { Icon } from '@/components/Icon';
import { createStoreyAudioSignedUrl, isUploadedStoreyAudioPath } from '@/lib/storeyAudio';
import {
  deleteStorey,
  getStorey,
  getStoreyProvenance,
  updateStoreyTitle,
  type Storey,
} from '@/lib/storeys';
import { colors, fonts, getTextureColor } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

export default function StoreyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const isPhone = width < 700;
  const [storey, setStorey] = useState<Storey | null>(null);
  const [playbackUri, setPlaybackUri] = useState<string | null>(null);
  const [playbackErrorMessage, setPlaybackErrorMessage] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const player = useAudioPlayer(playbackUri ?? null, { updateInterval: 500 });
  const playerStatus = useAudioPlayerStatus(player);

  const loadStorey = useCallback(async () => {
    if (!session?.user.id || !id) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const { data, error } = await getStorey(id, session.user.id);

    if (error) {
      setErrorMessage(error.message);
    } else {
      setStorey(data);
      setTitleDraft(data.title || '');
    }

    setIsLoading(false);
  }, [id, session?.user.id]);

  useEffect(() => {
    void loadStorey();
  }, [loadStorey]);

  useEffect(() => {
    let isMounted = true;

    async function loadPlaybackUri() {
      setPlaybackUri(null);
      setPlaybackErrorMessage(null);

      if (!storey?.audio_url) {
        return;
      }

      if (!isUploadedStoreyAudioPath(storey.audio_url)) {
        setPlaybackUri(storey.audio_url);
        return;
      }

      const { data, error } = await createStoreyAudioSignedUrl(storey.audio_url);

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
  }, [storey?.audio_url]);

  const memorableQuotes = useMemo(() => getMemorableQuotes(storey), [storey]);
  const provenance = useMemo(() => (storey ? getStoreyProvenance(storey) : null), [storey]);
  const wordCount = useMemo(() => getWordCount(storey?.transcript), [storey?.transcript]);
  const summary = personalizeSummary(storey?.summary);
  const durationSeconds = playerStatus.duration > 0 ? playerStatus.duration : null;
  const progress =
    durationSeconds && playerStatus.currentTime > 0
      ? Math.min(playerStatus.currentTime / durationSeconds, 1)
      : 0;
  const canPlay = Boolean(playbackUri);

  async function togglePlayback() {
    if (!canPlay) {
      return;
    }

    if (playerStatus.playing) {
      player.pause();
      return;
    }

    player.play();
  }

  async function confirmDeleteStorey() {
    if (!session?.user.id || !storey) {
      return;
    }

    const shouldDelete = await confirmDelete(storey.title || 'Untitled Storey');

    if (!shouldDelete) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    const { error } = await deleteStorey(storey.id);

    if (error) {
      setErrorMessage(error.message);
      setIsDeleting(false);
      return;
    }

    router.replace('/archive' as Href);
  }

  async function saveTitle() {
    if (!session?.user.id || !storey) {
      return;
    }

    const nextTitle = titleDraft.trim() || 'Untitled Storey';

    setIsSavingTitle(true);
    setErrorMessage(null);

    const { data, error } = await updateStoreyTitle(storey.id, session.user.id, nextTitle);

    if (error) {
      setErrorMessage(error.message);
      setIsSavingTitle(false);
      return;
    }

    setStorey(data);
    setTitleDraft(data.title || '');
    setIsEditingTitle(false);
    setIsSavingTitle(false);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.topBar, isPhone && styles.topBarPhone]}>
        <Pressable
          accessibilityLabel="Back to Archive"
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => router.replace('/archive' as Href)}
          style={styles.backLink}
        >
          <Icon color={colors.muted} fallbackGlyph="‹" name="chevron.left" size={15} />
          <Text style={styles.backText}>Archive</Text>
        </Pressable>
        <StoreyboxWordmark />
        <View style={styles.privateWrap}>
          <Text style={styles.privateLabel}>PRIVATE</Text>
          <Pressable
            accessibilityLabel="Delete this Storey"
            accessibilityRole="button"
            accessibilityState={{ disabled: isDeleting }}
            disabled={isDeleting}
            hitSlop={12}
            onPress={() => void confirmDeleteStorey()}
          >
            {isDeleting ? (
              <ActivityIndicator color={colors.muted} />
            ) : (
              <Icon color={colors.muted} fallbackGlyph="⋮" name="trash" size={17} />
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.container, isPhone && styles.containerPhone]}
        keyboardShouldPersistTaps="handled"
      >
        {isLoading ? (
          <View style={styles.feedback}>
            <ActivityIndicator color={colors.ink} />
              <Text style={styles.feedbackText}>Opening Storey...</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{errorMessage}</Text>
          </View>
        ) : null}

        {!isLoading && storey ? (
          <>
            <View style={styles.header}>
              <Text style={styles.provenanceLabel}>{provenance?.badge}</Text>
              <Text style={styles.dateLine}>
                {formatDetailDate(storey.recorded_at)}
                {durationSeconds ? ` · ${formatAudioTime(durationSeconds)}` : ''}
              </Text>
              {provenance?.capturedBy ? (
                <Text style={styles.capturedBy}>{provenance.capturedBy}</Text>
              ) : null}
              {isEditingTitle ? (
                <View style={styles.titleEditor}>
                  <TextInput
                    accessibilityLabel="Storey title"
                    autoCapitalize="sentences"
                    editable={!isSavingTitle}
                    onChangeText={setTitleDraft}
                    placeholder="Untitled Storey"
                    placeholderTextColor={colors.muted}
                    returnKeyType="done"
                    style={styles.titleInput}
                    value={titleDraft}
                  />
                  <Pressable
                    accessibilityLabel="Save title"
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isSavingTitle }}
                    disabled={isSavingTitle}
                    onPress={() => void saveTitle()}
                    style={styles.saveTitleButton}
                  >
                    {isSavingTitle ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={styles.saveTitleText}>Save</Text>
                    )}
                  </Pressable>
                </View>
              ) : (
                <Text style={styles.title}>{storey.title || 'Untitled Storey'}</Text>
              )}
            </View>

            <View style={[styles.audioCard, isPhone && styles.audioCardPhone]}>
              <Pressable
                accessibilityLabel={playerStatus.playing ? 'Pause' : 'Play'}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canPlay }}
                disabled={!canPlay}
                hitSlop={6}
                onPress={() => void togglePlayback()}
                style={[styles.playButton, !canPlay && styles.disabled]}
              >
                <Icon
                  color="#CDD9E5"
                  fallbackGlyph={playerStatus.playing ? 'Ⅱ' : '▶'}
                  name={playerStatus.playing ? 'pause.fill' : 'play.fill'}
                  size={17}
                />
              </Pressable>
              <View style={styles.progressWrap}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { flex: progress }]} />
                  <View style={{ flex: 1 - progress }} />
                </View>
                <Text style={styles.progressTime}>
                  {formatAudioTime(playerStatus.currentTime)}
                  {durationSeconds ? ` / ${formatAudioTime(durationSeconds)}` : ''}
                </Text>
              </View>
            </View>

            {playbackErrorMessage ? (
              <Text style={styles.playbackErrorText}>{playbackErrorMessage}</Text>
            ) : null}

            <Text style={styles.sectionLabel}>WHAT THIS HELD</Text>
            <Text style={styles.summary}>{summary || 'No summary yet.'}</Text>

            {memorableQuotes.length ? (
              <>
                <Text style={styles.sectionLabel}>MOMENTS WORTH KEEPING</Text>
                <View style={styles.markedList}>
                  {memorableQuotes.map((quote) => (
                    <View key={quote} style={styles.markedRow}>
                      <View style={styles.quoteDot} />
                      <Text style={styles.quote}>“{quote}”</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            <Pressable
              accessibilityLabel="Full transcript"
              accessibilityRole="button"
              accessibilityState={{ expanded: isTranscriptOpen }}
              onPress={() => setIsTranscriptOpen((current) => !current)}
              style={styles.transcriptToggle}
            >
              <View>
                <Text style={styles.transcriptLabel}>FULL TRANSCRIPT</Text>
                <Text style={styles.transcriptMeta}>What you said — {wordCount} words</Text>
              </View>
              <Icon
                color={colors.muted}
                fallbackGlyph={isTranscriptOpen ? '⌃' : '⌄'}
                name={isTranscriptOpen ? 'chevron.up' : 'chevron.down'}
                size={16}
              />
            </Pressable>

            {isTranscriptOpen ? (
              <Text style={styles.transcript}>{storey.transcript || 'No transcript yet.'}</Text>
            ) : null}

            {storey.tags?.length || storey.emotional_tone ? (
              <>
                <Text style={styles.sectionLabel}>THEMES</Text>
                <View style={styles.chipRow}>
                  {(storey.tags ?? []).map((tag) => (
                    <View key={tag} style={styles.chip}>
                      <Text style={styles.chipText}>{tag}</Text>
                    </View>
                  ))}
                  {storey.emotional_tone ? (
                    <View style={styles.textureChip}>
                      <View
                        style={[
                          styles.textureDot,
                          { backgroundColor: getTextureColor(storey.emotional_tone) },
                        ]}
                      />
                      <Text style={styles.chipText}>{storey.emotional_tone}</Text>
                    </View>
                  ) : null}
                </View>
              </>
            ) : null}

            <View style={styles.actionRow}>
              <Pressable
                accessibilityLabel="Edit title"
                accessibilityRole="button"
                onPress={() => setIsEditingTitle(true)}
                style={styles.actionPill}
              >
                <Text style={styles.actionText}>Edit title</Text>
              </Pressable>
            </View>
            <Text style={styles.footer}>Sharing off · your story stays yours.</Text>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function getMemorableQuotes(storey: Storey | null): string[] {
  const quotes = storey?.memorable_quotes?.length
    ? storey.memorable_quotes
    : splitSummary(storey?.summary).slice(0, 4);

  return quotes.slice(0, 4).map((quote) => quote.replace(/^["“]|["”]$/g, ''));
}

function splitSummary(summary: string | null | undefined) {
  if (!summary) {
    return [];
  }

  return summary
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function personalizeSummary(summary: string | null | undefined) {
  return summary
    ?.replace(/\bthe speaker's\b/gi, 'your')
    .replace(/\bthe speaker\b/gi, 'you')
    .replace(/\bspeaker's\b/gi, 'your')
    .replace(/\bspeaker\b/gi, 'you');
}

function getWordCount(transcript: string | null | undefined) {
  return transcript?.trim().split(/\s+/).filter(Boolean).length ?? 0;
}

function formatDetailDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
    .format(new Date(value))
    .toUpperCase();
}

function formatAudioTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00';
  }

  const roundedSeconds = Math.floor(seconds);
  const minutes = Math.floor(roundedSeconds / 60);
  const remainingSeconds = roundedSeconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function confirmDelete(title: string) {
  if (Platform.OS === 'web') {
    return Promise.resolve(
      globalThis.confirm(`Delete "${title}"?\n\nThis will remove it from your archive.`),
    );
  }

  return new Promise<boolean>((resolve) => {
    Alert.alert('Delete Storey?', `Delete "${title}" from your archive?`, [
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
  topBar: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingVertical: 18,
  },
  topBarPhone: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  backLink: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
    minWidth: 110,
  },
  backText: {
    color: colors.muted,
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    fontWeight: '500',
  },
  wordmark: {
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 3.12,
  },
  privateWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'flex-end',
    minWidth: 110,
  },
  privateLabel: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 1.32,
  },
  container: {
    alignSelf: 'center',
    maxWidth: 680,
    paddingBottom: 40,
    paddingHorizontal: 36,
    width: '100%',
  },
  containerPhone: {
    maxWidth: undefined,
    paddingBottom: 42,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 32,
  },
  provenanceLabel: {
    color: colors.blueDark,
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 2.2,
    lineHeight: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  dateLine: {
    color: colors.blueDark,
    fontFamily: fonts.monoBold,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    lineHeight: 16,
    marginBottom: 6,
    textAlign: 'center',
  },
  capturedBy: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    marginBottom: 18,
    textAlign: 'center',
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.serifLight,
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 37.12,
    textAlign: 'center',
  },
  titleEditor: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  titleInput: {
    borderBottomColor: colors.borderStrong,
    borderBottomWidth: 1,
    color: colors.ink,
    flex: 1,
    fontFamily: fonts.serifLight,
    fontSize: 26,
    fontWeight: '300',
    paddingVertical: 8,
    textAlign: 'center',
  },
  saveTitleButton: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 72,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  saveTitleText: {
    color: colors.white,
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    fontWeight: '600',
  },
  audioCard: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: '#E7E0D2',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 16,
    marginTop: 24,
    paddingHorizontal: 22,
    paddingVertical: 20,
  },
  audioCardPhone: {
    gap: 13,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  playButton: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 23,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  progressWrap: {
    flex: 1,
    gap: 8,
  },
  progressTrack: {
    backgroundColor: '#E3ECF4',
    borderRadius: 2,
    flexDirection: 'row',
    height: 4,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: colors.blueDark,
    borderRadius: 2,
  },
  progressTime: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 15,
  },
  playbackErrorText: {
    color: colors.danger,
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  sectionLabel: {
    color: colors.blueDark,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 1.98,
    lineHeight: 15,
    marginBottom: 12,
    marginTop: 26,
  },
  summary: {
    color: '#33302A',
    fontFamily: fonts.serif,
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 28.8,
    margin: 0,
  },
  markedList: {
    gap: 10,
  },
  markedRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 13,
  },
  quoteDot: {
    backgroundColor: colors.gold,
    borderRadius: 3,
    height: 6,
    marginTop: 9,
    width: 6,
  },
  quote: {
    color: colors.muted,
    flex: 1,
    fontFamily: fonts.serifItalic,
    fontSize: 17,
    fontStyle: 'italic',
    fontWeight: '400',
    lineHeight: 23.8,
  },
  transcriptToggle: {
    alignItems: 'center',
    borderColor: colors.borderStrong,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 28,
    paddingHorizontal: 22,
    paddingVertical: 18,
  },
  transcriptLabel: {
    color: colors.blueDark,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 1.76,
    marginBottom: 5,
  },
  transcriptMeta: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '400',
  },
  transcript: {
    color: '#33302A',
    fontFamily: fonts.serif,
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 30,
    marginTop: 18,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderColor: '#D8E2EA',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  textureChip: {
    alignItems: 'center',
    borderColor: '#D8E2EA',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  textureDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  chipText: {
    color: colors.blueDark,
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginTop: 32,
  },
  actionPill: {
    alignItems: 'center',
    borderColor: '#D3CCBE',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  actionText: {
    color: '#4A525D',
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    fontWeight: '500',
  },
  footer: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '400',
    marginTop: 18,
    textAlign: 'center',
  },
  feedback: {
    alignItems: 'center',
    marginTop: 32,
  },
  feedbackText: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 15,
    marginTop: 12,
  },
  notice: {
    backgroundColor: colors.dangerSurface,
    borderColor: colors.dangerBorder,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 24,
    padding: 16,
  },
  noticeText: {
    color: colors.danger,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  disabled: {
    opacity: 0.55,
  },
});
