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

export type BoxPairingInfo = {
  boxId: string | null;
  code: string;
  nonce: string | null;
  expiresAt: string | null;
};

// Mirrors SB_PROV_PAIR_ENDPOINT in the firmware's sb_config.h.
const PAIR_ENDPOINT = 'sb-pair';
const PAIR_POLL_INTERVAL_MS = 1500;
const PAIR_POLL_TIMEOUT_MS = 45000;

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

// After provision() succeeds the Box keeps the BLE session open just long
// enough to hand over the pairing code it fetches once online, so this must
// run before disconnectFromBox(). The Box answers "pending" until the code
// arrives from box-api. Returns null when the code cannot be delivered
// (older firmware, fetch failed on the Box, session closed) — the manual
// code-entry path in pair-box covers that.
export async function fetchBoxPairingInfo(): Promise<BoxPairingInfo | null> {
  if (!connectedBox) {
    return null;
  }

  const deadline = Date.now() + PAIR_POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    let raw: string;
    try {
      raw = await connectedBox.sendData(PAIR_ENDPOINT, 'status');
    } catch {
      return null;
    }

    const payload = parsePairPayload(raw);
    if (!payload || payload.status === 'error') {
      return null;
    }

    if (payload.status === 'ready') {
      if (!payload.code) {
        return null;
      }

      return {
        boxId: payload.boxId,
        code: payload.code,
        nonce: payload.nonce,
        expiresAt: payload.expiresAt,
      };
    }

    await sleep(PAIR_POLL_INTERVAL_MS);
  }

  return null;
}

export function disconnectFromBox(): void {
  try {
    connectedBox?.disconnect();
  } catch {
    // The session may already be gone; nothing to clean up.
  }
  connectedBox = null;
}

function parsePairPayload(raw: string): {
  status: string;
  code: string | null;
  boxId: string | null;
  nonce: string | null;
  expiresAt: string | null;
} | null {
  let data: unknown;
  try {
    // The firmware may pad the BLE response with trailing NULs.
    data = JSON.parse(raw.replace(/\0+$/, '').trim());
  } catch {
    return null;
  }

  if (typeof data !== 'object' || data === null) {
    return null;
  }

  const record = data as Record<string, unknown>;
  const uri = typeof record.pairing_uri === 'string' ? record.pairing_uri : null;
  const nonceMatch = uri ? /[?&]nonce=([^&]+)/.exec(uri) : null;

  return {
    status: typeof record.status === 'string' ? record.status : '',
    code:
      typeof record.pairing_code === 'string' && /^\d{6}$/.test(record.pairing_code)
        ? record.pairing_code
        : null,
    boxId: typeof record.box_id === 'string' ? record.box_id : null,
    nonce: nonceMatch ? nonceMatch[1] : null,
    expiresAt: typeof record.expires_at === 'string' ? record.expires_at : null,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
