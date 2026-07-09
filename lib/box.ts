export type BoxState = 'unpaired' | 'ready' | 'recording' | 'syncing' | 'processing' | 'offline';

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
