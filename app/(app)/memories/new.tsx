import { type Href, useRouter } from 'expo-router';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
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
} from 'react-native';

import { AudioPlayback } from '@/components/AudioPlayback';
import { getMemoryAudioPath, removeMemoryAudio, uploadMemoryAudio } from '@/lib/audioStorage';
import { createRecordedMemory, deleteMemory, updateMemoryAudioPath } from '@/lib/memories';
import { processMemory } from '@/lib/processMemory';
import { colors, radii, typography } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

const recordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  directory: 'document' as const,
  isMeteringEnabled: true,
};

type UploadStatus = {
  label: string;
  progress: number;
};

export default function NewMemoryScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const audioRecorder = useAudioRecorder(recordingOptions);
  const recorderState = useAudioRecorderState(audioRecorder);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [recordedAt, setRecordedAt] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState(() => getDefaultRecordingTitle(new Date()));
  const [hasEditedTitle, setHasEditedTitle] = useState(false);
  const [fileSizeBytes, setFileSizeBytes] = useState<number | null>(null);
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

      if (!permission.granted) {
        setErrorMessage('Microphone permission is required to record a memory.');
        Alert.alert('Microphone permission needed', 'Enable microphone access to record a memory.');
        return;
      }

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
    if (!hasMicrophonePermission) {
      setErrorMessage('Microphone permission is required to record a memory.');
      return;
    }

    setAudioUri(null);
    setRecordedAt(null);
    setFileSizeBytes(null);
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

      setAudioUri(uri);
      setRecordedAt(stoppedAt.toISOString());
      if (!hasEditedTitle) {
        setTitleDraft(getDefaultRecordingTitle(stoppedAt));
      }
      setFileSizeBytes(fileInfo.size);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Could not stop recording.'));
    }
  }

  async function saveMemory() {
    if (!session?.user.id || !audioUri || !recordedAt) {
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
      setUploadStatus({ label: 'Preparing audio...', progress: 35 });

      setUploadStatus({ label: 'Uploading audio...', progress: 60 });
      const { error: uploadError } = await uploadMemoryAudio(audioUri, audioPath);

      if (uploadError) {
        throw uploadError;
      }

      uploadedAudioPath = audioPath;
      setUploadStatus({ label: 'Saving upload path...', progress: 85 });
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

      setUploadStatus({ label: 'Memory processed.', progress: 100 });
      router.replace('/' as Href);
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
  const canSave = Boolean(audioUri && recordedAt) && !isRecording && !isSaving;

  function updateTitleDraft(value: string) {
    setHasEditedTitle(true);
    setTitleDraft(value);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Pressable
            disabled={isRecording}
            onPress={() => router.replace('/' as Href)}
            style={styles.backButton}
          >
            <Text style={[styles.backButtonText, isRecording && styles.disabledText]}>Back</Text>
          </Pressable>

          <Text style={styles.eyebrow}>NEW MEMORY</Text>
          <Text style={styles.title}>Record a story worth keeping.</Text>
          <Text style={styles.body}>
            Capture audio on this device, title it, and save the recording with a transcript,
            summary, and tags.
          </Text>

          <View style={styles.titlePanel}>
            <Text style={styles.inputLabel}>Title this memory</Text>
            <Text style={styles.inputHint}>Edit now or keep the automatic date title.</Text>
            <TextInput
              autoCapitalize="sentences"
              editable={!isSaving}
              onChangeText={updateTitleDraft}
              placeholder="Recording title"
              placeholderTextColor={colors.faint}
              returnKeyType="done"
              style={styles.titleInput}
              value={titleDraft}
            />
          </View>

          <View style={styles.recorderPanel}>
            <Text style={styles.timer}>{elapsedLabel}</Text>
            <Text style={styles.statusText}>
              {isRecording ? 'Recording now' : audioUri ? 'Recording saved locally' : 'Ready to record'}
            </Text>
            <Pressable
              disabled={!hasMicrophonePermission}
              onPress={() => void (isRecording ? stopRecording() : startRecording())}
              style={({ pressed }) => [
                styles.recordButton,
                isRecording && styles.stopButton,
                !hasMicrophonePermission && styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.recordButtonText}>
                {isRecording ? 'Stop recording' : audioUri ? 'Re-record and replace' : 'Start recording'}
              </Text>
            </Pressable>
            {audioUri ? (
              <Text style={styles.replaceHint}>
                Re-recording will replace the current local recording.
              </Text>
            ) : null}
          </View>

          <AudioPlayback disabled={isRecording} title="Playback (optional)" uri={audioUri} />

          {audioUri ? (
            <View style={styles.filePanel}>
              <Text style={styles.fileLabel}>Local file</Text>
              <Text style={styles.fileValue} numberOfLines={1}>
                {audioUri}
              </Text>
              <Text style={styles.fileMeta}>{formatFileSize(fileSizeBytes)}</Text>
            </View>
          ) : null}

          {errorMessage ? (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>{errorMessage}</Text>
            </View>
          ) : null}

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

          <Pressable
            disabled={!canSave}
            onPress={() => void saveMemory()}
            style={({ pressed }) => [
              styles.primaryButton,
              !canSave && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryButtonText}>Save and process recording</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function formatDuration(durationMillis: number) {
  const totalSeconds = Math.floor(durationMillis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) {
    return 'File size unavailable';
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDefaultRecordingTitle(recordedAt: Date) {
  return `Recording - ${new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(recordedAt)}`;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getSaveErrorMessage(error: unknown) {
  const message = getErrorMessage(error, 'Recording save failed. Please try saving again.');
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes('bucket not found')) {
    return 'Audio upload is not ready yet: the Supabase Storage bucket "memory-audio" was not found. Apply the Phase 4 storage migration, then try saving again.';
  }

  if (normalizedMessage.includes('function') || normalizedMessage.includes('process-memory')) {
    return 'AI processing is not ready yet: deploy the Supabase Edge Function "process-memory" and set OPENAI_API_KEY, then try saving again.';
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
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingBottom: 40,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 28,
  },
  backButtonText: {
    color: colors.charcoal,
    fontSize: 15,
    fontWeight: '700',
  },
  disabledText: {
    opacity: 0.45,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.goldDark,
    marginBottom: 14,
  },
  title: {
    ...typography.screenTitle,
    color: colors.ink,
    marginBottom: 14,
  },
  body: {
    ...typography.body,
    color: colors.muted,
  },
  recorderPanel: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    marginTop: 28,
    padding: 22,
  },
  timer: {
    color: colors.ink,
    fontSize: 52,
    fontWeight: '700',
    marginBottom: 8,
  },
  statusText: {
    color: colors.blueDark,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 18,
  },
  recordButton: {
    alignItems: 'center',
    backgroundColor: colors.charcoal,
    borderRadius: radii.control,
    minWidth: 190,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  stopButton: {
    backgroundColor: colors.danger,
  },
  recordButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  replaceHint: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 12,
    textAlign: 'center',
  },
  titlePanel: {
    backgroundColor: colors.surfaceBlue,
    borderColor: colors.blue,
    borderRadius: radii.card,
    borderWidth: 2,
    boxShadow: '0 8px 18px rgba(32, 39, 43, 0.08)',
    marginTop: 16,
    padding: 16,
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
  titleInput: {
    backgroundColor: colors.surface,
    borderColor: colors.blue,
    borderRadius: radii.control,
    borderWidth: 2,
    color: colors.ink,
    fontSize: 20,
    fontWeight: '700',
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  filePanel: {
    marginTop: 14,
  },
  fileLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 5,
  },
  fileValue: {
    color: colors.muted,
    fontSize: 13,
  },
  fileMeta: {
    color: colors.blueDark,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 5,
  },
  notice: {
    backgroundColor: colors.dangerSurface,
    borderColor: colors.dangerBorder,
    borderRadius: radii.card,
    borderWidth: 1,
    marginTop: 18,
    padding: 16,
  },
  noticeText: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  uploadPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    marginTop: 16,
    padding: 16,
  },
  uploadHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  uploadLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  uploadPercent: {
    color: colors.blueDark,
    fontSize: 13,
    fontWeight: '700',
  },
  progressTrack: {
    backgroundColor: colors.surfaceBlue,
    borderRadius: radii.pill,
    height: 8,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: colors.gold,
    borderRadius: radii.pill,
    height: 8,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.charcoal,
    borderRadius: radii.control,
    marginTop: 18,
    paddingVertical: 16,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.65,
  },
});
