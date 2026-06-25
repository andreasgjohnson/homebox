import { type Href, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii } from '@/lib/theme';

type DaybookChromeProps = {
  avatarUrl?: string | null;
  children: ReactNode;
  isSigningOut?: boolean;
  memoryCount?: number;
  onSignOut?: () => void;
  returningThemes?: string[];
  userInitial?: string;
  userName?: string | null;
};

const navItems: Array<{ href: Href; label: string }> = [
  { href: '/' as Href, label: 'Dashboard' },
  { href: '/memories' as Href, label: 'Memories' },
  { href: '/memories?lens=themes' as Href, label: 'Themes' },
  { href: '/memories?lens=people' as Href, label: 'People' },
  { href: '/memories' as Href, label: 'Collections' },
];

export function DaybookChrome({
  avatarUrl,
  children,
  isSigningOut = false,
  memoryCount = 0,
  onSignOut,
  returningThemes = [],
  userInitial = 'A',
  userName,
}: DaybookChromeProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const router = useRouter();

  function navigate(href: Href) {
    setIsDrawerOpen(false);
    router.push(href);
  }

  return (
    <View style={styles.shell}>
      <View style={styles.topBar}>
        <MenuButton onPress={() => setIsDrawerOpen(true)} />
        <StoreyboxWordmark />
        <ProfileAvatar
          avatarUrl={avatarUrl}
          onPress={() => router.push('/profile' as Href)}
          userInitial={userInitial}
        />
      </View>

      {children}

      <StoreyboxDrawer
        isOpen={isDrawerOpen}
        isSigningOut={isSigningOut}
        memoryCount={memoryCount}
        onClose={() => setIsDrawerOpen(false)}
        onNavigate={navigate}
        onSignOut={onSignOut}
        returningThemes={returningThemes}
        avatarUrl={avatarUrl}
        userInitial={userInitial}
        userName={userName}
      />
    </View>
  );
}

