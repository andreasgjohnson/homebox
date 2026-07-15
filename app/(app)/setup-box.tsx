import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BoxIllustration } from '@/components/BoxHardware';
import { StoreyboxWordmark } from '@/components/DaybookChrome';
import { Icon } from '@/components/Icon';
import {
  type BoxPairingInfo,
  type BoxWifiNetwork,
  classifySetupFailure,
  connectToBox,
  disconnectFromBox,
  fetchBoxPairingInfo,
  findSetupBoxNames,
  listBoxNetworks,
  provisionBox,
} from '@/lib/boxSetup';
import { colors, fonts } from '@/lib/theme';

type SetupStep = 'find' | 'networks' | 'password' | 'joining' | 'pairing' | 'joined';

export default function SetupBoxScreen() {
  const router = useRouter();
  const [step, setStep] = useState<SetupStep>('find');
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [networks, setNetworks] = useState<BoxWifiNetwork[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<BoxWifiNetwork | null>(null);
  const [password, setPassword] = useState('');
  const [pairingInfo, setPairingInfo] = useState<BoxPairingInfo | null>(null);

  useEffect(() => () => disconnectFromBox(), []);

  const findBox = useCallback(async () => {
    setIsBusy(true);
    setNotice(null);

    try {
      const names = await findSetupBoxNames();

      if (names.length === 0) {
        setNotice(
          'No Box found nearby. Make sure it is plugged in and its ring is breathing blue, then try again.',
        );
        return;
      }

      await connectToBox(names[0]);
      setNetworks(await listBoxNetworks());
      setStep('networks');
    } catch {
      setNotice(
        'Your Box could not be reached over Bluetooth. Keep your phone close to the Box and try again.',
      );
    } finally {
      setIsBusy(false);
    }
  }, []);

  const rescanNetworks = useCallback(async () => {
    setIsBusy(true);
    setNotice(null);

    try {
      setNetworks(await listBoxNetworks());
    } catch {
      setNotice('The network list did not refresh. Try again.');
    } finally {
      setIsBusy(false);
    }
  }, []);

  function chooseNetwork(network: BoxWifiNetwork) {
    setSelectedNetwork(network);
    setPassword('');
    setNotice(null);

    if (network.requiresPassword) {
      setStep('password');
    } else {
      void joinNetwork(network, '');
    }
  }

  async function joinNetwork(network: BoxWifiNetwork, passphrase: string) {
    setStep('joining');
    setNotice(null);

    try {
      await provisionBox(network.ssid, passphrase);
    } catch (error) {
      const kind = classifySetupFailure(error);

      if (kind === 'wrong-password') {
        setNotice('That password did not work. Check it and try again.');
        setStep('password');
      } else if (kind === 'network-not-found') {
        setNotice(
          'Your Box could not find that network. Move the Box closer to your router, or choose another network.',
        );
        setStep('networks');
      } else {
        setNotice('Setup did not complete. Try again, or start over if it keeps happening.');
        setStep(network.requiresPassword ? 'password' : 'networks');
      }
      return;
    }

    // The Box holds the Bluetooth session open after joining so it can hand
    // its pairing code to this phone. Collect it before disconnecting; if it
    // never arrives, the manual code-entry path on pair-box still works.
    setStep('pairing');
    const info = await fetchBoxPairingInfo();
    disconnectFromBox();
    setPairingInfo(info);
    setStep('joined');
  }

  function startOver() {
    disconnectFromBox();
    setNetworks([]);
    setSelectedNetwork(null);
    setPassword('');
    setPairingInfo(null);
    setNotice(null);
    setStep('find');
  }

  function continueToPairing() {
    if (pairingInfo) {
      router.replace({
        pathname: '/pair-box',
        params: {
          code: pairingInfo.code,
          ...(pairingInfo.nonce ? { nonce: pairingInfo.nonce } : {}),
        },
      } as Href);
      return;
    }

    router.replace('/pair-box' as Href);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.topBar}>
          <Pressable
            accessibilityLabel="Back to Your Box"
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => router.replace('/your-box' as Href)}
            style={styles.backLink}
          >
            <Icon color={colors.muted} fallbackGlyph="‹" name="chevron.left" size={15} />
            <Text style={styles.backText}>Your Box</Text>
          </Pressable>
          <StoreyboxWordmark />
          <Text style={styles.privateLabel}>PRIVATE</Text>
        </View>

        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.boxStage}>
            <View style={styles.glow} />
            <BoxIllustration size={104} ledColor={step === 'joined' ? '#5B7895' : '#46627E'} />
          </View>

          {step === 'find' ? (
            <>
              <Text style={styles.title}>Bring your Box online.</Text>
              <Text style={styles.body}>
                Plug in your Box. When its ring breathes a soft blue, it is ready to meet your
                home Wi-Fi.
              </Text>

              {notice ? <Notice message={notice} /> : null}

              <PrimaryButton
                busy={isBusy}
                label="Find my Box"
                onPress={() => void findBox()}
              />
              <Text style={styles.helper}>
                Keep your phone near the Box. Setup happens over Bluetooth; nothing leaves the
                room.
              </Text>
            </>
          ) : null}

          {step === 'networks' ? (
            <>
              <Text style={styles.title}>Choose your home network.</Text>
              <Text style={styles.body}>Your Box found these networks from where it sits.</Text>

              {notice ? <Notice message={notice} /> : null}

              <View style={styles.networkList}>
                {networks.length === 0 && !isBusy ? (
                  <Text style={styles.emptyText}>
                    No networks in reach. Move the Box closer to your router and scan again.
                  </Text>
                ) : null}
                {networks.map((network) => (
                  <Pressable
                    accessibilityLabel={`Join ${network.ssid}`}
                    accessibilityRole="button"
                    disabled={isBusy}
                    key={network.ssid}
                    onPress={() => chooseNetwork(network)}
                    style={({ pressed }) => [styles.networkRow, pressed && styles.pressed]}
                  >
                    <Text numberOfLines={1} style={styles.networkName}>
                      {network.ssid}
                    </Text>
                    <View style={styles.networkMeta}>
                      {network.requiresPassword ? (
                        <Icon color={colors.faint} fallbackGlyph="●" name="lock.fill" size={12} />
                      ) : null}
                      <SignalDots rssi={network.rssi} />
                    </View>
                  </Pressable>
                ))}
              </View>

              <Pressable
                accessibilityLabel="Scan for networks again"
                accessibilityRole="button"
                disabled={isBusy}
                onPress={() => void rescanNetworks()}
                style={styles.linkButton}
              >
                {isBusy ? (
                  <ActivityIndicator color={colors.muted} size="small" />
                ) : (
                  <Text style={styles.linkText}>Scan again</Text>
                )}
              </Pressable>
            </>
          ) : null}

          {step === 'password' && selectedNetwork ? (
            <>
              <Text style={styles.title}>Join {selectedNetwork.ssid}.</Text>
              <Text style={styles.body}>
                Enter the Wi-Fi password. It travels straight to your Box over an encrypted
                Bluetooth link and stays there.
              </Text>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>WI-FI PASSWORD</Text>
                <TextInput
                  accessibilityLabel="Wi-Fi password"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  onChangeText={setPassword}
                  onSubmitEditing={() => {
                    if (password.length > 0) {
                      void joinNetwork(selectedNetwork, password);
                    }
                  }}
                  placeholder="password"
                  placeholderTextColor={colors.faint}
                  returnKeyType="join"
                  secureTextEntry
                  style={styles.passwordInput}
                  value={password}
                />
              </View>

              {notice ? <Notice message={notice} /> : null}

              <PrimaryButton
                busy={false}
                disabled={password.length === 0}
                label="Connect my Box"
                onPress={() => void joinNetwork(selectedNetwork, password)}
              />
              <Pressable
                accessibilityLabel="Choose a different network"
                accessibilityRole="button"
                onPress={() => {
                  setNotice(null);
                  setStep('networks');
                }}
                style={styles.linkButton}
              >
                <Text style={styles.linkText}>Choose a different network</Text>
              </Pressable>
            </>
          ) : null}

          {step === 'joining' && selectedNetwork ? (
            <>
              <Text style={styles.title}>Introducing your Box to {selectedNetwork.ssid}…</Text>
              <Text style={styles.body}>
                This usually takes a few moments. The Box will remember this network from now
                on.
              </Text>
              <ActivityIndicator color={colors.ink} style={styles.joiningSpinner} />
            </>
          ) : null}

          {step === 'pairing' ? (
            <>
              <Text style={styles.title}>Your Box is online.</Text>
              <Text style={styles.body}>
                One moment more — it is fetching a pairing code to hand to this phone.
              </Text>
              <ActivityIndicator color={colors.ink} style={styles.joiningSpinner} />
            </>
          ) : null}

          {step === 'joined' ? (
            <>
              <Text style={styles.title}>
                {pairingInfo ? 'Ready to pair.' : 'Your Box is online.'}
              </Text>
              <Text style={styles.body}>
                {pairingInfo
                  ? 'Your Box handed its pairing code to this phone. One more step brings it into your archive.'
                  : 'When the ring settles into a gentle amber, your Box is ready to be paired with your archive.'}
              </Text>

              <PrimaryButton busy={false} label="Continue to pairing" onPress={continueToPairing} />
            </>
          ) : null}

          {step !== 'find' && step !== 'joined' && step !== 'pairing' ? (
            <Pressable
              accessibilityLabel="Start setup over"
              accessibilityRole="button"
              onPress={startOver}
              style={styles.linkButton}
            >
              <Text style={styles.startOverText}>Start over</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Notice({ message }: { message: string }) {
  return (
    <View style={styles.notice}>
      <Text style={styles.noticeText}>{message}</Text>
    </View>
  );
}

function PrimaryButton({
  busy,
  disabled,
  label,
  onPress,
}: {
  busy: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  const blocked = busy || disabled;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked }}
      disabled={blocked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={colors.background} />
      ) : (
        <Text style={styles.primaryButtonText}>{label}</Text>
      )}
    </Pressable>
  );
}

