export type BoxState = 'ready' | 'recording' | 'syncing' | 'processing' | 'offline';

export type StoreyBox = {
  connection: 'wifi' | 'offline';
  id: string;
  lastStoreyAt: string;
  lastSync: string;
  location: string;
  name: string;
  notifications: {
    newStorey: boolean;
    prompt: boolean;
    storeyReady: boolean;
  };
  state: BoxState;
};

export const defaultBox: StoreyBox = {
  connection: 'wifi',
  id: 'bedside-box',
  lastStoreyAt: '2026-06-22T22:42:00.000Z',
  lastSync: '2026-06-22T22:44:00.000Z',
  location: 'Bedside',
  name: 'Bedside Box',
  notifications: {
    newStorey: true,
    prompt: false,
    storeyReady: true,
  },
  state: 'ready',
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
  ready: {
    cardTitle: 'Your Box is ready.',
    ledColor: '#3D5F7E',
    note: 'When something is worth keeping, press the button.',
    sub: (box) => `${box.location.toUpperCase()} · CONNECTED`,
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
