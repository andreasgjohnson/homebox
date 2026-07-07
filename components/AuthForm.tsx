import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';

import { BoxIllustration } from '@/components/BoxHardware';
import { getAuthRedirectUrl } from '@/lib/authRedirect';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';

const glowStyle = {
  backgroundImage: 'radial-gradient(ellipse,#c7dcec,transparent 66%)',
} as unknown as ViewStyle;

type AuthFormProps = {
  mode?: 'login' | 'signup';
};

export function AuthForm({ mode = 'signup' }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isLogin = mode === 'login';

  async function sendMagicLink() {
    const cleanEmail = email.trim().toLowerCase();

    if (!isValidEmail(cleanEmail)) {
      setMessage('Enter a valid email so Storeybox can send your private link.');
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
    <View style={styles.stage}>
      <View style={styles.brand}>
        <View style={[styles.brandGlow, glowStyle]} />
        <Text style={styles.wordmark}>STOREYBOX</Text>
        <View style={styles.brandCopy}>
          <Text style={styles.brandTitle}>A place for the things worth keeping.</Text>
          <Text style={styles.brandBody}>
            Your Box captures what you choose to leave there. Storeybox keeps the audio, a clean
            transcript, a gentle summary, and a few quiet signals.
          </Text>
        </View>
        <View>
          <Text style={styles.promise}>Nothing is shared. Your story stays yours.</Text>
          <Text style={styles.monoFoot}>PRIVATE BY DEFAULT · ENCRYPTED · DELETABLE ANYTIME</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.entryScroll} keyboardShouldPersistTaps="handled">
        <View style={styles.entryInner}>
          <View style={styles.boxWrap}>
            <BoxIllustration size={92} ledColor="#3D5F7E" />
          </View>
          <Text style={styles.eyebrow}>{isLogin ? 'WELCOME BACK' : 'ACCESS YOUR ARCHIVE'}</Text>
          <Text style={styles.title}>{isLogin ? 'Welcome back.' : 'Begin with your private link.'}</Text>
          <Text style={styles.body}>
            Enter your email and we will send a private link that opens your archive. No passwords,
            ever.
          </Text>

          <View style={styles.emailBlock}>
            <Text style={styles.emailLabel}>EMAIL</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.faint}
              returnKeyType="send"
              style={styles.emailInput}
              value={email}
              onSubmitEditing={() => void sendMagicLink()}
            />
          </View>

          <Pressable
            disabled={!email.trim() || isSubmitting}
            onPress={() => void sendMagicLink()}
            style={({ pressed }) => [
              styles.primaryButton,
              (!email.trim() || isSubmitting) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.primaryButtonText}>Send me a private link</Text>
            )}
          </Pressable>
          <Text style={styles.magicHint}>The link works once and quietly expires.</Text>

          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>
      </ScrollView>
    </View>
  );
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const styles = StyleSheet.create({
  stage: {
    backgroundColor: colors.background,
    flex: 1,
    flexDirection: 'row',
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
    position: 'absolute',
    top: '46%',
    transform: [{ translateX: -340 }, { translateY: -240 }],
    width: 680,
  },
  wordmark: {
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 3.9,
    lineHeight: 13,
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
    lineHeight: 60.5,
  },
  brandBody: {
    color: '#5A6470',
    fontFamily: fonts.sans,
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 28.8,
    marginTop: 26,
    maxWidth: 460,
  },
  promise: {
    color: '#3A4A58',
    fontFamily: fonts.serif,
    fontSize: 22,
    fontStyle: 'italic',
    fontWeight: '400',
    lineHeight: 30.8,
    marginBottom: 12,
    maxWidth: 440,
  },
  monoFoot: {
    color: '#A6A092',
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
  entryInner: {
    alignItems: 'center',
    maxWidth: 420,
    width: '100%',
  },
  boxWrap: {
    marginBottom: 28,
  },
  eyebrow: {
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 2.86,
    lineHeight: 11,
    marginBottom: 16,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 40,
    fontWeight: '300',
    lineHeight: 44.8,
    textAlign: 'center',
  },
  body: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24.8,
    marginTop: 14,
    textAlign: 'center',
  },
  emailBlock: {
    marginTop: 36,
    width: '100%',
  },
  emailLabel: {
    color: '#8A939E',
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 1.98,
    lineHeight: 11,
    marginBottom: 12,
  },
  emailInput: {
    borderBottomColor: colors.blueLine,
    borderBottomWidth: 1.5,
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 19,
    fontWeight: '400',
    paddingBottom: 12,
    paddingTop: 6,
    width: '100%',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    marginTop: 28,
    paddingHorizontal: 22,
    width: '100%',
  },
  primaryButtonText: {
    color: colors.background,
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.48,
  },
  pressed: {
    opacity: 0.72,
  },
  magicHint: {
    color: '#8A939E',
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 19.5,
    marginTop: 16,
    textAlign: 'center',
  },
  message: {
    color: colors.blue,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19.5,
    marginTop: 18,
    textAlign: 'center',
  },
});
