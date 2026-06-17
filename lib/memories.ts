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
