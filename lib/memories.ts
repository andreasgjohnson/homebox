import { supabase } from '@/lib/supabase';

export type Memory = {
  id: string;
  user_id: string;
  title: string | null;
  summary: string | null;
  transcript: string | null;
  emotional_tone: string | null;
  tags: string[] | null;
  memorable_quotes: string[] | null;
  audio_url: string | null;
  recorded_at: string;
  created_at: string;
};

export type MemoryListItem = Pick<
  Memory,
  'id' | 'user_id' | 'title' | 'summary' | 'tags' | 'recorded_at' | 'created_at'
>;

const listMemoryColumns = 'id,user_id,title,summary,tags,recorded_at,created_at';

const detailMemoryColumns =
  'id,user_id,title,summary,transcript,emotional_tone,tags,memorable_quotes,audio_url,recorded_at,created_at';

export async function listMemories(userId: string) {
  return supabase
    .from('memories')
    .select(listMemoryColumns)
    .eq('user_id', userId)
    .order('recorded_at', { ascending: false });
}

export async function getMemory(memoryId: string, userId: string) {
  return supabase
    .from('memories')
    .select(detailMemoryColumns)
    .eq('id', memoryId)
    .eq('user_id', userId)
    .single();
}

export async function createPlaceholderMemory(userId: string) {
  const now = new Date().toISOString();

  return supabase
    .from('memories')
    .insert({
      user_id: userId,
      title: 'Untitled memory',
      summary: 'A saved placeholder for a future recorded memory.',
      transcript: null,
      emotional_tone: 'Unprocessed',
      tags: ['draft'],
      memorable_quotes: [],
      audio_url: null,
      recorded_at: now,
    })
    .select(detailMemoryColumns)
    .single();
}

export async function createRecordedMemory(
  userId: string,
  audioPath: string | null,
  recordedAt: string,
  title: string,
) {
  return supabase
    .from('memories')
    .insert({
      user_id: userId,
      title,
      summary: audioPath
        ? 'This recording is waiting for transcription and summary.'
        : 'Audio upload is in progress.',
      transcript: null,
      emotional_tone: 'Unprocessed',
      tags: audioPath ? ['recorded', 'uploaded'] : ['recorded', 'uploading'],
      memorable_quotes: [],
      audio_url: audioPath,
      recorded_at: recordedAt,
    })
    .select(detailMemoryColumns)
    .single();
}

export async function deleteMemory(memoryId: string, userId: string) {
  return supabase.from('memories').delete().eq('id', memoryId).eq('user_id', userId);
}

export async function updateMemoryTitle(memoryId: string, userId: string, title: string) {
  return supabase
    .from('memories')
    .update({ title })
    .eq('id', memoryId)
    .eq('user_id', userId)
    .select(detailMemoryColumns)
    .single();
}

export async function updateMemoryAudioPath(memoryId: string, userId: string, audioPath: string) {
  return supabase
    .from('memories')
    .update({
      audio_url: audioPath,
      summary: 'This recording is being transcribed and summarized.',
      tags: ['recorded', 'processing'],
    })
    .eq('id', memoryId)
    .eq('user_id', userId)
    .select(detailMemoryColumns)
    .single();
}
