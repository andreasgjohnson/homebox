import AsyncStorage from '@react-native-async-storage/async-storage';

import { getMemoryAudioPath, removeMemoryAudio, uploadMemoryAudio } from '@/lib/audioStorage';
import { createRecordedMemory, getMemory, listMemories } from '@/lib/memories';
import { processMemory } from '@/lib/processMemory';

const pendingFirstMemoryKey = 'storeybox:onboarding-first-memory';

type PendingStatus =
  | 'recorded'
  | 'waiting_for_email'
  | 'ready_to_finalize'
  | 'uploading'
  | 'creating_memory'
  | 'processing'
  | 'processing_failed'
  | 'failed';

export type PendingFirstMemoryDraft = {
  id: string;
  audioDataUrl: string;
  capturedAt: string;
  mimeType: string;
  size: number;
  status: PendingStatus;
  requestedEmail?: string;
  onboardingCompletedAt?: string;
  associatedUserId?: string;
  memoryId?: string;
  audioPath?: string;
  uploadCompletedAt?: string;
  memoryCreatedAt?: string;
  lastError?: string;
  updatedAt: string;
};

export type FirstMemoryProgress = {
  label: string;
  progress: number;
};

export type FirstMemoryFinalizationResult =
  | { status: 'idle' }
  | { status: 'complete'; memoryId: string }
  | { status: 'retryable-error'; message: string; memoryId?: string };

type FinalizeOptions = {
  onProgress?: (progress: FirstMemoryProgress) => void;
  userEmail?: string | null;
};

export async function savePendingFirstMemoryRecording(blob: Blob) {
  const draft: PendingFirstMemoryDraft = {
    id: createDraftId(),
    audioDataUrl: await blobToDataUrl(blob),
    capturedAt: new Date().toISOString(),
    mimeType: blob.type || 'audio/webm',
    size: blob.size,
    status: 'recorded',
    updatedAt: new Date().toISOString(),
  };

  await writePendingFirstMemoryDraft(draft);
  return draft;
}

export async function getPendingFirstMemoryDraft() {
  const rawDraft = await AsyncStorage.getItem(pendingFirstMemoryKey);

  if (!rawDraft) {
    return null;
  }

  try {
    const draft = JSON.parse(rawDraft) as PendingFirstMemoryDraft;
    return isValidPendingDraft(draft) ? draft : null;
  } catch {
    await clearPendingFirstMemoryDraft();
    return null;
  }
}

export async function markPendingFirstMemoryWaitingForEmail(email: string) {
  const draft = await getPendingFirstMemoryDraft();

  if (!draft) {
    return null;
  }

  return writePendingFirstMemoryDraft({
    ...draft,
    requestedEmail: email.trim().toLowerCase(),
    status: 'waiting_for_email',
    updatedAt: new Date().toISOString(),
  });
}

export async function markPendingFirstMemoryOnboardingComplete(email: string) {
  const draft = await getPendingFirstMemoryDraft();

  if (!draft) {
    return null;
  }

  return writePendingFirstMemoryDraft({
    ...draft,
    requestedEmail: email.trim().toLowerCase(),
    onboardingCompletedAt: new Date().toISOString(),
    status: 'ready_to_finalize',
    updatedAt: new Date().toISOString(),
  });
}

export async function clearPendingFirstMemoryDraft() {
  await AsyncStorage.removeItem(pendingFirstMemoryKey);
}

