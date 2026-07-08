import { supabase } from '@/lib/supabase';

// Existing Supabase bucket name; keep stable until the backend storage migration is explicit.
export const STOREY_AUDIO_BUCKET = 'memory-audio';

export function isUploadedStoreyAudioPath(uriOrPath: string) {
  return !uriOrPath.startsWith('blob:') && !uriOrPath.startsWith('file:') && !uriOrPath.startsWith('http');
}

export async function createStoreyAudioSignedUrl(audioPath: string) {
  return supabase.storage.from(STOREY_AUDIO_BUCKET).createSignedUrl(audioPath, 60 * 30);
}

export async function removeStoreyAudio(audioPath: string) {
  return supabase.storage.from(STOREY_AUDIO_BUCKET).remove([audioPath]);
}
