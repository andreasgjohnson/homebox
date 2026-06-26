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
  PasskeyToggle,
  PrimaryButton,
  RecapCard,
  SoftGlow,
  StepProgress,
  StoreyboxAuthWordmark,
} from '@/components/AuthFlowComponents';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';

export default function OnboardingScreen() {
  const router = useRouter();
  const { step: stepParam } = useLocalSearchParams<{ step?: string }>();
  const [step, setStep] = useState(() => (stepParam === '2' ? 2 : 1));
  const [isPasskeyEnabled, setIsPasskeyEnabled] = useState(true);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const stepTag = step === 1 ? 'SO YOU CAN RETURN' : "YOU'RE SET";

  function goBack() {
    setMessage(null);

    if (step > 1) {
      setStep(step - 1);
      return;
    }

    router.replace('/login' as Href);
  }

  function skip() {
    setMessage(null);
    setStep(2);
  }

  async function next() {
    setMessage(null);

    if (step === 1) {
      await finishAccountStep();
      return;
    }

    router.replace('/' as Href);
  }

  async function finishAccountStep() {
    const cleanEmail = email.trim().toLowerCase();

    if (!isValidEmail(cleanEmail)) {
      setMessage('Add a valid email so your box is always yours to find.');
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        emailRedirectTo: getRedirectTo('/'),
      },
    });

    setIsSubmitting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setStep(2);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={goBack} style={[styles.backButton, step === 1 && styles.hiddenBack]}>
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
              <Text style={styles.eyebrow}>STEP 1 OF 2 · SO YOU CAN RETURN</Text>
              <Text style={styles.title}>Where should we keep your box?</Text>
              <Text style={styles.body}>
                This email is how you sign back in — the one thing that's truly your key. Once you
                verify it, your archive is always yours to find.
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

          {step === 2 ? (
            <View style={styles.confirm}>
              <SoftGlow style={styles.confirmGlow} />
              <Text style={styles.eyebrow}>STEP 2 OF 2 · YOU'RE SET</Text>
              <Text style={styles.confirmTitle}>Your box is ready.</Text>
              <Text style={styles.confirmBody}>Two quiet things, doing two different jobs.</Text>

              <View style={styles.recapStack}>
                <RecapCard badge="✓" title={`Email — ${email.trim() || 'add later'}`}>
                  How you sign back in, anywhere.
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
        <Pressable disabled={step === 2 || isSubmitting} onPress={skip} style={step === 2 && styles.hiddenBack}>
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
        <PrimaryButton isLoading={isSubmitting} onPress={() => void next()}>
          {step === 2 ? 'Enter Storeybox' : 'Continue'}
        </PrimaryButton>
      </View>
    </View>
  );
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getRedirectTo(path: string) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return undefined;
  }

  return `${window.location.origin}${path}`;
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
    lineHeight: 14,
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
    lineHeight: 15,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 38,
    fontWeight: '300',
    letterSpacing: 0,
    lineHeight: 42.6,
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
    letterSpacing: 0,
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
    lineHeight: 17,
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
