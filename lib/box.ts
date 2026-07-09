import { HARDWARE_TO_CURRENT_BOX_STATE, type BoxUiState } from '@/lib/hardwareContract';
import { supabase } from '@/lib/supabase';

export type BoxState = 'unpaired' | 'ready' | 'recording' | 'syncing' | 'processing' | 'offline';

// Matches the heartbeat config the box-api Edge Function hands to hardware.
export const OFFLINE_AFTER_SECONDS = 180;

export type StoreyBox = {
  connection: 'wifi' | 'offline' | 'unknown';
  id: string;
  lastStoreyAt: string | null;
  lastSync: string | null;
  location: string | null;
  name: string;
  notifications: {
    newStorey: boolean;
    prompt: boolean;
    storeyReady: boolean;
  };
  state: BoxState;
};

export const defaultBox: StoreyBox = {
  connection: 'unknown',
  id: 'unpaired-box',
  lastStoreyAt: null,
  lastSync: null,
  location: null,
  name: 'Your Box',
  notifications: {
    newStorey: true,
    prompt: false,
    storeyReady: true,
  },
  state: 'unpaired',
};

export const boxStateDetails: Record<
  BoxState,
  {
    cardTitle: string;
    ledColor: string;
    note: string;
    sub: (box: StoreyBox) => string;
  }
> = {
  unpaired: {
    cardTitle: 'Pair your Box.',
    ledColor: '#8A939E',
    note: 'Box status will appear here after pairing is complete.',
    sub: () => 'NOT PAIRED YET',
  },
  ready: {
    cardTitle: 'Your Box is ready.',
    ledColor: '#3D5F7E',
    note: 'When something is worth keeping, press the button.',
    sub: (box) => `${(box.location ?? 'HOME').toUpperCase()} · CONNECTED`,
  },
  recording: {
    cardTitle: 'Your Box is listening.',
    ledColor: '#C0883F',
    note: 'The Box controls the recording. There is nothing to do here.',
    sub: () => 'TAKE YOUR TIME',
  },
  syncing: {
    cardTitle: 'A Storey is finding its place.',
    ledColor: '#5B7895',
    note: 'This usually takes a few moments.',
    sub: () => 'SAFELY UPLOADING FROM YOUR BOX',
  },
  processing: {
    cardTitle: 'Making room in your archive.',
    ledColor: '#5B7895',
    note: 'The transcript and summary will be ready soon.',
    sub: () => 'YOUR VOICE IS BEING PREPARED',
  },
  offline: {
    cardTitle: 'Your Box is keeping it safe.',
    ledColor: '#283040',
    note: 'Nothing will be lost.',
    sub: () => 'IT WILL SYNC WHEN IT RECONNECTS',
  },
};

export function getBoxStateDetail(box: StoreyBox) {
  return boxStateDetails[box.state];
}

type UserBoxRow = {
  id: string;
  public_device_id: string;
  name: string;
  location: string | null;
  lifecycle_status: 'provisioned' | 'unpaired' | 'paired' | 'revoked';
  cloud_state: BoxUiState;
  last_heartbeat_at: string | null;
  network_type: string | null;
  paired_at: string | null;
};

const userBoxColumns =
  'id,public_device_id,name,location,lifecycle_status,cloud_state,last_heartbeat_at,network_type,paired_at';

export async function fetchPrimaryStoreyBox(
  userId: string,
): Promise<{ box: StoreyBox; error: string | null }> {
  const { data, error } = await supabase
    .from('user_boxes')
    .select(userBoxColumns)
    .eq('user_id', userId)
    .order('paired_at', { ascending: true })
    .limit(1);

  if (error) {
    return { box: defaultBox, error: error.message };
  }

  const row = (data?.[0] as UserBoxRow | undefined) ?? null;

  if (!row) {
    return { box: defaultBox, error: null };
  }

  const { data: latestStorey } = await supabase
    .from('memories')
    .select('recorded_at')
    .eq('box_id', row.id)
    .order('recorded_at', { ascending: false })
    .limit(1);

  return {
    box: toStoreyBox(row, latestStorey?.[0]?.recorded_at ?? null),
    error: null,
  };
}

function toStoreyBox(row: UserBoxRow, lastStoreyAt: string | null): StoreyBox {
  const state = deriveBoxState(row);

  return {
    connection: state === 'unpaired' ? 'unknown' : state === 'offline' ? 'offline' : 'wifi',
    id: row.id,
    lastStoreyAt,
    lastSync: row.last_heartbeat_at,
    location: row.location,
    name: row.name,
    notifications: defaultBox.notifications,
    state,
  };
}

// The app treats a stale heartbeat as offline even if the last reported
// cloud_state was idle, per the hardware contract.
function deriveBoxState(row: UserBoxRow): BoxState {
  if (row.lifecycle_status !== 'paired') {
    return 'unpaired';
  }

  if (!row.last_heartbeat_at) {
    return 'offline';
  }

  const heartbeatAgeMs = Date.now() - new Date(row.last_heartbeat_at).getTime();

  if (Number.isNaN(heartbeatAgeMs) || heartbeatAgeMs > OFFLINE_AFTER_SECONDS * 1000) {
    return 'offline';
  }

  return HARDWARE_TO_CURRENT_BOX_STATE[row.cloud_state] ?? 'ready';
}
