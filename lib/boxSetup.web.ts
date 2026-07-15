// Web build of the Box Wi-Fi setup helpers. Setup needs Bluetooth, which
// only the iPhone app has; these stubs keep the web bundle importable.

export const BOX_BLE_PREFIX = 'STOREYBOX';

export type BoxWifiNetwork = {
  ssid: string;
  rssi: number;
  requiresPassword: boolean;
};

export type SetupFailureKind = 'wrong-password' | 'network-not-found' | 'unknown';

export type BoxPairingInfo = {
  boxId: string | null;
  code: string;
  nonce: string | null;
  expiresAt: string | null;
};

const WEB_UNSUPPORTED = 'Box setup needs the Storeybox iPhone app.';

export async function findSetupBoxNames(): Promise<string[]> {
  throw new Error(WEB_UNSUPPORTED);
}

export async function connectToBox(_name: string): Promise<void> {
  throw new Error(WEB_UNSUPPORTED);
}

export async function listBoxNetworks(): Promise<BoxWifiNetwork[]> {
  throw new Error(WEB_UNSUPPORTED);
}

export async function provisionBox(_ssid: string, _password: string): Promise<void> {
  throw new Error(WEB_UNSUPPORTED);
}

export async function fetchBoxPairingInfo(): Promise<BoxPairingInfo | null> {
  return null;
}

export function disconnectFromBox(): void {}

export function classifySetupFailure(_error: unknown): SetupFailureKind {
  return 'unknown';
}