export function StoreyboxDrawer({
  avatarUrl,
  isOpen,
  isSigningOut = false,
  memoryCount = 0,
  onClose,
  onNavigate,
  onSignOut,
  returningThemes = [],
  userInitial = 'A',
  userName,
}: Omit<DaybookChromeProps, 'children'> & {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (href: Href) => void;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={isOpen}>
      <View style={styles.modal}>
        <Pressable onPress={onClose} style={styles.scrim} />
        <View style={styles.drawer}>
          <View style={styles.drawerTop}>
            <Text style={styles.drawerWordmark}>STOREYBOX</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.close}>×</Text>
            </Pressable>
          </View>

          <View style={styles.userRow}>
            <ProfileAvatar avatarUrl={avatarUrl} size="large" userInitial={userInitial} />
            <View>
              <Text style={styles.userName}>{userName || 'Your archive'}</Text>
              <Text style={styles.userMeta}>{memoryCount} moments kept</Text>
            </View>
          </View>

          <View style={styles.navList}>
            {navItems.map((item) => (
              <Pressable key={item.label} onPress={() => onNavigate(item.href)} style={styles.navItem}>
                <Text style={styles.navLabel}>{item.label}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => onNavigate('/profile' as Href)} style={styles.navItem}>
              <Text style={styles.navLabel}>Settings</Text>
            </Pressable>
          </View>

          <View style={styles.returning}>
            <Text style={styles.returningLabel}>RETURNING THEMES</Text>
            <Text style={styles.returningText}>
              {(returningThemes.length ? returningThemes : ['Home', 'Family', 'Building', 'The future']).join(
                ' · ',
              )}
            </Text>
          </View>

          <View style={styles.drawerFooter}>
            <Text style={styles.privacyLine}>Your story stays yours.</Text>
            {onSignOut ? (
              <Pressable disabled={isSigningOut} onPress={onSignOut} style={styles.signOutButton}>
                {isSigningOut ? (
                  <ActivityIndicator color={colors.ink} />
                ) : (
                  <Text style={styles.signOutText}>Sign out</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function StoreyboxWordmark() {
  const router = useRouter();

  return (
    <Pressable
      accessibilityLabel="Go to dashboard"
      accessibilityRole="link"
      hitSlop={10}
      onPress={() => router.replace('/' as Href)}
      style={styles.wordmarkButton}
    >
      <Text style={styles.wordmark}>STOREYBOX</Text>
    </Pressable>
  );
}

export function ProfileAvatar({
  avatarUrl,
  onPress,
  size = 'small',
  userInitial = 'A',
}: {
  avatarUrl?: string | null;
  onPress?: () => void;
  size?: 'small' | 'large';
  userInitial?: string;
}) {
  const avatarStyle = size === 'large' ? styles.largeAvatar : styles.avatar;
  const imageStyle = size === 'large' ? styles.largeAvatarImage : styles.avatarImage;
  const textStyle = size === 'large' ? styles.largeAvatarText : styles.avatarText;

  const content = avatarUrl ? (
    <Image source={{ uri: avatarUrl }} style={imageStyle} />
  ) : (
    <Text style={textStyle}>{userInitial}</Text>
  );

  if (!onPress) {
    return <View style={avatarStyle}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityLabel="Open profile settings"
      accessibilityRole="button"
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [avatarStyle, pressed && styles.avatarPressed]}
    >
      {content}
    </Pressable>
  );
}

export function MenuButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.menuButton}>
      <View style={styles.menuLines}>
        <View style={styles.menuLine} />
        <View style={styles.menuLine} />
        <View style={[styles.menuLine, styles.menuLineShort]} />
      </View>
      <Text style={styles.menuText}>Menu</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: colors.background,
    flex: 1,
  },
  topBar: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingVertical: 22,
  },
  menuButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-start',
    minWidth: 86,
  },
  menuLines: {
    gap: 3.5,
  },
  menuLine: {
    backgroundColor: '#5A6470',
    height: 1.5,
    width: 18,
  },
  menuLineShort: {
    width: 12,
  },
  menuText: {
    color: '#5A6470',
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '500',
  },
  wordmark: {
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 3.12,
  },
  wordmarkButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 32,
  },
  avatarImage: {
    height: 32,
    width: 32,
  },
  avatarPressed: {
    opacity: 0.72,
  },
  avatarText: {
    color: colors.background,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '600',
  },
  modal: {
    flex: 1,
  },
  scrim: {
    backgroundColor: 'rgba(28,34,42,.34)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  drawer: {
    backgroundColor: '#F1EDE4',
    boxShadow: '24px 0 60px rgba(28,34,42,.26)',
    flex: 1,
    maxWidth: 360,
    paddingHorizontal: 30,
    paddingVertical: 34,
    width: '86%',
  },
  drawerTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  drawerWordmark: {
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 2.64,
  },
  close: {
    color: '#5A6470',
    fontFamily: fonts.serif,
    fontSize: 20,
    fontWeight: '400',
    lineHeight: 22,
  },
  userRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 13,
    marginTop: 30,
  },
  largeAvatar: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 44,
  },
  largeAvatarImage: {
    height: 44,
    width: 44,
  },
  largeAvatarText: {
    color: '#F1EDE4',
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '600',
  },
  userName: {
    color: colors.ink,
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 18,
  },
  userMeta: {
    color: '#7D8893',
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 12,
    marginTop: 3,
  },
  navList: {
    marginTop: 28,
  },
  navItem: {
    paddingVertical: 13,
  },
  navLabel: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 21,
    fontWeight: '400',
    lineHeight: 21,
  },
  returning: {
    borderTopColor: '#DDD6C8',
    borderTopWidth: 1,
    marginTop: 26,
    paddingTop: 22,
  },
  returningLabel: {
    color: colors.faint,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 1.54,
    lineHeight: 11,
    marginBottom: 14,
  },
  returningText: {
    color: '#3A4350',
    fontFamily: fonts.serif,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 25.5,
  },
  drawerFooter: {
    gap: 14,
    marginTop: 'auto',
    paddingTop: 24,
  },
  privacyLine: {
    color: colors.faint,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 16.5,
  },
  signOutButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderColor: colors.borderStrong,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  signOutText: {
    color: colors.ink,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '600',
  },
});
