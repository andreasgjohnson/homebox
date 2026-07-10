import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { StoreyboxWordmark } from '@/components/DaybookChrome';
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

const waveBars = [
  9, 20, 16, 28, 18, 23, 37, 17, 31, 24, 18, 27, 39, 22, 28, 19, 35, 16, 24, 30, 18, 40, 48, 22,
  30, 33, 41, 27, 45, 38, 25, 43, 31, 37, 46, 29, 42, 35, 24, 39, 28, 34, 44, 21, 36, 26, 31, 38,
  28, 22, 35, 27, 32, 41, 25, 30, 23, 34, 28, 20, 31, 24, 29, 18,
];
const pinIndexes = new Set([6, 22, 42, 56]);

type MarkedMoment = {
  quote: string;
  seconds: number;
  t: string;
};

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

  const markedMoments = useMemo(() => getMarkedMoments(storey), [storey]);
  const provenance = useMemo(() => (storey ? getStoreyProvenance(storey) : null), [storey]);
  const wordCount = useMemo(() => getWordCount(storey?.transcript), [storey?.transcript]);
  const summary = personalizeSummary(storey?.summary);
  const duration = playerStatus.duration || 100;
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

  async function playFrom(seconds: number) {
    if (!canPlay) {
      return;
    }

    await player.seekTo(seconds);
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
        <Pressable onPress={() => router.replace('/archive' as Href)} style={styles.backLink}>
          <Text style={styles.backChevron}>‹</Text>
          <Text style={styles.backText}>Archive</Text>
        </Pressable>
        <StoreyboxWordmark />
        <View style={styles.privateWrap}>
          <Text style={styles.privateLabel}>PRIVATE</Text>
          <Pressable disabled={isDeleting} onPress={() => void confirmDeleteStorey()}>
            {isDeleting ? (
              <ActivityIndicator color={colors.faint} />
            ) : (
              <Text style={styles.overflow}>⋮</Text>
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
                {formatDetailDate(storey.recorded_at)} · {formatAudioTime(duration)}
              </Text>
              {provenance?.capturedBy ? (
                <Text style={styles.capturedBy}>{provenance.capturedBy}</Text>
              ) : null}
              {isEditingTitle ? (
                <View style={styles.titleEditor}>
                  <TextInput
                    autoCapitalize="sentences"
                    editable={!isSavingTitle}
                    onChangeText={setTitleDraft}
                    placeholder="Untitled Storey"
                    placeholderTextColor={colors.faint}
                    returnKeyType="done"
                    style={styles.titleInput}
                    value={titleDraft}
                  />
                  <Pressable
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
                disabled={!canPlay}
                onPress={() => void togglePlayback()}
                style={[styles.playButton, !canPlay && styles.disabled]}
              >
                <Text style={styles.playIcon}>{playerStatus.playing ? 'Ⅱ' : '▶'}</Text>
              </Pressable>
              <View style={[styles.waveform, isPhone && styles.waveformPhone]}>
                {waveBars.map((height, index) => {
                  const isPin = pinIndexes.has(index);
                  const pin = markedMoments[index % Math.max(markedMoments.length, 1)];

                  return (
                    <Pressable
                      disabled={!isPin || !pin}
                      key={`${height}-${index}`}
                      onPress={() => pin && void playFrom(pin.seconds)}
                      style={[
                        styles.waveBar,
                        {
                          backgroundColor: isPin ? '#C0883F' : '#A8BCCD',
                          height: isPin ? Math.max(height, 34) : height,
                        },
                      ]}
                    />
                  );
                })}
              </View>
            </View>

            {playbackErrorMessage ? (
              <Text style={styles.playbackErrorText}>{playbackErrorMessage}</Text>
            ) : null}

            <Text style={styles.sectionLabel}>WHAT THIS HELD</Text>
            <Text style={styles.summary}>{summary || 'No summary yet.'}</Text>

            <Text style={styles.sectionLabel}>
              MOMENTS WORTH KEEPING <Text style={styles.sectionHint}>· tap to play</Text>
            </Text>
            <View style={styles.markedList}>
              {markedMoments.map((moment) => (
                <Pressable
                  key={`${moment.t}-${moment.quote}`}
                  onPress={() => void playFrom(moment.seconds)}
                  style={styles.markedRow}
                >
                  <View style={styles.timePill}>
                    <View style={styles.timeDot} />
                    <Text style={styles.timeText}>{moment.t}</Text>
                  </View>
                  <Text style={styles.quote}>“{moment.quote}”</Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => setIsTranscriptOpen((current) => !current)}
              style={styles.transcriptToggle}
            >
              <View>
                <Text style={styles.transcriptLabel}>FULL TRANSCRIPT</Text>
                <Text style={styles.transcriptMeta}>What you said — {wordCount} words</Text>
              </View>
              <Text style={styles.chevron}>{isTranscriptOpen ? '⌃' : '⌄'}</Text>
            </Pressable>

            {isTranscriptOpen ? (
              <Text style={styles.transcript}>{storey.transcript || 'No transcript yet.'}</Text>
            ) : null}

            <Text style={styles.sectionLabel}>THEMES</Text>
            <View style={styles.chipRow}>
              {(storey.tags?.length ? storey.tags : ['draft']).map((tag) => (
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

            <View style={styles.actionRow}>
              <Pressable onPress={() => setIsEditingTitle(true)} style={styles.actionPill}>
                <Text style={styles.actionText}>Edit title</Text>
              </Pressable>
              <View style={styles.actionPill}>
                <Text style={styles.actionText}>Edit themes</Text>
              </View>
              <View style={styles.actionPill}>
                <Text style={styles.actionText}>Add a person</Text>
              </View>
              <View style={styles.actionPill}>
                <Text style={styles.actionText}>Download</Text>
              </View>
            </View>
            <Text style={styles.footer}>Sharing off · your story stays yours.</Text>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function getMarkedMoments(storey: Storey | null): MarkedMoment[] {
  const quotes = storey?.memorable_quotes?.length
    ? storey.memorable_quotes
    : splitSummary(storey?.summary).slice(0, 4);
  const times = [9, 41, 68, 87];

  return (quotes.length ? quotes : ['This Storey is still being processed.']).slice(0, 4).map((quote, index) => ({
    quote: quote.replace(/^["“]|["”]$/g, ''),
    seconds: times[index] ?? 9,
    t: formatAudioTime(times[index] ?? 9),
  }));
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
    minWidth: 110,
  },
  backChevron: {
    color: '#5A6470',
    fontFamily: fonts.serif,
    fontSize: 18,
    lineHeight: 14,
  },
  backText: {
    color: '#5A6470',
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
    color: '#A6A092',
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 1.32,
  },
  overflow: {
    color: colors.faint,
    fontSize: 21,
    lineHeight: 20,
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
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 2.2,
    lineHeight: 10,
    marginBottom: 8,
    textAlign: 'center',
  },
  dateLine: {
    color: colors.blue,
    fontFamily: fonts.monoBold,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    lineHeight: 12,
    marginBottom: 6,
    textAlign: 'center',
  },
  capturedBy: {
    color: '#9AA1AB',
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 12,
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
    minWidth: 72,
    paddingHorizontal: 14,
    paddingVertical: 9,
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
  playIcon: {
    color: '#CDD9E5',
    fontSize: 16,
    lineHeight: 18,
  },
  waveform: {
    alignItems: 'flex-end',
    flex: 1,
    flexDirection: 'row',
    gap: 2,
    height: 44,
  },
  waveformPhone: {
    height: 40,
  },
  waveBar: {
    borderRadius: 3,
    flex: 1,
    maxWidth: 3,
    minWidth: 2.5,
  },
  playbackErrorText: {
    color: colors.danger,
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  sectionLabel: {
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 1.98,
    lineHeight: 11,
    marginBottom: 12,
    marginTop: 26,
  },
  sectionHint: {
    color: '#BCB6A6',
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
    alignItems: 'center',
    flexDirection: 'row',
    gap: 13,
  },
  timePill: {
    alignItems: 'center',
    backgroundColor: '#F6ECE0',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  timeDot: {
    backgroundColor: '#C0883F',
    borderRadius: 2.5,
    height: 5,
    width: 5,
  },
  timeText: {
    color: '#B07A3A',
    fontFamily: fonts.monoBold,
    fontSize: 11,
    fontWeight: '700',
  },
  quote: {
    color: '#5A6470',
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
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 1.76,
    marginBottom: 5,
  },
  transcriptMeta: {
    color: '#8A939E',
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '400',
  },
  chevron: {
    color: colors.faint,
    fontSize: 24,
    lineHeight: 24,
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
    color: colors.blue,
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
    borderColor: '#D3CCBE',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  actionText: {
    color: '#4A525D',
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    fontWeight: '500',
  },
  footer: {
    color: '#B0A894',
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