export async function finalizePendingFirstMemory(
  userId: string,
  options: FinalizeOptions = {},
): Promise<FirstMemoryFinalizationResult> {
  let draft = await getPendingFirstMemoryDraft();

  if (!draft?.onboardingCompletedAt) {
    return { status: 'idle' };
  }

  if (draft.associatedUserId && draft.associatedUserId !== userId) {
    return { status: 'idle' };
  }

  const requestedEmail = draft.requestedEmail?.toLowerCase();
  const sessionEmail = options.userEmail?.toLowerCase();

  if (requestedEmail && sessionEmail && requestedEmail !== sessionEmail) {
    return { status: 'idle' };
  }

  if (!draft.associatedUserId) {
    const { count, error } = await listMemories(userId, { count: 'exact', head: true });

    if (error) {
      return failDraft(draft, error.message);
    }

    if ((count ?? 0) > 0) {
      await clearPendingFirstMemoryDraft();
      return { status: 'idle' };
    }

    draft = await writePendingFirstMemoryDraft({
      ...draft,
      associatedUserId: userId,
      memoryId: draft.memoryId ?? createDraftId(),
      status: 'ready_to_finalize',
      updatedAt: new Date().toISOString(),
    });
  }

  const memoryId = draft.memoryId ?? createDraftId();
  const audioPath = draft.audioPath ?? getMemoryAudioPath(userId, memoryId);

  try {
    if (!draft.uploadCompletedAt) {
      options.onProgress?.({ label: 'Saving your first memory...', progress: 35 });
      draft = await writePendingFirstMemoryDraft({
        ...draft,
        audioPath,
        memoryId,
        status: 'uploading',
        updatedAt: new Date().toISOString(),
      });

      const { error: uploadError } = await uploadMemoryAudio(
        draft.audioDataUrl,
        audioPath,
        draft.mimeType,
      );

      if (uploadError) {
        throw uploadError;
      }

      draft = await writePendingFirstMemoryDraft({
        ...draft,
        uploadCompletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    if (!draft.memoryCreatedAt) {
      options.onProgress?.({ label: 'Opening your archive...', progress: 60 });
      draft = await writePendingFirstMemoryDraft({
        ...draft,
        status: 'creating_memory',
        updatedAt: new Date().toISOString(),
      });

      const { error: createError } = await createRecordedMemory(
        userId,
        audioPath,
        draft.capturedAt,
        'My first hello to Storeybox',
        memoryId,
      );

      if (createError) {
        await removeMemoryAudio(audioPath);
        throw createError;
      }

      draft = await writePendingFirstMemoryDraft({
        ...draft,
        memoryCreatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } else {
      const { error: memoryError } = await getMemory(memoryId, userId);

      if (memoryError) {
        throw memoryError;
      }
    }

    options.onProgress?.({ label: 'Transcribing your first memory...', progress: 85 });
    await writePendingFirstMemoryDraft({
      ...draft,
      status: 'processing',
      updatedAt: new Date().toISOString(),
    });

    const { error: processError } = await processMemory(memoryId, audioPath);

    if (processError) {
      await writePendingFirstMemoryDraft({
        ...draft,
        status: 'processing_failed',
        lastError: processError.message,
        updatedAt: new Date().toISOString(),
      });

      return {
        status: 'retryable-error',
        message: processError.message,
        memoryId,
      };
    }

    options.onProgress?.({ label: 'Memory ready.', progress: 100 });
    await clearPendingFirstMemoryDraft();

    return { status: 'complete', memoryId };
  } catch (error) {
    return failDraft(draft, error instanceof Error ? error.message : 'Could not prepare your first memory.');
  }
}

async function failDraft(draft: PendingFirstMemoryDraft, message: string) {
  await writePendingFirstMemoryDraft({
    ...draft,
    lastError: message,
    status: 'failed',
    updatedAt: new Date().toISOString(),
  });

  return {
    status: 'retryable-error',
    message,
    memoryId: draft.memoryId,
  } as const;
}

async function writePendingFirstMemoryDraft(draft: PendingFirstMemoryDraft) {
  await AsyncStorage.setItem(pendingFirstMemoryKey, JSON.stringify(draft));
  return draft;
}

function isValidPendingDraft(value: PendingFirstMemoryDraft) {
  return (
    value &&
    typeof value.id === 'string' &&
    typeof value.audioDataUrl === 'string' &&
    typeof value.capturedAt === 'string' &&
    typeof value.mimeType === 'string'
  );
}

function createDraftId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(reader.error ?? new Error('Could not read audio sample.'));
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Could not cache audio sample.'));
    };
    reader.readAsDataURL(blob);
  });
}
