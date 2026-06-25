import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import { DaybookChrome } from '@/components/DaybookChrome';
import {
  buildArchiveMoments,
  getDashboardInsight,
  getFirstName,
  getPersonAggregates,
  getThemeAggregates,
  toSlug,
} from '@/lib/archiveView';
import { listMemories, type MemoryListItem } from '@/lib/memories';
import { getProfilePhotoPreviewUrl } from '@/lib/profilePhotos';
import { getProfile, getProfileDisplayName } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';
import { colors, fonts, getTextureColor } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

const glowStyle = {
  backgroundImage: 'radial-gradient(ellipse,#c7dcec,transparent 68%)',
} as unknown as ViewStyle;

const recordGlowStyle = {
  backgroundImage: 'radial-gradient(circle,#bcd2e6,transparent 68%)',
} as unknown as ViewStyle;

const analyticsWashStyle = {
  backgroundImage: 'linear-gradient(180deg,#eaf1f7,#eef3f7)',
} as unknown as ViewStyle;

export default function HomeScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [memories, setMemories] = useState<MemoryListItem[]>([]);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [isLoadingMemories, setIsLoadingMemories] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadMemories = useCallback(async () => {
    if (!session?.user.id) {
      return;
    }

    setIsLoadingMemories(true);
    setErrorMessage(null);

    const [{ data, error }, { data: profile }] = await Promise.all([
      listMemories(session.user.id),
      getProfile(session.user.id),
    ]);

    if (error) {
      setErrorMessage(error.message);
    } else {
      setMemories(data ?? []);
    }

    setProfileName(getProfileDisplayName(profile ?? null));
    setProfileAvatarUrl(await getProfilePhotoPreviewUrl(profile?.avatar_url));
    setIsLoadingMemories(false);
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      void loadMemories();
    }, [loadMemories]),
  );

  const firstName = getFirstName(profileName || session?.user.email);
  const moments = useMemo(() => buildArchiveMoments(memories), [memories]);
  const themes = useMemo(() => getThemeAggregates(moments), [moments]);
  const people = useMemo(() => getPersonAggregates(moments), [moments]);
  const recentMoments = moments.slice(0, 3);
  const topTheme = themes[0];
  const topPerson = people[0];
  const topTexture = moments[0]?.texture ?? 'Reflective';
  const insight = getDashboardInsight(themes);

  async function signOut() {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    setIsSigningOut(false);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <DaybookChrome
        avatarUrl={profileAvatarUrl}
        isSigningOut={isSigningOut}
        memoryCount={memories.length}
        onSignOut={() => void signOut()}
        returningThemes={themes.slice(0, 4).map((theme) => theme.name)}
        userInitial={firstName.slice(0, 1).toUpperCase()}
        userName={profileName || session?.user.email}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.hero}>
            <Text style={styles.greeting}>Good {getDayPart()}, {firstName}.</Text>
            <View style={styles.insightWrap}>
              <View style={[styles.heroGlow, glowStyle]} />
              <Text style={styles.insight}>{insight}</Text>
            </View>
            <Text style={styles.basis}>A reflection drawn from your recent recordings.</Text>
          </View>

          <View style={styles.recordWrap}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/memories/new' as Href)}
              style={({ pressed }) => [styles.recordTarget, pressed && styles.pressed]}
            >
              <View style={[styles.recordGlow, recordGlowStyle]} />
              <View style={styles.recordRing} />
              <View style={styles.recordCore}>
                <MicIcon />
              </View>
            </Pressable>
            <Text style={styles.recordTitle}>Hold to remember</Text>
            <Text style={styles.recordPrompt}>What made today meaningful?</Text>
          </View>

          {isLoadingMemories ? (
            <View style={styles.feedback}>
              <ActivityIndicator color={colors.ink} />
              <Text style={styles.feedbackText}>Opening your archive...</Text>
            </View>
          ) : null}

          {errorMessage ? (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.sectionLabelWrap}>
            <Text style={styles.sectionLabel}>WHAT YOU'VE BEEN HOLDING ONTO</Text>
          </View>

          {recentMoments.length ? (
            <View style={styles.spineList}>
              {recentMoments.map((moment) => (
                <Pressable
                  key={moment.id}
                  onPress={() => router.push(`/memories/${moment.id}` as Href)}
                  style={({ pressed }) => [styles.spineItem, pressed && styles.pressed]}
                >
                  <View style={[styles.node, { backgroundColor: moment.textureColor }]} />
                  <View style={styles.stampRow}>
                    <View style={styles.stampDot} />
                    <Text style={styles.stamp}>{moment.stamp}</Text>
                  </View>
                  <Text style={styles.momentTitle}>{moment.title}</Text>
                  <Text style={styles.excerpt}>“{moment.excerpt}”</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Your first memory belongs here.</Text>
              <Text style={styles.emptyText}>
                Start with a small detail from today. Storeybox will turn the recording into a
                transcript, summary, and quiet pattern for your archive.
              </Text>
            </View>
          )}

          <Pressable onPress={() => router.push('/memories' as Href)} style={styles.allMemories}>
            <Text style={styles.allMemoriesText}>All your memories</Text>
            <Text style={styles.arrow}>›</Text>
          </Pressable>

          <View style={[styles.analyticsBand, analyticsWashStyle]}>
            <Text style={styles.analyticsLabel}>RECENT INSIGHTS · LAST 7 DAYS</Text>
            <View style={styles.analyticsGrid}>
              <Pressable
                onPress={() => router.push(`/themes/${toSlug(topTheme?.name ?? 'Home')}` as Href)}
                style={styles.analyticsColumn}
              >
                <Text style={styles.analyticsKicker}>TOP THEME</Text>
                <Text style={styles.analyticsValue}>{topTheme?.name ?? 'Home'}</Text>
                <Text style={styles.analyticsMeta}>{topTheme?.count ?? 0} moments · +2</Text>
                <View style={styles.freqBars}>
                  <View style={[styles.freqBar, { backgroundColor: colors.blue, flex: 9 }]} />
                  <View style={[styles.freqBar, { backgroundColor: '#A9C0D4', flex: 7 }]} />
                  <View style={[styles.freqBar, { backgroundColor: '#CDDDEA', flex: 5 }]} />
                </View>
              </Pressable>
              <View style={styles.analyticsColumn}>
                <Text style={styles.analyticsKicker}>TEXTURE</Text>
                <Text style={styles.analyticsValue}>{topTexture}</Text>
                <Text style={styles.analyticsMeta}>Calmer than last week</Text>
                <View style={styles.textureDots}>
                  <View style={[styles.textureDot, { backgroundColor: getTextureColor(topTexture) }]} />
                  <View style={[styles.textureDot, { backgroundColor: getTextureColor('Hopeful') }]} />
                  <View style={[styles.textureDot, { backgroundColor: getTextureColor('Tender') }]} />
                </View>
              </View>
              <Pressable
                onPress={() => router.push(`/people/${toSlug(topPerson?.name ?? 'Dad')}` as Href)}
                style={styles.analyticsColumn}
              >
                <Text style={styles.analyticsKicker}>WHO CAME UP</Text>
                <Text style={styles.analyticsValue}>{topPerson?.name ?? 'Dad'}</Text>
                <Text style={styles.analyticsMeta}>{topPerson?.count ?? 0}× · more than usual</Text>
              </Pressable>
            </View>
            <View style={styles.deepLinks}>
              <Pressable onPress={() => router.push('/memories?lens=themes' as Href)}>
                <Text style={styles.deepLink}>See all themes</Text>
              </Pressable>
              <View style={styles.deepLinkDot} />
              <Pressable onPress={() => router.push('/memories?lens=people' as Href)}>
                <Text style={styles.deepLink}>See all people</Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.footer}>Your story stays yours.</Text>
        </ScrollView>
      </DaybookChrome>
    </SafeAreaView>
  );
}

function getDayPart() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return 'morning';
  }

  if (hour < 18) {
    return 'afternoon';
  }

  return 'evening';
}

