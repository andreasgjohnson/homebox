import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import {
  BackChevron,
  HairlineEmailField,
  makeWave,
  OnboardingVoiceRecorder,
  PasskeyToggle,
  PrimaryButton,
  RecapCard,
  SoftGlow,
  StepProgress,
  StoreyboxAuthWordmark,
  Waveform,
} from '@/components/AuthFlowComponents';
import { colors, fonts } from '@/lib/theme';

export default function OnboardingScreen() {
  const router = useRouter();
  const { step: stepParam } = useLocalSearchParams<{ step?: string }>();
  const [step, setStep] = useState(() => (stepParam === '2' ? 2 : 1));
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecorded, setHasRecorded] = useState(false);
  const [isPasskeyEnabled, setIsPasskeyEnabled] = useState(true);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const stepTag = step === 1 ? 'YOUR VOICE' : step === 2 ? 'YOUR ACCOUNT' : 'ALL SET';

  async function toggleVoiceRecording() {
    if (isRecording) {
      setIsRecording(false);
      setHasRecorded(true);
      return;
    }

    const granted = await requestMicrophonePermission();

    if (!granted) {
      setMessage('Microphone permission is optional. You can skip this step and continue.');
      return;
    }

    setMessage(null);
    setIsRecording(true);
  }

  function goBack() {
    setMessage(null);
    setIsRecording(false);

    if (step > 1) {
      setStep(step - 1);
      return;
    }

    router.replace('/' as Href);
  }

  function skip() {
    setMessage(null);
    setIsRecording(false);
    setStep(Math.min(step + 1, 3));
  }

  function next() {
    setMessage(null);
    setIsRecording(false);

    if (step === 2 && !isValidEmail(email.trim())) {
      setMessage('Add a valid email so your box is always yours to find.');
      return;
    }

    if (step < 3) {
      setStep(step + 1);
      return;
    }

    router.replace('/' as Href);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={goBack}
            style={[styles.backButton, step === 1 && styles.hiddenBack]}
          >
            <BackChevron />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <StoreyboxAuthWordmark />
          <Text style={styles.stepTag}>{stepTag}</Text>
        </View>
        <StepProgress step={step} />
      </View>

      <ScrollView contentContainerStyle={styles.contentScroll} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          {step === 1 ? (
            <View>
              <Text style={styles.eyebrow}>STEP 1 OF 3 · YOUR VOICE</Text>
              <Text style={styles.title}>Read this once, and Storeybox learns your voice.</Text>
              <Text style={styles.body}>
                A short sample teaches Storeybox to recognise{' '}
                <Text style={styles.bodyItalic}>you</Text> — never to log you in. Skip it and the
                app still works; it just sounds a little more generic.
              </Text>

              <View style={styles.passageCard}>
                <Text style={styles.passageText}>
                  “The things I want to keep aren't loud. They're a quiet kitchen, a long drive,
                  the way someone said my name.”
                </Text>
              </View>

              <View style={styles.voiceSample}>
                <Waveform bars={makeWave(56, 21, 34)} color="#a8bccd" height={42} />
                <OnboardingVoiceRecorder
                  isRecording={isRecording}
                  label={isRecording ? 'Recording… tap to stop' : hasRecorded ? 'Read again' : 'Read aloud'}
                  onToggleRecording={() => void toggleVoiceRecording()}
                />
              </View>

              <View style={styles.benefits}>
                <Benefit color="#6b8198">Knows it's you when other voices share a recording.</Benefit>
                <Benefit color="#b08f8c">Writes summaries in your cadence — not a template.</Benefit>
                <Benefit color="#b88a4e">Recognises the people you mention by name.</Benefit>
              </View>

              <Text style={styles.consent}>STORED PRIVATELY ON YOUR DEVICE · YOURS TO DELETE ANYTIME</Text>
            </View>
          ) : null}

          {step === 2 ? (
            <View>
              <Text style={styles.eyebrow}>STEP 2 OF 3 · SO YOU CAN RETURN</Text>
              <Text style={styles.title}>Where should we keep your box?</Text>
              <Text style={styles.body}>
                This email is how you sign back in — the one thing that's truly your key. We'll
                only ever use it to send you a private link.
              </Text>

              <View style={styles.emailBlock}>
                <HairlineEmailField email={email} onChangeText={setEmail} />
              </View>

              <View style={styles.passkeyCard}>
                <View style={styles.passkeyRow}>
                  <View style={styles.passkeyCopyRow}>
                    <View style={styles.faceGlyph}>
                      <Text style={styles.faceGlyphText}>⌗</Text>
                    </View>
                    <View style={styles.passkeyTextWrap}>
                      <Text style={styles.passkeyTitle}>Instant unlock on this device</Text>
                      <Text style={styles.passkeySub}>
                        Use Face ID or a passkey to skip the link next time.
                      </Text>
                    </View>
                  </View>
                  <PasskeyToggle
                    enabled={isPasskeyEnabled}
                    onToggle={() => setIsPasskeyEnabled((current) => !current)}
                  />
                </View>
              </View>
              <Text style={styles.caption}>
                Face ID is only a shortcut on this device — turn it off and your email always gets
                you back in.
              </Text>
            </View>
          ) : null}

          {step === 3 ? (
            <View style={styles.confirm}>
              <SoftGlow style={styles.confirmGlow} />
              <Text style={styles.eyebrow}>STEP 3 OF 3 · YOU'RE SET</Text>
              <Text style={styles.confirmTitle}>Your box is ready.</Text>
              <Text style={styles.confirmBody}>Three quiet things, doing three different jobs.</Text>

              <View style={styles.recapStack}>
                <RecapCard badge="✓" title={`Email — ${email.trim() || 'add later'}`}>
                  How you sign back in, anywhere.
                </RecapCard>
                <RecapCard badge="✓" title={hasRecorded ? 'Voice profile — learning' : 'Voice profile — skipped'}>
                  Helps Storeybox sound like you. Not a login.
                </RecapCard>
                <RecapCard
                  badge={isPasskeyEnabled ? '✓' : '—'}
                  badgeMuted={!isPasskeyEnabled}
                  title={`Face ID unlock — ${isPasskeyEnabled ? 'On' : 'Off'}`}
                >
                  {isPasskeyEnabled
                    ? 'A shortcut on this device only — turn off anytime.'
                    : "You'll use your email link to return."}
                </RecapCard>
              </View>

              <Text style={styles.confirmFoot}>NOTHING IS SHARED · YOUR STORY STAYS YOURS</Text>
            </View>
          ) : null}

          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable disabled={step === 3} onPress={skip} style={step === 3 && styles.hiddenBack}>
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
        <PrimaryButton onPress={next}>{step === 3 ? 'Enter Storeybox' : 'Continue'}</PrimaryButton>
      </View>
    </View>
  );
}

