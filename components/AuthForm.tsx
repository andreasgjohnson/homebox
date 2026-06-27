import { type Href, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';

import {
  HairlineEmailField,
  PrimaryButton,
  SoftGlow,
  SpeakToEnter,
  StoreyboxAuthWordmark,
} from '@/components/AuthFlowComponents';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';

type AuthFormProps = {
  mode?: 'login' | 'signup';
};

export function AuthForm({ mode = 'signup' }: AuthFormProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < 900;
  const isLogin = mode === 'login';
  const [isRecording, setIsRecording] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const stageStyle = useMemo(
    () => [styles.stage, isCompact && styles.stageCompact],
    [isCompact],
  );

  async function toggleVoiceRecording() {
    if (isRecording) {
      setIsRecording(false);
      return;
    }

    const granted = await requestMicrophonePermission();

    if (!granted) {
      setMessage('Microphone permission is optional. You can continue with email instead.');
      return;
    }

    setMessage(null);
    setIsRecording(true);
  }

  function continueToOnboarding() {
    router.push('/onboarding' as Href);
  }

  async function sendMagicLink() {
    const cleanEmail = email.trim();

    if (!isValidEmail(cleanEmail)) {
      setMessage('Enter a valid email so Storeybox can send your private link.');
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

    setMessage('Check your email for a private sign-in link.');
  }

  return (
    <View style={stageStyle}>
      {!isCompact ? (
        <View style={styles.brand}>
          <SoftGlow style={styles.brandGlow} />
          <View style={styles.brandWordmark}>
            <StoreyboxAuthWordmark />
          </View>
          <View style={styles.brandCopy}>
            <Text style={styles.brandTitle}>A place for the things worth keeping.</Text>
            <Text style={styles.brandBody}>
              Speak a memory. Storeybox keeps the audio, a clean transcript, a gentle summary, and
              a few quiet signals — then hands it back when you need it.
            </Text>
          </View>
          <View style={styles.brandFoot}>
            <Text style={styles.promise}>Nothing is shared. Your story stays yours.</Text>
            <Text style={styles.monoFoot}>PRIVATE BY DEFAULT · ENCRYPTED · DELETABLE ANYTIME</Text>
          </View>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={[styles.entryScroll, isCompact && styles.entryScrollCompact]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.entryInner}>
          {!isLogin ? (
            <View style={styles.newPanel}>
              <Text style={styles.newTitle}>There you are.{'\n'}I'm Storey.</Text>
              <Text style={styles.newBody}>
                Introduce yourself — your name, where you are, and what kind of day it's been.
                However you'd greet a friend you've missed.
              </Text>

              <SpeakToEnter
                isRecording={isRecording}
                onContinue={continueToOnboarding}
                onToggleRecording={() => void toggleVoiceRecording()}
              />

              <Pressable onPress={continueToOnboarding} style={styles.emailEntryLink}>
                <Text style={styles.emailEntryText}>
                  <Text style={styles.emailEntryMuted}>Prefer to type? </Text>
                  Use email
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.backPanel}>
              <View style={styles.backHead}>
                <Text style={styles.backTitle}>Welcome back.</Text>
                <Text style={styles.backBody}>
                  Enter your email and we'll send a private link that opens your box.
                </Text>
              </View>

              <View style={styles.backEmail}>
                <HairlineEmailField email={email} onChangeText={setEmail} />
              </View>

              <PrimaryButton
                disabled={!email.trim()}
                isLoading={isSubmitting}
                onPress={() => void sendMagicLink()}
              >
                Send me a private link
              </PrimaryButton>
              <Text style={styles.magicHint}>
                No passwords, ever. The link works once and quietly expires.
              </Text>
            </View>
          )}

          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>
      </ScrollView>
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

function getRedirectTo(path: string) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return undefined;
  }

  return `${window.location.origin}${path}`;
}

const styles = StyleSheet.create({
  stage: {
    backgroundColor: colors.background,
    flex: 1,
    flexDirection: 'row',
  },
  stageCompact: {
    flexDirection: 'column',
  },
  brand: {
    borderRightColor: colors.border,
    borderRightWidth: 1,
    flex: 1.05,
    justifyContent: 'space-between',
    overflow: 'hidden',
    paddingHorizontal: 76,
    paddingVertical: 64,
    position: 'relative',
  },
  brandGlow: {
    height: 480,
    left: '42%',
    top: '46%',
    transform: [{ translateX: -340 }, { translateY: -240 }],
    width: 680,
  },
  brandWordmark: {
    position: 'relative',
  },
  brandCopy: {
    maxWidth: 520,
    position: 'relative',
  },
  brandTitle: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 54,
    fontWeight: '300',
    letterSpacing: -0.81,
    lineHeight: 60.5,
  },
  brandBody: {
    color: '#5a6470',
    fontFamily: fonts.sans,
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 28.8,
    marginTop: 26,
    maxWidth: 460,
  },
  brandFoot: {
    position: 'relative',
  },
  promise: {
    color: '#3a4a58',
    fontFamily: fonts.serif,
    fontSize: 22,
    fontStyle: 'italic',
    fontWeight: '400',
    lineHeight: 30.8,
    marginBottom: 12,
    maxWidth: 440,
  },
  monoFoot: {
    color: '#a6a092',
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 1.98,
    lineHeight: 11,
  },
  entryScroll: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 72,
    paddingVertical: 64,
  },
  entryScrollCompact: {
    paddingHorizontal: 28,
    paddingVertical: 56,
  },
  entryInner: {
    maxWidth: 420,
    width: '100%',
  },
  newPanel: {
    alignItems: 'center',
  },
  eyebrow: {
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 2.86,
    lineHeight: 11,
  },
  newTitle: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 36,
    fontWeight: '300',
    lineHeight: 41.8,
    marginTop: 16,
    textAlign: 'center',
  },
  newBody: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 30,
    marginTop: 36,
    textAlign: 'center',
  },
  emailEntryLink: {
    marginTop: 30,
  },
  emailEntryText: {
    color: colors.blue,
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
  },
  emailEntryMuted: {
    color: '#9aa3ad',
    fontWeight: '600',
  },
  backPanel: {
    width: '100%',
  },
  backHead: {
    alignItems: 'center',
  },
  backTitle: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 40,
    fontWeight: '300',
    letterSpacing: -0.4,
    lineHeight: 44,
    textAlign: 'center',
  },
  backBody: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 23.25,
    marginTop: 14,
    textAlign: 'center',
  },
  backEmail: {
    marginTop: 36,
  },
  magicHint: {
    color: '#8a939e',
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 19.5,
    marginHorizontal: 2,
    marginTop: 16,
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
});
