import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

export const MEMORY_AUDIO_BUCKET = 'memory-audio';

export function getMemoryAudioPath(userId: string, memoryId: string) {
  return `${userId}/${memoryId}/audio.${getRecordingFileExtension()}`;
}

export function isUploadedMemoryAudioPath(uriOrPath: string) {
  return !uriOrPath.startsWith('blob:') && !uriOrPath.startsWith('file:') && !uriOrPath.startsWith('http');
}

export async function uploadMemoryAudio(audioUri: string, audioPath: string) {
  const audioBody = await getAudioArrayBuffer(audioUri);

  return supabase.storage.from(MEMORY_AUDIO_BUCKET).upload(audioPath, audioBody, {
    cacheControl: '3600',
    contentType: getRecordingContentType(),
    upsert: true,
  });
}

export async function createMemoryAudioSignedUrl(audioPath: string) {
  return supabase.storage.from(MEMORY_AUDIO_BUCKET).createSignedUrl(audioPath, 60 * 30);
}

export async function removeMemoryAudio(audioPath: string) {
  return supabase.storage.from(MEMORY_AUDIO_BUCKET).remove([audioPath]);
}

async function getAudioArrayBuffer(audioUri: string) {
  const response = await fetch(audioUri);

  if (!response.ok) {
    throw new Error('Could not read the local recording for upload.');
  }

  return response.arrayBuffer();
}

function getRecordingContentType() {
  return Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4';
}

function getRecordingFileExtension() {
  return Platform.OS === 'web' ? 'webm' : 'm4a';
}
