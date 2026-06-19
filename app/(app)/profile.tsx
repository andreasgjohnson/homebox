import { type Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getProfile, updateProfileName } from '@/lib/profiles';
import { colors, radii, typography } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

export default function ProfileScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      if (!session?.user.id) {
        return;
      }

      setIsLoading(true);
      setMessage(null);

      const { data, error } = await getProfile(session.user.id);

      if (!isMounted) {
        return;
      }

      if (error) {
        setMessage(error.message);
      } else {
        setFirstName(data.first_name || '');
        setLastName(data.last_name || '');
      }

      setIsLoading(false);
    }

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [session?.user.id]);

  async function saveProfile() {
    if (!session?.user.id) {
      return;
    }

    setIsSaving(true);
    setMessage(null);

    const { data, error } = await updateProfileName(session.user.id, firstName, lastName);

    if (error) {
      setMessage(error.message);
      setIsSaving(false);
      return;
    }

    setFirstName(data.first_name || '');
    setLastName(data.last_name || '');
    setMessage('Profile saved.');
    setIsSaving(false);
  }

  const canSave = !isLoading && !isSaving && Boolean(firstName.trim() || lastName.trim());

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.replace('/' as Href)} style={styles.backButton}>
            <Text style={styles.backButtonText}>Back to timeline</Text>
          </Pressable>

          <Text style={styles.eyebrow}>SETTINGS</Text>
          <Text style={styles.title}>Your archive</Text>
          <Text style={styles.body}>
            Your name helps Storeybox write memories back to you with the right voice.
          </Text>

          <View style={styles.formPanel}>
            {isLoading ? (
              <View style={styles.feedback}>
                <ActivityIndicator color={colors.charcoal} />
                <Text style={styles.feedbackText}>Loading settings...</Text>
              </View>
            ) : (
              <View>
                <Text style={styles.inputLabel}>First name</Text>
                <TextInput
                  autoCapitalize="words"
                  editable={!isSaving}
                  onChangeText={setFirstName}
                  placeholder="First name"
                  placeholderTextColor={colors.faint}
                  returnKeyType="next"
                  style={styles.input}
                  value={firstName}
                />

                <Text style={styles.inputLabel}>Last name</Text>
                <TextInput
                  autoCapitalize="words"
                  editable={!isSaving}
                  onChangeText={setLastName}
                  placeholder="Last name"
                  placeholderTextColor={colors.faint}
                  returnKeyType="done"
                  style={styles.input}
                  value={lastName}
                />

                {message ? (
                  <View style={styles.notice}>
                    <Text style={styles.noticeText}>{message}</Text>
                  </View>
                ) : null}

                <Pressable
                  disabled={!canSave}
                  onPress={() => void saveProfile()}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    !canSave && styles.buttonDisabled,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  {isSaving ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Save profile</Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingBottom: 40,
  },
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.gold,
    borderRadius: radii.control,
    borderWidth: 1,
    marginBottom: 28,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  backButtonText: {
    color: colors.charcoal,
    fontSize: 16,
    fontWeight: '800',
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.goldDark,
    marginBottom: 14,
  },
  title: {
    ...typography.screenTitle,
    color: colors.ink,
    marginBottom: 14,
  },
  body: {
    ...typography.body,
    color: colors.muted,
  },
  formPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    marginTop: 24,
    padding: 18,
  },
  inputLabel: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 17,
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  feedback: {
    alignItems: 'center',
    padding: 24,
  },
  feedbackText: {
    color: colors.muted,
    fontSize: 15,
    marginTop: 12,
  },
  notice: {
    backgroundColor: colors.surfaceBlue,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    marginBottom: 14,
    padding: 14,
  },
  noticeText: {
    color: colors.blueDark,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.charcoal,
    borderRadius: radii.control,
    paddingVertical: 16,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.65,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
});
