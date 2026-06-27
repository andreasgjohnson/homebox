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
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [usePasskey, setUsePasskey] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const cleanEmail = email.trim().toLowerCase();
  const stepTag = step === 1 ? 'SO YOU CAN RETURN' : 'READY';

  function goBack() {
    setMessage(null);

    if (step === 2) {
      setStep(1);
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

    if (step === 2) {
      setMessage('Open the private link from your email to enter Storeybox.');
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      setMessage('Add a valid email so your box is always yours to find.');
      return;
    }

    setIsSubmitting(true);

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
          <Pressable onPress={goBack} style={styles.backButton}>
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
              <Text style={styles.eyebrow}>SO YOU CAN RETURN</Text>
              <Text style={styles.title}>Where should we keep your box?</Text>
              <Text style={styles.body}>
                Your email is the private key back in. Face ID can make returning quieter on this
                device, but the email link stays in charge.
              </Text>

              <View style={styles.emailBlock}>
                <HairlineEmailField email={email} onChangeText={setEmail} />
              </View>

              <View style={styles.passkeyRow}>
                <View style={styles.passkeyText}>
                  <Text style={styles.passkeyTitle}>Face ID unlock</Text>
                  <Text style={styles.passkeyBody}>Use this device to open Storeybox faster.</Text>
                </View>
                <PasskeyToggle enabled={usePasskey} onToggle={() => setUsePasskey((current) => !current)} />
              </View>
            </View>
          ) : (
            <View style={styles.confirm}>
              <SoftGlow style={styles.confirmGlow} />
              <Text style={styles.eyebrow}>YOUR BOX IS READY</Text>
              <Text style={styles.confirmTitle}>Two quiet things, doing two different jobs.</Text>
              <Text style={styles.confirmBody}>
                We sent your private link. Open it from your email when you are ready to enter your
                Storeybox.
              </Text>

              <View style={styles.recapList}>
                <RecapCard badge="@" title="Email">
                  {cleanEmail || 'You can add one later from settings.'}
                </RecapCard>
                <RecapCard badge={usePasskey ? 'ON' : 'OFF'} badgeMuted={!usePasskey} title="Face ID unlock">
                  {usePasskey ? 'Ready on this device after sign-in.' : 'Skipped for now.'}
                </RecapCard>
              </View>

              <Text style={styles.confirmFoot}>NOTHING IS SHARED · YOUR STORY STAYS YOURS</Text>
            </View>
          )}

          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable disabled={step === 2 || isSubmitting} onPress={skip} style={step === 2 && styles.hiddenBack}>
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
        <PrimaryButton isLoading={isSubmitting} onPress={() => void next()}>
          {step === 1 ? 'Send private link' : 'Enter Storeybox'}
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
  passkeyRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: '#e8e1d2',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 18,
    justifyContent: 'space-between',
    marginTop: 26,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  passkeyText: {
    flex: 1,
  },
  passkeyTitle: {
    color: colors.ink,
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 18,
  },
  passkeyBody: {
    color: '#8a939e',
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    marginTop: 4,
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
  recapList: {
    gap: 12,
    marginTop: 30,
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