// Rough RSSI buckets: above -55 dBm is a strong signal, below -75 is weak.
function SignalDots({ rssi }: { rssi: number }) {
  const level = rssi > -55 ? 3 : rssi > -75 ? 2 : 1;

  return (
    <View style={styles.signalDots}>
      {[1, 2, 3].map((dot) => (
        <View
          key={dot}
          style={[styles.signalDot, dot <= level && styles.signalDotActive]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  topBar: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
  backLink: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minHeight: 44,
    minWidth: 86,
  },
  backText: {
    color: colors.muted,
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    fontWeight: '500',
  },
  privateLabel: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    minWidth: 86,
    textAlign: 'right',
  },
  container: {
    alignItems: 'center',
    alignSelf: 'center',
    maxWidth: 440,
    paddingBottom: 60,
    paddingHorizontal: 28,
    width: '100%',
  },
  boxStage: {
    alignItems: 'center',
    height: 132,
    justifyContent: 'center',
    marginTop: 30,
    position: 'relative',
    width: 168,
  },
  glow: {
    backgroundColor: '#BCD2E6',
    borderRadius: 84,
    height: 168,
    opacity: 0.28,
    position: 'absolute',
    width: 168,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.serifLight,
    fontSize: 34,
    fontWeight: '300',
    lineHeight: 38,
    marginTop: 18,
    textAlign: 'center',
  },
  body: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 23,
    marginTop: 12,
    maxWidth: 320,
    textAlign: 'center',
  },
  networkList: {
    alignSelf: 'stretch',
    backgroundColor: colors.surfaceWarm,
    borderColor: '#DDE4EA',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 28,
    overflow: 'hidden',
  },
  networkRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  networkName: {
    color: colors.ink,
    flexShrink: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    fontWeight: '500',
    paddingRight: 12,
  },
  networkMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  signalDots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  signalDot: {
    backgroundColor: colors.border,
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  signalDotActive: {
    backgroundColor: colors.blue,
  },
  emptyText: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    padding: 18,
    textAlign: 'center',
  },
  field: {
    alignSelf: 'stretch',
    marginTop: 28,
  },
  fieldLabel: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 1.8,
    lineHeight: 14,
    marginBottom: 12,
  },
  passwordInput: {
    borderBottomColor: colors.blueLine,
    borderBottomWidth: 1.5,
    color: colors.ink,
    fontFamily: fonts.sans,
    fontSize: 19,
    paddingBottom: 10,
  },
  notice: {
    alignSelf: 'stretch',
    backgroundColor: colors.dangerSurface,
    borderColor: colors.dangerBorder,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 24,
    padding: 14,
  },
  noticeText: {
    color: colors.danger,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.ink,
    borderRadius: 14,
    justifyContent: 'center',
    marginTop: 30,
    minHeight: 52,
    paddingHorizontal: 22,
  },
  primaryButtonText: {
    color: colors.background,
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    fontWeight: '600',
  },
  linkButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 44,
  },
  linkText: {
    color: colors.blueDark,
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    fontWeight: '500',
  },
  startOverText: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 13,
  },
  helper: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    marginTop: 14,
    textAlign: 'center',
  },
  joiningSpinner: {
    marginTop: 34,
  },
  disabled: {
    opacity: 0.48,
  },
  pressed: {
    opacity: 0.72,
  },
});
