import { type Href, useRouter } from 'expo-router';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { getInfoAsync } from 'expo-file-system/legacy';
import { useEffect, useMemo, useState } from 'react';
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
  type ViewStyle,
} from 'react-native';

import { getMemoryAudioPath, removeMemoryAudio, uploadMemoryAudio } from '@/lib/audioStorage';
import { createRecordedMemory, deleteMemory, updateMemoryAudioPath } from '@/lib/memories';
import { processMemory } from '@/lib/processMemory';
import { colors, fonts } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

const recordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  directory: 'document' as const,
  isMeteringEnabled: true,
};

const recordHazeStyle = {
  backgroundImage: 'radial-gradient(circle,#9fc0de 0%,#bcd2e6 38%,transparent 70%)',
} as unknown as ViewStyle;

type UploadStatus = {
  label: string;
  progress: number;
};

export default function NewMemoryScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const audioRecorder = useAudioRecorder(recordingOptions);
  const recorderState = useAudioRecorderState(audioRecorder);
  const [titleDraft, setTitleDraft] = useState(() => getDefaultRecordingTitle(new Date()));
  const [hasEditedTitle, setHasEditedTitle] = useState(false);
  const [hasMicrophonePermission, setHasMicrophonePermission] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const elapsedLabel = useMemo(
    () => formatDuration(recorderState.durationMillis),
    [recorderState.durationMillis],
  );

  useEffect(() => {
    let isMounted = true;

    async function prepareAudioSession() {
      const permission = await AudioModule.requestRecordingPermissionsAsync();

      if (!isMounted) {
        return;
      }

      setHasMicrophonePermission(permission.granted);

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
      });
    }

    void prepareAudioSession();

    return () => {
      isMounted = false;
      void setAudioModeAsync({ allowsRecording: false });
    };
  }, []);

  async function startRecording() {
    if (isSaving) {
      return;
    }

    if (!hasMicrophonePermission) {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      setHasMicrophonePermission(permission.granted);

      if (!permission.granted) {
        setErrorMessage('Microphone permission is required to record a memory.');
        Alert.alert('Microphone permission needed', 'Enable microphone access to record a memory.');
        return;
      }
    }

    if (isSaving) {
      return;
    }

    setUploadStatus(null);
    setErrorMessage(null);

    if (!hasEditedTitle) {
      setTitleDraft(getDefaultRecordingTitle(new Date()));
    }

    try {
      await audioRecorder.prepareToRecordAsync(recordingOptions);
      audioRecorder.record();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Could not start recording.'));
    }
  }

  async function stopRecording() {
    setErrorMessage(null);

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri ?? recorderState.url;

      if (!uri) {
        setErrorMessage('Recording stopped, but no local file URI was returned.');
        return;
      }

      const fileInfo = await getRecordingFileInfo(uri);

      if (fileInfo.exists === false || fileInfo.size === 0) {
        setErrorMessage('Recording file was created but appears to be empty.');
        return;
      }

      const stoppedAt = new Date();

      if (!hasEditedTitle) {
        setTitleDraft(getDefaultRecordingTitle(stoppedAt));
      }

      await saveMemory(uri, stoppedAt.toISOString());
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Could not stop recording.'));
    }
  }

  async function saveMemory(audioUri: string, recordedAt: string) {
    if (!session?.user.id) {
      return;
    }

    setIsSaving(true);
    setUploadStatus({ label: 'Creating memory...', progress: 15 });
    setErrorMessage(null);

    const memoryTitle = titleDraft.trim() || getDefaultRecordingTitle(new Date(recordedAt));
    const { data: memory, error: createError } = await createRecordedMemory(
      session.user.id,
      null,
      recordedAt,
      memoryTitle,
    );

    if (createError) {
      setErrorMessage(createError.message);
      setIsSaving(false);
      setUploadStatus(null);
      return;
    }

    const audioPath = getMemoryAudioPath(session.user.id, memory.id);
    let uploadedAudioPath: string | null = null;

    try {
      setUploadStatus({ label: 'Uploading audio...', progress: 55 });
      const { error: uploadError } = await uploadMemoryAudio(audioUri, audioPath);

      if (uploadError) {
        throw uploadError;
      }

      uploadedAudioPath = audioPath;
      setUploadStatus({ label: 'Saving private audio...', progress: 78 });
      const { error: updateError } = await updateMemoryAudioPath(
        memory.id,
        session.user.id,
        audioPath,
      );

      if (updateError) {
        throw updateError;
      }

      setUploadStatus({ label: 'Transcribing and summarizing...', progress: 94 });
      const { error: processError } = await processMemory(memory.id, audioPath);

      if (processError) {
        throw processError;
      }

      setUploadStatus({ label: 'Memory ready.', progress: 100 });
      router.replace(`/memories/${memory.id}` as Href);
    } catch (error) {
      if (uploadedAudioPath) {
        await removeMemoryAudio(uploadedAudioPath);
      }

      await deleteMemory(memory.id, session.user.id);
      setErrorMessage(getSaveErrorMessage(error));
      setIsSaving(false);
      setUploadStatus(null);
    }
  }

  const isRecording = recorderState.isRecording;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.topBar}>
          <Pressable
            disabled={isRecording || isSaving}
            onPress={() => router.replace('/' as Href)}
            style={styles.cancelButton}
          >
            <Text style={styles.cancelChevron}>‹</Text>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.wordmark}>STOREYBOX</Text>
          <Text style={styles.privateLabel}>PRIVATE</Text>
        </View>

        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>A NEW MEMORY</Text>
          <Text style={styles.title}>Record what you want{'\n'}your future self to find.</Text>

          <View style={styles.titleBlock}>
            <Text style={styles.titleLabel}>TITLE</Text>
            <View style={styles.titleRow}>
              <TextInput
                autoCapitalize="sentences"
                editable={!isRecording && !isSaving}
                onChangeText={(value) => {
                  setHasEditedTitle(true);
                  setTitleDraft(value);
                }}
                placeholder="Recording title"
                placeholderTextColor={colors.faint}
                returnKeyType="done"
                style={styles.titleInput}
                value={titleDraft}
              />
              <Text style={styles.pencil}>✎</Text>
            </View>
          </View>

          <View style={styles.recorder}>
            <Text style={styles.readyLabel}>
              {isSaving ? 'SAVING YOUR MEMORY' : isRecording ? 'RECORDING' : 'READY WHEN YOU ARE'}
            </Text>
            <Pressable
              disabled={isSaving}
              onPress={() => void (isRecording ? stopRecording() : startRecording())}
              style={({ pressed }) => [
                styles.recordTarget,
                isSaving && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.recordHaze, recordHazeStyle]} />
              <View style={[styles.recordCore, isRecording && styles.recordCoreLive]}>
                <MicIcon />
                <Text style={styles.recordButtonText}>
                  {isSaving ? uploadStatus?.label ?? 'Saving...' : isRecording ? elapsedLabel : 'Press to record'}
                </Text>
              </View>
            </Pressable>
            <Text style={styles.tapHint}>Tap once to begin · tap again to stop</Text>
          </View>

          <View style={styles.nudge}>
            <Text style={styles.nudgeLabel}>NEED A NUDGE?</Text>
            <Text style={styles.nudgeText}>
              What do you not want to forget? · An idea you don't want to lose
            </Text>
          </View>

          {uploadStatus ? (
            <View style={styles.uploadPanel}>
              <View style={styles.uploadHeader}>
                <Text style={styles.uploadLabel}>{uploadStatus.label}</Text>
                <Text style={styles.uploadPercent}>{uploadStatus.progress}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${uploadStatus.progress}%` }]} />
              </View>
            </View>
          ) : null}

          {errorMessage ? (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.promise}>
            <Text style={styles.promiseText}>
              Storeybox keeps the audio, a clean transcript, a gentle summary, and a few quiet
              signals.
            </Text>
            <Text style={styles.privacyText}>Nothing is shared. Your story stays yours.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MicIcon() {
  return (
    <View style={styles.micWrap}>
      <View style={styles.micBody} />
      <View style={styles.micArc} />
      <View style={styles.micStem} />
    </View>
  );
}

function formatDuration(durationMillis: number) {
  const totalSeconds = Math.floor(durationMillis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getDefaultRecordingTitle(recordedAt: Date) {
  return `Recording · ${new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(recordedAt)}`;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getSaveErrorMessage(error: unknown) {
  const message = getErrorMessage(error, 'Recording save failed. Please try recording again.');
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes('bucket not found')) {
    return 'Audio upload is not ready yet: the Supabase Storage bucket "memory-audio" was not found.';
  }

  if (normalizedMessage.includes('function') || normalizedMessage.includes('process-memory')) {
    return 'AI processing is not ready yet: deploy the Supabase Edge Function "process-memory" and set OPENAI_API_KEY.';
  }

  return message;
}

async function getRecordingFileInfo(uri: string) {
  if (Platform.OS === 'web') {
    return {
      exists: null,
      size: null,
    };
  }

  try {
    const info = await getInfoAsync(uri);
    return {
      exists: info.exists,
      size: info.exists ? info.size ?? null : null,
    };
  } catch {
    return {
      exists: null,
      size: null,
    };
  }
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  topBar: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    paddingVertical: 20,
  },
  cancelButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minWidth: 86,
  },
  cancelChevron: {
    color: '#5A6470',
    fontFamily: fonts.serif,
    fontSize: 18,
    lineHeight: 14,
  },
  cancelText: {
    color: '#5A6470',
    fontFamily: fonts.sans,
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
  privateLabel: {
    color: '#A6A092',
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 1.32,
    minWidth: 86,
    textAlign: 'right',
  },
  container: {
    alignItems: 'center',
    alignSelf: 'center',
    maxWidth: 540,
    paddingBottom: 48,
    paddingHorizontal: 32,
    width: '100%',
  },
  eyebrow: {
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 2.2,
    lineHeight: 11,
    marginTop: 42,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 38,
    fontWeight: '300',
    letterSpacing: -0.38,
    lineHeight: 42.56,
    marginTop: 16,
    textAlign: 'center',
  },
  titleBlock: {
    alignSelf: 'stretch',
    marginTop: 30,
  },
  titleLabel: {
    color: '#A6A092',
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 1.6,
    lineHeight: 10,
    marginBottom: 9,
  },
  titleRow: {
    alignItems: 'center',
    borderBottomColor: '#D9D2C4',
    borderBottomWidth: 1.5,
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 10,
  },
  titleInput: {
    color: '#3A3530',
    flex: 1,
    fontFamily: fonts.serif,
    fontSize: 21,
    fontWeight: '400',
    lineHeight: 27.3,
    padding: 0,
  },
  pencil: {
    color: colors.faint,
    fontSize: 17,
  },
  recorder: {
    alignItems: 'center',
    marginTop: 44,
  },
  readyLabel: {
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 2.2,
    lineHeight: 11,
    marginBottom: 22,
  },
  recordTarget: {
    height: 172,
    position: 'relative',
    width: 172,
  },
  recordHaze: {
    borderRadius: 126,
    bottom: -40,
    left: -40,
    opacity: 0.72,
    position: 'absolute',
    right: -40,
    top: -40,
  },
  recordCore: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 86,
    bottom: 0,
    boxShadow: '0 16px 40px rgba(30,38,48,.3)',
    gap: 9,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  recordCoreLive: {
    backgroundColor: '#C0883F',
  },
  micWrap: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  micBody: {
    borderColor: '#CDD9E5',
    borderRadius: 6,
    borderWidth: 1.6,
    height: 17,
    width: 10,
  },
  micArc: {
    borderBottomColor: '#CDD9E5',
    borderBottomWidth: 1.6,
    borderLeftColor: '#CDD9E5',
    borderLeftWidth: 1.6,
    borderRightColor: '#CDD9E5',
    borderRightWidth: 1.6,
    borderRadius: 11,
    height: 12,
    marginTop: -8,
    width: 22,
  },
  micStem: {
    backgroundColor: '#CDD9E5',
    height: 7,
    marginTop: -1,
    width: 1.6,
  },
  recordButtonText: {
    color: '#EEF3F7',
    fontFamily: fonts.serif,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 15,
    textAlign: 'center',
  },
  tapHint: {
    color: colors.faint,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '400',
    marginTop: 20,
  },
  nudge: {
    alignItems: 'center',
    marginTop: 30,
  },
  nudgeLabel: {
    color: '#AAA294',
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 1.2,
    lineHeight: 12,
  },
  nudgeText: {
    color: colors.faint,
    fontFamily: fonts.serif,
    fontSize: 15,
    fontStyle: 'italic',
    fontWeight: '400',
    lineHeight: 25.5,
    marginTop: 10,
    textAlign: 'center',
  },
  uploadPanel: {
    alignSelf: 'stretch',
    marginTop: 24,
  },
  uploadHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  uploadLabel: {
    color: colors.blue,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '600',
  },
  uploadPercent: {
    color: '#A6A092',
    fontFamily: fonts.mono,
    fontSize: 12,
  },
  progressTrack: {
    backgroundColor: '#E4DDCF',
    borderRadius: 999,
    height: 6,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#C0883F',
    borderRadius: 999,
    height: 6,
  },
  notice: {
    alignSelf: 'stretch',
    backgroundColor: colors.dangerSurface,
    borderColor: colors.dangerBorder,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 24,
    padding: 14,
  },
  noticeText: {
    color: colors.danger,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  promise: {
    alignSelf: 'stretch',
    borderTopColor: colors.borderStrong,
    borderTopWidth: 1,
    marginTop: 40,
    paddingTop: 30,
  },
  promiseText: {
    color: colors.charcoal,
    fontFamily: fonts.serif,
    fontSize: 22,
    fontWeight: '300',
    lineHeight: 31.9,
    textAlign: 'center',
  },
  privacyText: {
    color: colors.blue,
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
    marginTop: 14,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.72,
  },
});
