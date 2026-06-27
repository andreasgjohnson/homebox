import { type Href, useRouter } from 'expo-router';
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
  PrimaryButton,
  SoftGlow,
  StepProgress,
  StoreyboxAuthWordmark,
} from '@/components/AuthFlowComponents';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';

export default function OnboardingScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWaitingForEmail, setIsWaitingForEmail] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const stepTag = isWaitingForEmail ? 'CHECK YOUR EMAIL' : 'SO YOU CAN RETURN';

  function goBack() {
    setMessage(null);

    if (isWaitingForEmail) {
      setIsWaitingForEmail(false);
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
    await finishAccountStep();
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

    setIsWaitingForEmail(true);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={goBack} style={[styles.backButton, !isWaitingForEmail && styles.hiddenBack]}>
            <BackChevron />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <StoreyboxAuthWordmark />
          <Text style={styles.stepTag}>{stepTag}</Text>
        </View>
        <StepProgress step={isWaitingForEmail ? 2 : 1} />
      </View>

      <ScrollView contentContainerStyle={styles.contentScroll} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          {!isWaitingForEmail ? (
            <View>
              <Text style={styles.eyebrow}>SO YOU CAN RETURN</Text>
              <Text style={styles.title}>Where should we keep your box?</Text>
              <Text style={styles.body}>
                This email is how you sign back in — the one thing that's truly your key. Once you
                verify it, your hello can become the first private memory in your archive.
              </Text>

              <View style={styles.emailBlock}>
                <HairlineEmailField email={email} onChangeText={setEmail} />
              </View>
            </View>
          ) : null}

          {isWaitingForEmail ? (
            <View style={styles.confirm}>
              <SoftGlow style={styles.confirmGlow} />
              <Text style={styles.eyebrow}>WAITING FOR EMAIL</Text>
              <Text style={styles.confirmTitle}>Your private link is on its way.</Text>
              <Text style={styles.confirmBody}>
                Open the link from this browser. Once Supabase confirms it is you, Storeybox will
                prepare your archive and bring you in automatically.
              </Text>

              <View style={styles.waitingCard}>
                <Text style={styles.waitingCardTitle}>{email.trim().toLowerCase()}</Text>
                <Text style={styles.waitingCardText}>
                  Nothing has been uploaded yet. Your recording stays local until sign-in succeeds.
                </Text>
              </View>

              <Text style={styles.confirmFoot}>NOTHING IS SHARED · YOUR STORY STAYS YOURS</Text>
            </View>
          ) : null}

          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          disabled={isWaitingForEmail || isSubmitting}
          onPress={skip}
          style={isWaitingForEmail && styles.hiddenBack}
        >
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
        <PrimaryButton disabled={isWaitingForEmail} isLoading={isSubmitting} onPress={() => void next()}>
          {isWaitingForEmail ? 'Link sent' : 'Send private link'}
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
  waitingCard: {
    backgroundColor: colors.surfaceWarm,
    borderColor: '#e8e1d2',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 30,
    paddingHorizontal: 24,
    paddingVertical: 22,
    width: '100%',
  },
  waitingCardTitle: {
    color: colors.ink,
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 18,
  },
  waitingCardText: {
    color: '#8a939e',
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 19.5,
    marginTop: 8,
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
