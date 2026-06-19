import { Link } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';
import { colors, radii, typography } from '@/lib/theme';

type AuthFormProps = {
  mode: 'login' | 'signup';
};

export function AuthForm({ mode }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSignup = mode === 'signup';

  async function submit() {
    setIsSubmitting(true);
    setMessage(null);

    const credentials = {
      email: email.trim(),
      password,
    };

    try {
      const { data, error } = isSignup
        ? await supabase.auth.signUp(credentials)
        : await supabase.auth.signInWithPassword(credentials);

      if (error) {
        setMessage(error.message);
      } else if (isSignup && !data.session) {
        setMessage('Check your email to confirm your account, then sign in.');
      }
    } catch {
      setMessage('Unable to reach Supabase. Check your project URL and network connection.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>STOREYBOX HOME</Text>
      <Text style={styles.title}>{isSignup ? 'Begin your archive' : 'Welcome back'}</Text>
      <Text style={styles.subtitle}>
        {isSignup
          ? 'Create a private place for the stories that matter.'
          : 'Return to the stories you are preserving.'}
      </Text>

      <TextInput
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        onChangeText={setEmail}
        placeholder="Email address"
        placeholderTextColor={colors.faint}
        style={styles.input}
        value={email}
      />
      <TextInput
        autoCapitalize="none"
        autoComplete={isSignup ? 'new-password' : 'current-password'}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor={colors.faint}
        secureTextEntry
        style={styles.input}
        value={password}
      />

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <Pressable
        disabled={isSubmitting || !email.trim() || !password}
        onPress={() => void submit()}
        style={({ pressed }) => [
          styles.button,
          (pressed || isSubmitting) && styles.buttonPressed,
        ]}
      >
        {isSubmitting ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.buttonText}>{isSignup ? 'Create account' : 'Sign in'}</Text>
        )}
      </Pressable>

      <Link href={isSignup ? '/login' : '/signup'} style={styles.link}>
        {isSignup ? 'Already have an account? Sign in' : 'New here? Create an account'}
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    padding: 24,
    width: '100%',
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.goldDark,
    marginBottom: 14,
  },
  title: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 0,
    marginBottom: 10,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 24,
  },
  input: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  message: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.charcoal,
    borderRadius: radii.control,
    marginTop: 4,
    paddingVertical: 16,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  link: {
    color: colors.blueDark,
    fontSize: 14,
    marginTop: 20,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
