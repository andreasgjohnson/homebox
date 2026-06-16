import { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export default function HomeScreen() {
  const { session } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    setIsSigningOut(false);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>YOUR PRIVATE ARCHIVE</Text>
        <Text style={styles.title}>A home for the stories that matter.</Text>
        <Text style={styles.body}>
          Phase 1 is connected. You are signed in as {session?.user.email}.
        </Text>
        <View style={styles.note}>
          <Text style={styles.noteText}>
            Memory recording and the timeline will arrive in later phases.
          </Text>
        </View>
        <Pressable
          disabled={isSigningOut}
          onPress={() => void signOut()}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          {isSigningOut ? (
            <ActivityIndicator color="#6D4C36" />
          ) : (
            <Text style={styles.buttonText}>Sign out</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#F5EFE5',
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  eyebrow: {
    color: '#946A47',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
    marginBottom: 16,
  },
  title: {
    color: '#332B24',
    fontFamily: 'Georgia',
    fontSize: 38,
    lineHeight: 46,
    marginBottom: 18,
  },
  body: {
    color: '#6E6257',
    fontSize: 17,
    lineHeight: 25,
  },
  note: {
    backgroundColor: '#FFFDF9',
    borderColor: '#E4D8C8',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 28,
    padding: 18,
  },
  noteText: {
    color: '#6E6257',
    fontSize: 15,
    lineHeight: 22,
  },
  button: {
    alignItems: 'center',
    borderColor: '#BCA893',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 18,
    paddingVertical: 14,
  },
  buttonPressed: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#6D4C36',
    fontSize: 15,
    fontWeight: '700',
  },
});
