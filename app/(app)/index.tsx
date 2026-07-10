import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BoxPresenceCard } from '@/components/BoxHardware';
import { DaybookChrome } from '@/components/DaybookChrome';
import {
  buildArchiveMoments,
  getDashboardInsight,
  getFirstName,
  getPersonAggregates,
  getThemeAggregates,
  toSlug,
} from '@/lib/archiveView';
import { defaultBox, fetchPrimaryStoreyBox, type StoreyBox } from '@/lib/box';
import { getProfilePhotoPreviewUrl } from '@/lib/profilePhotos';
import { getProfile, getProfileDisplayName } from '@/lib/profiles';
import { listStoreys, type StoreyListItem } from '@/lib/storeys';
import { supabase } from '@/lib/supabase';
import { colors, fonts, getTextureColor } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

export default function HomeScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isPhone = width < 700;
  const [storeysFromCloud, setStoreysFromCloud] = useState<StoreyListItem[]>([]);
  const [box, setBox] = useState<StoreyBox>(defaultBox);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [isLoadingStoreys, setIsLoadingStoreys] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadStoreys = useCallback(async () => {
    if (!session?.user.id) {
      return;
    }

    setIsLoadingStoreys(true);
    setErrorMessage(null);

    const [{ data, error }, { data: profile }, { box: userBox }] = await Promise.all([
      listStoreys(session.user.id),
      getProfile(session.user.id),
      fetchPrimaryStoreyBox(session.user.id),
    ]);

    if (error) {
      setErrorMessage(error.message);
    } else {
      setStoreysFromCloud(data ?? []);
    }

    setBox(userBox);

    setProfileName(getProfileDisplayName(profile ?? null));
    setProfileAvatarUrl(await getProfilePhotoPreviewUrl(profile?.avatar_url));
    setIsLoadingStoreys(false);
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      void loadStoreys();
    }, [loadStoreys]),
  );

  const firstName = getFirstName(profileName || session?.user.email);
  const storeys = useMemo(() => buildArchiveMoments(storeysFromCloud), [storeysFromCloud]);
  const themes = useMemo(() => getThemeAggregates(storeys), [storeys]);
  const people = useMemo(() => getPersonAggregates(storeys), [storeys]);
  const recentStoreys = storeys.slice(0, 3);
  const returnStorey = recentStoreys[0];
  const topTheme = themes[0];
  const topPerson = people[0];
  const topTexture = storeys[0]?.texture ?? 'Unprocessed';
  const recentTextures = [
    ...new Set(
      storeys
        .slice(0, 5)
        .map((storey) => storey.texture)
        .filter((texture): texture is string => Boolean(texture)),
    ),
  ].slice(0, 3);
  const observation = getDashboardInsight(themes).replace('\n', ' ');
  const capturedByLabel = box.state === 'unpaired' ? 'your Box' : box.name;

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
        onSignOut={() => void signOut()}
        returningThemes={themes.slice(0, 4).map((theme) => theme.name)}
        storeyCount={storeysFromCloud.length}
        userInitial={firstName.slice(0, 1).toUpperCase()}
        userName={profileName || session?.user.email}
      >
        <ScrollView contentContainerStyle={[styles.container, isPhone && styles.containerPhone]}>
          <View style={styles.greetingWrap}>
            <Text style={styles.greeting}>Good {getDayPart()}, {firstName}.</Text>
          </View>

          <BoxPresenceCard box={box} />

          <View style={styles.section}>
            <Text style={styles.eyebrow}>FOR TONIGHT</Text>
            <Pressable
              accessibilityLabel={
                returnStorey ? `Listen back: ${returnStorey.title}` : 'No Storey to revisit yet'
              }
              accessibilityRole="button"
              accessibilityState={{ disabled: !returnStorey }}
              disabled={!returnStorey}
              onPress={() =>
                returnStorey ? router.push(`/archive/${returnStorey.id}` as Href) : undefined
              }
              style={({ pressed }) => [styles.returnShelf, pressed && styles.pressed]}
            >
              <View style={styles.returnHairline} />
              <Text style={styles.returnProvenance}>
                {returnStorey
                  ? `This Storey came from ${capturedByLabel}.`
                  : 'Your Box will place something here when the archive has a little more to hold.'}
              </Text>
              <Text style={styles.returnTitle}>
                {returnStorey?.title ?? 'Your first Storey will return here.'}
              </Text>
              <Text style={styles.returnQuote}>
                "{returnStorey?.excerpt ?? 'The app is listening for what the Box brings home.'}"
              </Text>
              {returnStorey ? <Text style={styles.listenBack}>Listen back</Text> : null}
            </Pressable>
          </View>

          {isLoadingStoreys ? (
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

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.eyebrow}>RECENT STOREYS</Text>
              <Pressable
                accessibilityLabel="See all Storeys"
                accessibilityRole="link"
                hitSlop={12}
                onPress={() => router.push('/archive' as Href)}
              >
                <Text style={styles.allLink}>All →</Text>
              </Pressable>
            </View>

            {recentStoreys.length ? (
              <View style={styles.storeyList}>
                {recentStoreys.map((storey) => (
                  <Pressable
                    accessibilityLabel={`Open Storey: ${storey.title}`}
                    accessibilityRole="button"
                    key={storey.id}
                    onPress={() => router.push(`/archive/${storey.id}` as Href)}
                    style={({ pressed }) => [styles.storeyRow, pressed && styles.pressed]}
                  >
                    <View style={[styles.textureDot, { backgroundColor: storey.textureColor }]} />
                    <View style={styles.storeyCopy}>
                      <View style={styles.metaRow}>
                        <Text style={styles.stamp}>{storey.stamp}</Text>
                        <View style={styles.metaDot} />
                        <Text style={styles.textureLabel}>{storey.texture}</Text>
                      </View>
                      <Text numberOfLines={1} style={styles.storeyTitle}>
                        {storey.title}
                      </Text>
                      <Text numberOfLines={1} style={styles.storeyExcerpt}>
                        "{storey.excerpt}"
                      </Text>
                      <Text style={styles.provenance}>{storey.provenanceLabel}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Your archive is waiting at home.</Text>
                <Text style={styles.emptyText}>
                  Press your Box when something is worth keeping. Storeys will appear here after
                  they sync.
                </Text>
              </View>
            )}
          </View>

          {storeys.length ? (
            <View style={styles.observationBand}>
              <Text style={styles.observation}>{observation}</Text>
            </View>
          ) : null}

          {storeys.length ? (
            <View style={styles.analyticsBand}>
              <View style={styles.analyticsHead}>
                <Text style={styles.analyticsLabel}>FROM YOUR ARCHIVE</Text>
              </View>
              <View style={[styles.analyticsGrid, isPhone && styles.analyticsGridPhone]}>
                {topTheme ? (
                  <Pressable
                    accessibilityLabel={`Top theme: ${topTheme.name}`}
                    accessibilityRole="link"
                    onPress={() => router.push(`/themes/${toSlug(topTheme.name)}` as Href)}
                    style={styles.analyticsColumn}
                  >
                    <Text style={styles.analyticsKicker}>TOP THEME</Text>
                    <Text style={styles.analyticsValue}>{topTheme.name}</Text>
                    <Text style={styles.analyticsMeta}>
                      {topTheme.count} {topTheme.count === 1 ? 'Storey' : 'Storeys'}
                    </Text>
                  </Pressable>
                ) : null}
                <View style={styles.analyticsColumn}>
                  <Text style={styles.analyticsKicker}>LATEST TEXTURE</Text>
                  <Text style={styles.analyticsValue}>{topTexture}</Text>
                  <View style={styles.textureDots}>
                    {recentTextures.map((texture) => (
                      <View
                        key={texture}
                        style={[styles.analyticsDot, { backgroundColor: getTextureColor(texture) }]}
                      />
                    ))}
                  </View>
                </View>
                {topPerson ? (
                  <Pressable
                    accessibilityLabel={`Who came up: ${topPerson.name}`}
                    accessibilityRole="link"
                    onPress={() => router.push(`/people/${toSlug(topPerson.name)}` as Href)}
                    style={styles.analyticsColumn}
                  >
                    <Text style={styles.analyticsKicker}>WHO CAME UP</Text>
                    <Text style={styles.analyticsValue}>{topPerson.name}</Text>
                    <Text style={styles.analyticsMeta}>
                      {topPerson.count} {topPerson.count === 1 ? 'Storey' : 'Storeys'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.deepLinks}>
                <Pressable
                  accessibilityLabel="See all themes"
                  accessibilityRole="link"
                  hitSlop={12}
                  onPress={() => router.push('/archive?lens=themes' as Href)}
                >
                  <Text style={styles.deepLink}>See all themes</Text>
                </Pressable>
                <View style={styles.deepLinkDot} />
                <Pressable
                  accessibilityLabel="See all people"
                  accessibilityRole="link"
                  hitSlop={12}
                  onPress={() => router.push('/archive?lens=people' as Href)}
                >
                  <Text style={styles.deepLink}>See all people</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

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

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  container: {
    alignSelf: 'center',
    maxWidth: 480,
    paddingBottom: 88,
    paddingHorizontal: 28,
    width: '100%',
  },
  containerPhone: {
    maxWidth: undefined,
    paddingBottom: 96,
  },
  greetingWrap: {
    paddingBottom: 18,
    paddingTop: 30,
  },
  greeting: {
    color: colors.muted,
    fontFamily: fonts.serifLightItalic,
    fontSize: 15,
    fontStyle: 'italic',
    fontWeight: '300',
    lineHeight: 20,
  },
  section: {
    marginTop: 26,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  eyebrow: {
    color: colors.blueDark,
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 2.2,
    lineHeight: 13,
  },
  allLink: {
    color: colors.blueDark,
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    fontWeight: '500',
  },
  returnShelf: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 22,
    paddingVertical: 20,
    position: 'relative',
  },
  returnHairline: {
    backgroundColor: colors.blueLine,
    height: 2,
    left: 52,
    opacity: 0.85,
    position: 'absolute',
    right: 52,
    top: 0,
  },
  returnProvenance: {
    color: colors.muted,
    fontFamily: fonts.serifLightItalic,
    fontSize: 13,
    fontStyle: 'italic',
    fontWeight: '300',
    lineHeight: 17,
    marginBottom: 14,
  },
  returnTitle: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 21,
    fontWeight: '400',
    lineHeight: 25.2,
    marginBottom: 10,
  },
  returnQuote: {
    color: colors.muted,
    fontFamily: fonts.serifItalic,
    fontSize: 14,
    fontStyle: 'italic',
    fontWeight: '400',
    lineHeight: 21,
    marginBottom: 16,
  },
  listenBack: {
    color: colors.blueDark,
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    fontWeight: '500',
  },
  feedback: {
    alignItems: 'center',
    marginTop: 28,
  },
  feedbackText: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 14,
    marginTop: 10,
  },
  notice: {
    backgroundColor: colors.dangerSurface,
    borderColor: colors.dangerBorder,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 22,
    padding: 16,
  },
  noticeText: {
    color: colors.danger,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  storeyList: {
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  storeyRow: {
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceWarm,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 13,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  textureDot: {
    borderRadius: 4,
    height: 8,
    marginTop: 5,
    width: 8,
  },
  storeyCopy: {
    flex: 1,
    minWidth: 0,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  stamp: {
    color: colors.blueDark,
    fontFamily: fonts.monoBold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    lineHeight: 13,
  },
  metaDot: {
    backgroundColor: '#CDD9E5',
    borderRadius: 1.5,
    height: 3,
    width: 3,
  },
  textureLabel: {
    color: colors.muted,
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 13,
  },
  storeyTitle: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 20.4,
    marginBottom: 3,
  },
  storeyExcerpt: {
    color: colors.muted,
    fontFamily: fonts.serifItalic,
    fontSize: 13,
    fontStyle: 'italic',
    fontWeight: '400',
    lineHeight: 18.2,
  },
  provenance: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 0.54,
    lineHeight: 13,
    marginTop: 7,
  },
  emptyState: {
    borderColor: '#E8EEF3',
    borderRadius: 14,
    borderWidth: 1,
    padding: 22,
  },
  emptyTitle: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 22,
    fontWeight: '400',
    lineHeight: 26,
    marginBottom: 8,
  },
  emptyText: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
  },
  observationBand: {
    backgroundColor: '#F1EDE4',
    borderColor: '#E8E0D0',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 22,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  observation: {
    color: '#5A6470',
    fontFamily: fonts.serifLightItalic,
    fontSize: 17,
    fontStyle: 'italic',
    fontWeight: '300',
    lineHeight: 27.2,
    textAlign: 'center',
  },
  analyticsBand: {
    backgroundColor: '#EAF1F7',
    borderBottomColor: '#DDE8F0',
    borderBottomWidth: 1,
    borderTopColor: '#DDE8F0',
    borderTopWidth: 1,
    marginHorizontal: -28,
    marginTop: 28,
    paddingHorizontal: 28,
    paddingVertical: 26,
  },
  analyticsHead: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  analyticsLabel: {
    color: colors.blueDark,
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 2,
    lineHeight: 14,
  },
  analyticsGrid: {
    flexDirection: 'row',
    gap: 24,
  },
  analyticsGridPhone: {
    flexDirection: 'column',
    gap: 18,
  },
  analyticsColumn: {
    flex: 1,
    minWidth: 0,
  },
  analyticsKicker: {
    color: colors.blueDark,
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 1.2,
    lineHeight: 14,
    marginBottom: 10,
  },
  analyticsValue: {
    color: '#22303C',
    fontFamily: fonts.serif,
    fontSize: 23,
    fontWeight: '400',
    lineHeight: 29,
  },
  analyticsMeta: {
    color: colors.blueDark,
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
  },
  textureDots: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 13,
  },
  analyticsDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  deepLinks: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
    justifyContent: 'center',
    marginTop: 22,
  },
  deepLink: {
    color: colors.blueDark,
    fontFamily: fonts.sansMedium,
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
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 1.32,
    lineHeight: 15,
    marginTop: 34,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
});
