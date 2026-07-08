import { supabase } from '@/lib/supabase';

export type Storey = {
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

export type StoreyListItem = Pick<
  Storey,
  'id' | 'user_id' | 'title' | 'summary' | 'emotional_tone' | 'tags' | 'recorded_at' | 'created_at'
>;

const storeysTable = 'memories';
const listStoreyColumns = 'id,user_id,title,summary,emotional_tone,tags,recorded_at,created_at';
const detailStoreyColumns =
  'id,user_id,title,summary,transcript,emotional_tone,tags,memorable_quotes,audio_url,recorded_at,created_at';

type ListStoreysOptions = {
  count?: 'exact' | 'planned' | 'estimated';
  head?: boolean;
};

export async function listStoreys(userId: string, options: ListStoreysOptions = {}) {
  return supabase
    .from(storeysTable)
    .select(listStoreyColumns, {
      count: options.count,
      head: options.head,
    })
    .eq('user_id', userId)
    .order('recorded_at', { ascending: false });
}

export async function getStorey(storeyId: string, userId: string) {
  return supabase
    .from(storeysTable)
    .select(detailStoreyColumns)
    .eq('id', storeyId)
    .eq('user_id', userId)
    .single();
}

export async function deleteStorey(storeyId: string, userId: string) {
  return supabase.from(storeysTable).delete().eq('id', storeyId).eq('user_id', userId);
}

export async function updateStoreyTitle(storeyId: string, userId: string, title: string) {
  return supabase
    .from(storeysTable)
    .update({ title })
    .eq('id', storeyId)
    .eq('user_id', userId)
    .select(detailStoreyColumns)
    .single();
}
