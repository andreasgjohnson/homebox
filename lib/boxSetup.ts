import {
  ESPDevice,
  ESPProvisionManager,
  ESPSecurity,
  ESPTransport,
  ESPWifiAuthMode,
} from '@orbital-systems/react-native-esp-idf-provisioning';

// Wi-Fi setup talks to the Box over BLE using ESP unified provisioning.
// These mirror SB_PROV_SERVICE_PREFIX and SB_PROV_POP in the firmware's
// sb_config.h. The shared proof of possession is a dev arrangement;
// production boxes should carry a per-device PoP printed on the unit.
export const BOX_BLE_PREFIX = 'STOREYBOX';
const BOX_PROOF_OF_POSSESSION = 'storeybox';

export type BoxWifiNetwork = {
  ssid: string;
  rssi: number;
  requiresPassword: boolean;
};

export type SetupFailureKind = 'wrong-password' | 'network-not-found' | 'unknown';

let connectedBox: ESPDevice | null = null;

export async function findSetupBoxNames(): Promise<string[]> {
  const devices = await ESPProvisionManager.searchESPDevices(
    BOX_BLE_PREFIX,
    ESPTransport.ble,
    ESPSecurity.secure,
  );

  return devices.map((device) => device.name);
}

export async function connectToBox(name: string): Promise<void> {
  disconnectFromBox();

  const device = new ESPDevice({
    name,
    transport: ESPTransport.ble,
    security: ESPSecurity.secure,
  });

  await device.connect(BOX_PROOF_OF_POSSESSION);
  connectedBox = device;
}

export async function listBoxNetworks(): Promise<BoxWifiNetwork[]> {
  if (!connectedBox) {
    throw new Error('No Box connected.');
  }

  const found = await connectedBox.scanWifiList();
  const strongestBySsid = new Map<string, BoxWifiNetwork>();

  for (const network of found) {
    if (!network.ssid) {
      continue;
    }

    const existing = strongestBySsid.get(network.ssid);
    if (!existing || network.rssi > existing.rssi) {
      strongestBySsid.set(network.ssid, {
        ssid: network.ssid,
        rssi: network.rssi,
        requiresPassword: network.auth !== ESPWifiAuthMode.open,
      });
    }
  }

  return [...strongestBySsid.values()].sort((a, b) => b.rssi - a.rssi);
}

export async function provisionBox(ssid: string, password: string): Promise<void> {
  if (!connectedBox) {
    throw new Error('No Box connected.');
  }

  await connectedBox.provision(ssid, password);
}

export function disconnectFromBox(): void {
  try {
    connectedBox?.disconnect();
  } catch {
    // The session may already be gone; nothing to clean up.
  }
  connectedBox = null;
}

// The native SDKs surface join failures as rejected promises whose messages
// vary by platform, so classification is best-effort; every path in the
// setup flow still offers a retry.
export function classifySetupFailure(error: unknown): SetupFailureKind {
  const message = error instanceof Error ? error.message : String(error);

  if (/auth|password|credential/i.test(message)) {
    return 'wrong-password';
  }

  if (/not.?found|no ap|ssid|network/i.test(message)) {
    return 'network-not-found';
  }

  return 'unknown';
}
