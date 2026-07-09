import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BottomTabBar, StoreyboxWordmark } from '@/components/DaybookChrome';
import { getProfile, getProfileDisplayName } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

export default function ProfileScreen() {
  const { session } = useAuth();
  const [displayName, setDisplayName] = useState(session?.user.email || 'Your archive');
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const initial = (displayName || session?.user.email || 'A').slice(0, 1).toUpperCase();

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      if (!session?.user.id) {
        return;
      }

      setIsLoading(true);
      const { data } = await getProfile(session.user.id);

      if (!isMounted) {
        return;
      }

      setDisplayName(getProfileDisplayName(data) || session.user.email || 'Your archive');
      setIsLoading(false);
    }

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [session?.user.email, session?.user.id]);

  async function signOut() {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    setIsSigningOut(false);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <View style={styles.topSpacer} />
        <StoreyboxWordmark />
        <View style={styles.topSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.meta}>Archiving since March 2026</Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.feedback}>
            <ActivityIndicator color={colors.ink} />
            <Text style={styles.feedbackText}>Opening profile...</Text>
          </View>
        ) : null}

        <Section title="ACCOUNT">
          <SettingRow label="Name" value={displayName} />
          <SettingRow label="Email" value={session?.user.email ?? 'Private link'} />
          <SettingRow label="Archive since" value="March 2026" />
        </Section>

        <Section title="PRIVACY & OWNERSHIP">
          <SettingRow label="Private by default" value="On" valueColor={colors.blue} />
          <SettingRow label="Export your archive" value="Request" />
          <SettingRow label="Data ownership" value="Yours" valueColor={colors.blue} />
        </Section>

        <Section title="NOTIFICATIONS">
          <SettingRow label="Storey ready" value="On" valueColor={colors.blue} />
          <SettingRow label="Storey worth revisiting" value="Weekly" />
          <SettingRow label="All others" value="Off" />
        </Section>

        <Section muted title="TRUSTED CONTACTS — COMING LATER">
          <SettingRow label="Legacy settings" value="FUTURE" />
          <SettingRow label="Trusted contact" value="FUTURE" />
        </Section>

        <Pressable disabled={isSigningOut} onPress={() => void signOut()} style={styles.signOut}>
          {isSigningOut ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Text style={styles.signOutText}>Sign out</Text>
          )}
        </Pressable>

        <Text style={styles.footer}>YOUR STORY STAYS YOURS · PRIVATE BY DEFAULT</Text>
      </ScrollView>

      <BottomTabBar activeTab="profile" />
    </SafeAreaView>
  );
}

function Section({
  children,
  muted = false,
  title,
}: {
  children: ReactNode;
  muted?: boolean;
  title: string;
}) {
  return (
    <View style={[styles.section, muted && styles.sectionMuted]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.table}>{children}</View>
    </View>
  );
}

function SettingRow({
  label,
  value,
  valueColor = '#8A939E',
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  topBar: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingVertical: 20,
  },
  topSpacer: {
    width: 44,
  },
  container: {
    alignSelf: 'center',
    maxWidth: 480,
    paddingBottom: 96,
    paddingHorizontal: 28,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 18,
    marginBottom: 24,
    paddingBottom: 24,
    paddingTop: 32,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 30,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  avatarText: {
    color: colors.background,
    fontFamily: fonts.serif,
    fontSize: 24,
    fontWeight: '300',
  },
  name: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 22,
    fontWeight: '400',
    lineHeight: 24,
    marginBottom: 4,
  },
  meta: {
    color: '#9AA1AB',
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '400',
  },
  section: {
    marginBottom: 20,
  },
  sectionMuted: {
    opacity: 0.58,
  },
  sectionTitle: {
    color: '#8A939E',
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 1.8,
    lineHeight: 10,
    marginBottom: 10,
  },
  table: {
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    borderBottomColor: '#F0E8DA',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  rowLabel: {
    color: '#3A4350',
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '500',
  },
  rowValue: {
    flexShrink: 1,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'right',
  },
  signOut: {
    alignItems: 'center',
    alignSelf: 'center',
    borderColor: colors.borderStrong,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 28,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  signOutText: {
    color: colors.ink,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    color: '#B0A894',
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 1.32,
    lineHeight: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  feedback: {
    alignItems: 'center',
    marginBottom: 20,
  },
  feedbackText: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 13,
    marginTop: 8,
  },
});
