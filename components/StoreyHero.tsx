import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BoxIllustration } from '@/components/BoxHardware';
import { getAuthRedirectUrl } from '@/lib/authRedirect';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';

export function StoreyHero() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function sendLink() {
    const cleanEmail = email.trim().toLowerCase();

    if (!isValidEmail(cleanEmail)) {
      setMessage('Enter an email so Storeybox can send your private link.');
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        emailRedirectTo: getAuthRedirectUrl(),
      },
    });

    setIsSubmitting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage('Your private link is on the way.');
  }

  return (
    <View style={styles.screen}>
      <View style={styles.glow} />
      <View style={styles.content}>
        <Text style={styles.wordmark}>STOREYBOX</Text>

        <View style={styles.boxWrap}>
          <BoxIllustration size={110} ledColor="#283848" />
        </View>

        <Text style={styles.title}>A place for the things{'\n'}you do not want to lose.</Text>
        <Text style={styles.subtitle}>Your archive is waiting at home.</Text>

        <View style={styles.authCard}>
          <Text style={styles.cardLabel}>ACCESS YOUR ARCHIVE</Text>
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="your@email.com"
            placeholderTextColor="#9AA1AB"
            returnKeyType="send"
            style={styles.input}
            value={email}
            onSubmitEditing={() => void sendLink()}
          />
          <Pressable
            disabled={isSubmitting}
            onPress={() => void sendLink()}
            style={({ pressed }) => [styles.button, (pressed || isSubmitting) && styles.pressed]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.buttonText}>Send a link</Text>
            )}
          </Pressable>
          <Text style={styles.helper}>We send a private link. No password needed.</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>

        <Pressable onPress={() => router.push('/onboarding' as Href)} style={styles.onboardingLink}>
          <Text style={styles.onboardingText}>Pair a Box instead</Text>
        </Pressable>

        <Text style={styles.footer}>YOUR STORY STAYS YOURS · PRIVATE BY DEFAULT</Text>
      </View>
    </View>
  );
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 28,
    paddingVertical: 52,
    position: 'relative',
  },
  glow: {
    backgroundColor: '#C7DCEC',
    borderRadius: 340,
    height: 480,
    left: '50%',
    opacity: 0.28,
    position: 'absolute',
    top: '38%',
    transform: [{ translateX: -340 }, { translateY: -240 }],
    width: 680,
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
  },
  wordmark: {
    color: colors.blue,
    fontFamily: fonts.monoBold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3.3,
    lineHeight: 11,
    marginBottom: 52,
  },
  boxWrap: {
    marginBottom: 42,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.serifLight,
    fontSize: 34,
    fontWeight: '300',
    lineHeight: 40.8,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    color: '#8A939E',
    fontFamily: fonts.serifItalic,
    fontSize: 15,
    fontStyle: 'italic',
    fontWeight: '400',
    lineHeight: 24.75,
    marginBottom: 44,
    textAlign: 'center',
  },
  authCard: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 26,
    paddingVertical: 26,
    width: '100%',
  },
  cardLabel: {
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 2.2,
    lineHeight: 10,
    marginBottom: 22,
    textAlign: 'center',
  },
  inputLabel: {
    color: '#9AA1AB',
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.6,
    marginBottom: 9,
    textTransform: 'uppercase',
  },
  input: {
    borderBottomColor: '#CDD9E5',
    borderBottomWidth: 1.5,
    color: colors.ink,
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 24,
    paddingBottom: 10,
    paddingTop: 8,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 10,
    justifyContent: 'center',
    marginBottom: 14,
    minHeight: 48,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  buttonText: {
    color: colors.background,
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.28,
  },
  helper: {
    color: '#A6A092',
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    textAlign: 'center',
  },
  message: {
    color: colors.blue,
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
    marginTop: 14,
    textAlign: 'center',
  },
  onboardingLink: {
    marginTop: 18,
  },
  onboardingText: {
    color: colors.blue,
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    color: '#B0A894',
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 1.6,
    lineHeight: 14,
    marginTop: 32,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
});