function Benefit({ children, color }: { children: string; color: string }) {
  return (
    <View style={styles.benefit}>
      <View style={[styles.benefitDot, { backgroundColor: color }]} />
      <Text style={styles.benefitText}>{children}</Text>
    </View>
  );
}

async function requestMicrophonePermission() {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') {
    return true;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch {
    return false;
  }
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    paddingBottom: 56,
    paddingHorizontal: 28,
    paddingTop: 40,
  },
  header: {
    maxWidth: 600,
    width: '100%',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  backButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minWidth: 84,
  },
  hiddenBack: {
    opacity: 0,
    pointerEvents: 'none',
  } as ViewStyle,
  backText: {
    color: '#5a6470',
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '500',
  },
  stepTag: {
    color: '#a6a092',
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 1.32,
    lineHeight: 11,
    minWidth: 84,
    textAlign: 'right',
  },
  contentScroll: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 36,
    width: '100%',
  },
  content: {
    maxWidth: 560,
    width: '100%',
  },
  eyebrow: {
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 2.2,
    lineHeight: 11,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 35,
    fontWeight: '300',
    letterSpacing: -0.35,
    lineHeight: 40.6,
    marginTop: 16,
  },
  body: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 23.25,
    marginTop: 14,
  },
  bodyItalic: {
    fontFamily: fonts.serif,
    fontStyle: 'italic',
  },
  passageCard: {
    backgroundColor: '#eaf1f7',
    backgroundImage: 'linear-gradient(180deg,#eaf1f7,#eef3f7)',
    borderColor: '#dde8f0',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 26,
    paddingHorizontal: 30,
    paddingVertical: 26,
  } as ViewStyle,
  passageText: {
    color: '#3a4a58',
    fontFamily: fonts.serif,
    fontSize: 22,
    fontStyle: 'italic',
    fontWeight: '400',
    lineHeight: 34.1,
  },
  voiceSample: {
    alignItems: 'center',
    marginTop: 26,
  },
  benefits: {
    gap: 12,
    marginTop: 30,
  },
  benefit: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  benefitDot: {
    borderRadius: 3.5,
    height: 7,
    marginTop: 7,
    width: 7,
  },
  benefitText: {
    color: '#33302a',
    flex: 1,
    fontFamily: fonts.serif,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 21.75,
  },
  consent: {
    color: '#b0a894',
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 0.66,
    lineHeight: 11,
    marginTop: 24,
  },
  emailBlock: {
    marginTop: 30,
  },
  passkeyCard: {
    backgroundColor: colors.surfaceWarm,
    borderColor: '#e8e1d2',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 30,
    paddingHorizontal: 24,
    paddingVertical: 22,
  },
  passkeyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
    justifyContent: 'space-between',
  },
  passkeyCopyRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 13,
  },
  faceGlyph: {
    alignItems: 'center',
    backgroundColor: '#eef2f5',
    borderRadius: 11,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  faceGlyphText: {
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 18,
    fontWeight: '400',
  },
  passkeyTextWrap: {
    flex: 1,
  },
  passkeyTitle: {
    color: colors.ink,
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 18,
  },
  passkeySub: {
    color: '#8a939e',
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 17.55,
    marginTop: 3,
  },
  caption: {
    color: '#8a939e',
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 19.5,
    marginHorizontal: 2,
    marginTop: 16,
  },
  confirm: {
    alignItems: 'center',
    position: 'relative',
  },
  confirmGlow: {
    left: '50%',
    top: 34,
    transform: [{ translateX: -190 }, { translateY: -100 }],
  },
  confirmTitle: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 40,
    fontWeight: '300',
    letterSpacing: -0.4,
    lineHeight: 44.8,
    marginTop: 16,
    position: 'relative',
    textAlign: 'center',
  },
  confirmBody: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24.8,
    marginTop: 14,
    position: 'relative',
    textAlign: 'center',
  },
  recapStack: {
    gap: 14,
    marginTop: 34,
    width: '100%',
  },
  confirmFoot: {
    color: '#b0a894',
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 0.78,
    lineHeight: 13,
    marginTop: 30,
    position: 'relative',
    textAlign: 'center',
  },
  message: {
    color: colors.danger,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19.5,
    marginTop: 18,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    maxWidth: 560,
    width: '100%',
  },
  skipText: {
    color: '#8a939e',
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '500',
  },
});
