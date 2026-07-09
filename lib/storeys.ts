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
  source: string | null;
  captured_by_box_name: string | null;
  captured_at_location: string | null;
  provenance_label: string | null;
  recorded_at: string;
  created_at: string;
};

export type StoreyListItem = Pick<
  Storey,
  | 'id'
  | 'user_id'
  | 'title'
  | 'summary'
  | 'emotional_tone'
  | 'tags'
  | 'source'
  | 'captured_by_box_name'
  | 'provenance_label'
  | 'recorded_at'
  | 'created_at'
>;

export type StoreyProvenance = {
  // Full one-line label, e.g. "KEPT AT HOME · Captured by Bedside Box".
  label: string;
  // The part before the separator, e.g. "KEPT AT HOME".
  badge: string;
  // The part after the separator, e.g. "Captured by Bedside Box".
  capturedBy: string;
};

const storeysTable = 'memories';
const provenanceColumns = 'source,captured_by_box_name,provenance_label';
const listStoreyColumns = `id,user_id,title,summary,emotional_tone,tags,${provenanceColumns},recorded_at,created_at`;
const detailStoreyColumns = `id,user_id,title,summary,transcript,emotional_tone,tags,memorable_quotes,audio_url,${provenanceColumns},captured_at_location,recorded_at,created_at`;

// Storeys captured by hardware carry snapshot provenance written by box-api.
// Legacy phone-era rows have none, so they fall back to archive wording
// instead of claiming a Box captured them.
export function getStoreyProvenance(
  storey: Pick<Storey, 'source' | 'captured_by_box_name' | 'provenance_label'>,
): StoreyProvenance {
  const label =
    storey.provenance_label ??
    (storey.source === 'box'
      ? `KEPT AT HOME · Captured by ${storey.captured_by_box_name ?? 'your Box'}`
      : 'KEPT IN YOUR ARCHIVE');
  const separatorIndex = label.indexOf('·');

  if (separatorIndex === -1) {
    return { label, badge: label, capturedBy: '' };
  }

  return {
    label,
    badge: label.slice(0, separatorIndex).trim(),
    capturedBy: label.slice(separatorIndex + 1).trim(),
  };
}

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

// Deletion runs server-side so the Storey row, processing jobs, and private
// audio are removed together; clients no longer hold DELETE on memories.
export async function deleteStorey(storeyId: string) {
  const { error } = await supabase.functions.invoke('delete-storey', {
    body: { storey_id: storeyId },
  });

  if (!error) {
    return { error: null };
  }

  return { error: new Error(await readFunctionErrorMessage(error)) };
}

async function readFunctionErrorMessage(error: unknown) {
  const context =
    typeof error === 'object' && error !== null ? (error as Record<string, unknown>).context : null;

  if (typeof Response !== 'undefined' && context instanceof Response) {
    try {
      const body = await context.clone().json();

      if (typeof body === 'object' && body !== null && typeof body.error === 'string') {
        return body.error;
      }
    } catch {
      // Fall back to the client error message below.
    }
  }

  return error instanceof Error ? error.message : 'Could not delete the Storey.';
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