function MicIcon() {
  return (
    <View style={styles.micWrap}>
      <View style={styles.micBody} />
      <View style={styles.micArc} />
      <View style={styles.micStem} />
      <View style={styles.micBase} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  container: {
    alignSelf: 'center',
    maxWidth: 680,
    paddingBottom: 70,
    paddingHorizontal: 40,
    width: '100%',
  },
  hero: {
    alignItems: 'center',
    marginTop: 46,
    textAlign: 'center',
  },
  greeting: {
    color: '#8A939E',
    fontFamily: fonts.serif,
    fontSize: 14,
    fontStyle: 'italic',
    fontWeight: '400',
    lineHeight: 14,
    marginBottom: 22,
  },
  insightWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  heroGlow: {
    height: 300,
    left: '50%',
    pointerEvents: 'none',
    position: 'absolute',
    top: '50%',
    transform: [{ translateX: -260 }, { translateY: -150 }],
    width: 520,
  },
  insight: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 56,
    fontWeight: '300',
    letterSpacing: -0.84,
    lineHeight: 62.72,
    position: 'relative',
    textAlign: 'center',
  },
  basis: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    marginTop: 22,
    textAlign: 'center',
  },
  recordWrap: {
    alignItems: 'center',
    marginTop: 48,
  },
  recordTarget: {
    height: 148,
    position: 'relative',
    width: 148,
  },
  recordGlow: {
    borderRadius: 88,
    bottom: -14,
    left: -14,
    position: 'absolute',
    right: -14,
    top: -14,
  },
  recordRing: {
    borderColor: '#CDD9E5',
    borderRadius: 74,
    borderWidth: 1,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  recordCore: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 60,
    bottom: 14,
    boxShadow: '0 12px 30px rgba(30,38,48,.28)',
    justifyContent: 'center',
    left: 14,
    position: 'absolute',
    right: 14,
    top: 14,
  },
  micWrap: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  micBody: {
    borderColor: '#CDD9E5',
    borderRadius: 6,
    borderWidth: 1.8,
    height: 18,
    width: 10,
  },
  micArc: {
    borderBottomColor: '#CDD9E5',
    borderBottomWidth: 1.8,
    borderLeftColor: '#CDD9E5',
    borderLeftWidth: 1.8,
    borderRightColor: '#CDD9E5',
    borderRightWidth: 1.8,
    borderTopColor: 'transparent',
    borderTopWidth: 0,
    borderRadius: 12,
    height: 13,
    marginTop: -8,
    width: 22,
  },
  micStem: {
    backgroundColor: '#CDD9E5',
    height: 7,
    marginTop: -1,
    width: 1.8,
  },
  micBase: {
    backgroundColor: '#CDD9E5',
    borderRadius: 1,
    height: 1.8,
    width: 12,
  },
  recordTitle: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 20,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 22,
  },
  recordPrompt: {
    color: '#8A939E',
    fontFamily: fonts.serif,
    fontSize: 14,
    fontStyle: 'italic',
    fontWeight: '400',
    lineHeight: 14,
    marginTop: 8,
  },
  sectionLabelWrap: {
    alignSelf: 'flex-start',
    borderBottomColor: '#9FB8D0',
    borderBottomWidth: 2,
    marginTop: 58,
    paddingBottom: 6,
  },
  sectionLabel: {
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 2.2,
    lineHeight: 11,
  },
  spineList: {
    borderLeftColor: colors.blueLine,
    borderLeftWidth: 1.5,
    marginTop: 16,
    paddingLeft: 24,
  },
  spineItem: {
    borderBottomColor: '#DDE7EF',
    borderBottomWidth: 1,
    paddingVertical: 22,
    position: 'relative',
  },
  node: {
    borderRadius: 5,
    boxShadow: `0 0 0 4px ${colors.background}`,
    height: 9,
    left: -29.5,
    position: 'absolute',
    top: 28,
    width: 9,
  },
  stampRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  stampDot: {
    backgroundColor: colors.blue,
    borderRadius: 2.5,
    height: 5,
    width: 5,
  },
  stamp: {
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.66,
    lineHeight: 11,
  },
  momentTitle: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 23,
    fontWeight: '400',
    lineHeight: 27.6,
    marginBottom: 6,
  },
  excerpt: {
    color: colors.muted,
    fontFamily: fonts.serif,
    fontSize: 15,
    fontStyle: 'italic',
    fontWeight: '400',
    lineHeight: 21.75,
  },
  allMemories: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  allMemoriesText: {
    color: colors.blue,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '500',
  },
  arrow: {
    color: colors.blue,
    fontFamily: fonts.sans,
    fontSize: 24,
    lineHeight: 20,
  },
  analyticsBand: {
    backgroundColor: '#EAF1F7',
    borderBottomColor: '#DDE8F0',
    borderBottomWidth: 1,
    borderTopColor: '#DDE8F0',
    borderTopWidth: 1,
    marginHorizontal: -40,
    marginTop: 38,
    paddingHorizontal: 40,
    paddingVertical: 30,
  },
  analyticsLabel: {
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 2.2,
    lineHeight: 11,
    marginBottom: 20,
  },
  analyticsGrid: {
    flexDirection: 'row',
    gap: 26,
  },
  analyticsColumn: {
    flex: 1,
    minWidth: 0,
  },
  analyticsKicker: {
    color: '#7E94A8',
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 1.2,
    lineHeight: 10,
    marginBottom: 10,
  },
  analyticsValue: {
    color: '#22303C',
    fontFamily: fonts.serif,
    fontSize: 23,
    fontWeight: '400',
    lineHeight: 23,
  },
  analyticsMeta: {
    color: colors.blue,
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
  },
  freqBars: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 12,
  },
  freqBar: {
    borderRadius: 3,
    height: 4,
  },
  textureDots: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 13,
  },
  textureDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  deepLinks: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
    marginTop: 20,
  },
  deepLink: {
    color: colors.blue,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '500',
  },
  deepLinkDot: {
    backgroundColor: '#B9C6D2',
    borderRadius: 1.5,
    height: 3,
    width: 3,
  },
  footer: {
    color: '#B0A894',
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0.72,
    marginTop: 36,
    textAlign: 'center',
  },
  feedback: {
    alignItems: 'center',
    marginTop: 36,
  },
  feedbackText: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 15,
    marginTop: 12,
  },
  notice: {
    backgroundColor: colors.dangerSurface,
    borderColor: colors.dangerBorder,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 28,
    padding: 16,
  },
  noticeText: {
    color: colors.danger,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyState: {
    borderColor: '#E8EEF3',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 16,
    padding: 22,
  },
  emptyTitle: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 24,
    fontWeight: '400',
    marginBottom: 8,
  },
  emptyText: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
  },
  pressed: {
    opacity: 0.72,
  },
});
