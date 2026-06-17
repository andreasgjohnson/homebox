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
        placeholderTextColor="#8D8376"
        style={styles.input}
        value={email}
      />
      <TextInput
        autoCapitalize="none"
        autoComplete={isSignup ? 'new-password' : 'current-password'}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor="#8D8376"
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
          <ActivityIndicator color="#FFF9F0" />
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
    backgroundColor: '#FFFDF9',
    borderColor: '#E4D8C8',
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    width: '100%',
  },
  eyebrow: {
    color: '#946A47',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
    marginBottom: 14,
  },
  title: {
    color: '#332B24',
    fontFamily: 'Georgia',
    fontSize: 32,
    marginBottom: 10,
  },
  subtitle: {
    color: '#6E6257',
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#F7F1E8',
    borderColor: '#DED2C2',
    borderRadius: 14,
    borderWidth: 1,
    color: '#332B24',
    fontSize: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  message: {
    color: '#8A473A',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#6D4C36',
    borderRadius: 14,
    marginTop: 4,
    paddingVertical: 16,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFF9F0',
    fontSize: 16,
    fontWeight: '700',
  },
  link: {
    color: '#74543D',
    fontSize: 14,
    marginTop: 20,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
