import { type Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { BottomTabBar, StoreyboxWordmark } from '@/components/DaybookChrome';
import {
  getProfilePhotoPath,
  getProfilePhotoPreviewUrl,
  removeProfilePhoto,
  uploadProfilePhoto,
} from '@/lib/profilePhotos';
import { getProfile, updateProfileName } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';
import { colors, fonts, radii, typography } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

export default function ProfileScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const isPhone = width < 760;
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
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
        setAvatarPath(data.avatar_url || null);
        setAvatarPreviewUrl(await getProfilePhotoPreviewUrl(data.avatar_url));
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
    setAvatarPath(data.avatar_url || null);
    setMessage('Profile saved.');
    setIsSaving(false);
  }

  function chooseProfilePhoto() {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      setMessage('Profile photo upload is currently available on the web app.');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = () => {
      const file = input.files?.[0];

      if (file) {
        void saveProfilePhoto(file);
      }
    };
    input.click();
  }

  async function saveProfilePhoto(file: File) {
    if (!session?.user.id) {
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage('Choose a JPEG, PNG, or WebP image.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage('Choose an image smaller than 5 MB.');
      return;
    }

    setIsUploadingPhoto(true);
    setMessage(null);

    const photoPath = getProfilePhotoPath(session.user.id, file.name, file.type);
    const { error: uploadError } = await uploadProfilePhoto(file, photoPath, file.type);

    if (uploadError) {
      setMessage(getPhotoErrorMessage(uploadError.message));
      setIsUploadingPhoto(false);
      return;
    }

    const { data, error } = await updateProfileName(session.user.id, firstName, lastName, photoPath);

    if (error) {
      setMessage(getPhotoErrorMessage(error.message));
      setIsUploadingPhoto(false);
      return;
    }

    setFirstName(data.first_name || '');
    setLastName(data.last_name || '');
    setAvatarPath(data.avatar_url || null);
    setAvatarPreviewUrl(await getProfilePhotoPreviewUrl(data.avatar_url));
    setMessage('Profile photo saved.');
    setIsUploadingPhoto(false);
  }

  async function clearProfilePhoto() {
    if (!session?.user.id || !avatarPath) {
      return;
    }

    setIsUploadingPhoto(true);
    setMessage(null);

    await removeProfilePhoto(avatarPath);
    const { data, error } = await updateProfileName(session.user.id, firstName, lastName, null);

    if (error) {
      setMessage(getPhotoErrorMessage(error.message));
      setIsUploadingPhoto(false);
      return;
    }

    setFirstName(data.first_name || '');
    setLastName(data.last_name || '');
    setAvatarPath(null);
    setAvatarPreviewUrl(null);
    setMessage('Profile photo removed.');
    setIsUploadingPhoto(false);
  }

  async function signOut() {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    setIsSigningOut(false);
  }

  const canSave =
    !isLoading && !isSaving && !isSigningOut && !isUploadingPhoto && Boolean(firstName.trim() || lastName.trim());

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.topBar}>
          <Pressable onPress={() => router.replace('/' as Href)} style={styles.backLink}>
            <Text style={styles.backChevron}>‹</Text>
            <Text style={styles.backText}>Dashboard</Text>
          </Pressable>
          <StoreyboxWordmark />
          <Text style={styles.privateLabel}>PRIVATE</Text>
        </View>

        <ScrollView
          contentContainerStyle={[styles.container, isPhone && styles.containerPhone]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.eyebrow}>SETTINGS</Text>
          <Text style={styles.title}>Your archive</Text>
          <Text style={styles.body}>
            Your name and photo help Storeybox feel like your own private archive.
          </Text>

          <View style={styles.formPanel}>
            {isLoading ? (
              <View style={styles.feedback}>
                <ActivityIndicator color={colors.charcoal} />
                <Text style={styles.feedbackText}>Loading settings...</Text>
              </View>
            ) : (
              <View>
                <View style={styles.photoSection}>
                  <View style={styles.photoPreview}>
                    {avatarPreviewUrl ? (
                      <Image source={{ uri: avatarPreviewUrl }} style={styles.photoImage} />
                    ) : (
                      <Text style={styles.photoInitial}>
                        {(firstName || session?.user.email || 'A').slice(0, 1).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View style={styles.photoActions}>
                    <Text style={styles.inputLabel}>Profile picture</Text>
                    <Text style={styles.photoHelp}>Optional. This appears in the top-right settings button.</Text>
                    <View style={styles.photoButtonRow}>
                      <Pressable
                        disabled={isUploadingPhoto || isSaving}
                        onPress={chooseProfilePhoto}
                        style={({ pressed }) => [
                          styles.secondaryButton,
                          (isUploadingPhoto || isSaving) && styles.buttonDisabled,
                          pressed && styles.buttonPressed,
                        ]}
                      >
                        {isUploadingPhoto ? (
                          <ActivityIndicator color={colors.ink} />
                        ) : (
                          <Text style={styles.secondaryButtonText}>
                            {avatarPath ? 'Change photo' : 'Add photo'}
                          </Text>
                        )}
                      </Pressable>
                      {avatarPath ? (
                        <Pressable
                          disabled={isUploadingPhoto || isSaving}
                          onPress={() => void clearProfilePhoto()}
                          style={({ pressed }) => [
                            styles.removeButton,
                            (isUploadingPhoto || isSaving) && styles.buttonDisabled,
                            pressed && styles.buttonPressed,
                          ]}
                        >
                          <Text style={styles.removeButtonText}>Remove</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                </View>

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

                <Pressable
                  accessibilityRole="button"
                  disabled={isSigningOut || isSaving || isUploadingPhoto}
                  onPress={() => void signOut()}
                  style={({ pressed }) => [
                    styles.logoutButton,
                    (isSigningOut || isSaving || isUploadingPhoto) && styles.buttonDisabled,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  {isSigningOut ? (
                    <ActivityIndicator color={colors.muted} />
                  ) : (
                    <Text style={styles.logoutButtonText}>Log out</Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {isPhone ? <BottomTabBar activeTab="you" /> : null}
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
  topBar: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    paddingVertical: 20,
  },
  backLink: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minWidth: 86,
  },
  backChevron: {
    color: '#5A6470',
    fontFamily: fonts.serif,
    fontSize: 18,
    lineHeight: 14,
  },
  backText: {
    color: '#5A6470',
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '500',
  },
  privateLabel: {
    color: '#A6A092',
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 1.32,
    minWidth: 86,
    textAlign: 'right',
  },
  container: {
    alignSelf: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    maxWidth: 720,
    padding: 24,
    paddingBottom: 40,
    width: '100%',
  },
  containerPhone: {
    paddingBottom: 112,
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
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    marginTop: 24,
    padding: 18,
  },
  photoSection: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 18,
    marginBottom: 18,
    paddingBottom: 18,
  },
  photoPreview: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderColor: colors.borderStrong,
    borderRadius: 38,
    borderWidth: 1,
    height: 76,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 76,
  },
  photoImage: {
    height: 76,
    width: 76,
  },
  photoInitial: {
    color: colors.background,
    fontFamily: fonts.sans,
    fontSize: 28,
    fontWeight: '700',
  },
  photoActions: {
    flex: 1,
  },
  photoHelp: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  photoButtonRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.borderStrong,
    borderRadius: radii.pill,
    borderWidth: 1,
    minWidth: 112,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: colors.ink,
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '700',
  },
  removeButton: {
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  removeButtonText: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '700',
  },
  inputLabel: {
    color: colors.ink,
    fontFamily: fonts.sans,
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
    fontFamily: fonts.serif,
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
    fontFamily: fonts.sans,
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
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: radii.pill,
    paddingVertical: 16,
  },
  primaryButtonText: {
    color: colors.white,
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '700',
  },
  logoutButton: {
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  logoutButtonText: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  buttonPressed: {
    opacity: 0.65,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
});

function getPhotoErrorMessage(message: string) {
  if (message.toLowerCase().includes('bucket not found')) {
    return 'Profile photos are not ready yet: apply the Supabase profile photos migration.';
  }

  if (message.toLowerCase().includes('avatar_url')) {
    return 'Profile photos are not ready yet: add the avatar_url column with the latest Supabase migration.';
  }

  return message;
}
