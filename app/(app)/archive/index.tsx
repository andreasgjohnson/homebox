import { type Href, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
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

import { MenuButton, StoreyboxDrawer, StoreyboxWordmark } from '@/components/DaybookChrome';
import { ErrorNotice } from '@/components/ErrorNotice';
import {
  type ArchiveAggregate,
  type ArchiveLens,
  type ArchiveMoment,
  buildArchiveMoments,
  getArchivePeriods,
  getFirstName,
  getPersonAggregates,
  getThemeAggregates,
  getTimeAggregates,
  toSlug,
} from '@/lib/archiveView';
import { getProfilePhotoPreviewUrl } from '@/lib/profilePhotos';
import { getProfile, getProfileDisplayName } from '@/lib/profiles';
import { listStoreys, type StoreyListItem } from '@/lib/storeys';
import { supabase } from '@/lib/supabase';
import { colors, fonts, getTextureColor } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

export default function ArchiveScreen() {
  const { lens } = useLocalSearchParams<{ lens?: ArchiveLens }>();
  const router = useRouter();
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const isPhone = width < 700;
  const [storeysFromCloud, setStoreysFromCloud] = useState<StoreyListItem[]>([]);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeLens: ArchiveLens = lens === 'themes' || lens === 'people' ? lens : 'time';

  const hasLoadedRef = useRef(false);

  const loadStoreys = useCallback(async () => {
    if (!session?.user.id) {
      return;
    }

    setIsLoading(!hasLoadedRef.current);
    setErrorMessage(null);

    const [{ data, error }, { data: profile }] = await Promise.all([
      listStoreys(session.user.id),
      getProfile(session.user.id),
    ]);

    if (error) {
      console.warn('Archive load failed:', error.message);
      setErrorMessage("The archive couldn't be reached. Your Storeys are safe.");
    } else {
      setStoreysFromCloud(data ?? []);
      hasLoadedRef.current = true;
    }

    setProfileName(getProfileDisplayName(profile ?? null));
    setProfileAvatarUrl(await getProfilePhotoPreviewUrl(profile?.avatar_url));
    setIsLoading(false);
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      void loadStoreys();
    }, [loadStoreys]),
  );

  const storeys = useMemo(() => buildArchiveMoments(storeysFromCloud), [storeysFromCloud]);
  const themes = useMemo(() => getThemeAggregates(storeys), [storeys]);
  const people = useMemo(() => getPersonAggregates(storeys), [storeys]);
  const timeItems = useMemo(() => getTimeAggregates(storeys), [storeys]);
  const periods = useMemo(() => getArchivePeriods(storeys), [storeys]);
  const firstName = getFirstName(profileName || session?.user.email);
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

  async function signOut() {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    setIsSigningOut(false);
  }

  function navigate(href: Href) {
    setIsDrawerOpen(false);
    router.push(href);
  }

  function setLens(nextLens: ArchiveLens) {
    router.push(`/archive?lens=${nextLens}` as Href);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.screen, isPhone && styles.screenPhone]}>
        {!isPhone ? (
          <IndexRail
            onPersonPress={(name) => router.push(`/people/${toSlug(name)}` as Href)}
            onThemePress={(name) => router.push(`/themes/${toSlug(name)}` as Href)}
            onTimePress={() => setLens('time')}
            people={people}
            themes={themes}
            timeItems={timeItems}
          />
        ) : null}

        <ScrollView contentContainerStyle={[styles.main, isPhone && styles.mainPhone]}>
          <View style={[styles.topRow, isPhone && styles.topRowPhone]}>
            {isPhone ? <View style={styles.mobileTopSpacer} /> : <MenuButton onPress={() => setIsDrawerOpen(true)} />}
            <StoreyboxWordmark />
            <View style={styles.topActions}>
              <Pressable
                accessibilityLabel="Search your archive"
                accessibilityRole="link"
                hitSlop={6}
                onPress={() => router.push('/archive/search' as Href)}
                style={styles.searchPill}
              >
                <Text style={styles.searchText}>Find something</Text>
              </Pressable>
              <Text style={styles.privateLabel}>PRIVATE</Text>
            </View>
          </View>

          <Text style={[styles.title, isPhone && styles.titlePhone]}>Archive</Text>
          <Text style={styles.countLine}>{storeysFromCloud.length} Storeys kept.</Text>

          <LensSwitch activeLens={activeLens} isCompact={isPhone} onChange={setLens} />

          {isLoading ? (
            <View style={styles.feedback}>
              <ActivityIndicator color={colors.ink} />
              <Text style={styles.feedbackText}>Opening your index...</Text>
            </View>
          ) : null}

          {errorMessage ? (
            <ErrorNotice message={errorMessage} onRetry={() => void loadStoreys()} />
          ) : null}

          {!isLoading && !errorMessage && activeLens === 'time' ? (
            <TimeLens isCompact={isPhone} periods={periods} router={router} storeys={storeys} />
          ) : null}

          {!isLoading && !errorMessage && activeLens === 'themes' ? (
            <ThemesLens isCompact={isPhone} router={router} themes={themes} />
          ) : null}

          {!isLoading && !errorMessage && activeLens === 'people' ? (
            <PeopleLens isCompact={isPhone} people={people} router={router} />
          ) : null}

          {!isLoading && !errorMessage && storeys.length ? (
            <View style={styles.pulseBand}>
              <Text style={styles.pulseLabel}>FROM YOUR ARCHIVE</Text>
              <View style={[styles.pulseGrid, isPhone && styles.pulseGridPhone]}>
                {topTheme ? (
                  <Pressable
                    accessibilityLabel={`Top theme: ${topTheme.name}`}
                    accessibilityRole="link"
                    onPress={() => router.push(`/themes/${toSlug(topTheme.name)}` as Href)}
                    style={styles.pulseColumn}
                  >
                    <Text style={styles.pulseKicker}>TOP THEME</Text>
                    <Text style={styles.pulseValue}>{topTheme.name}</Text>
                    <Text style={styles.pulseMeta}>
                      {topTheme.count} {topTheme.count === 1 ? 'Storey' : 'Storeys'}
                    </Text>
                  </Pressable>
                ) : null}
                <View style={styles.pulseColumn}>
                  <Text style={styles.pulseKicker}>LATEST TEXTURE</Text>
                  <Text style={styles.pulseValue}>{topTexture}</Text>
                  <View
                    accessibilityLabel={`Recent textures: ${recentTextures.join(', ')}`}
                    accessible
                    style={styles.pulseDots}
                  >
                    {recentTextures.map((texture) => (
                      <View
                        key={texture}
                        style={[styles.pulseDot, { backgroundColor: getTextureColor(texture) }]}
                      />
                    ))}
                  </View>
                </View>
                {topPerson ? (
                  <Pressable
                    accessibilityLabel={`Who came up: ${topPerson.name}`}
                    accessibilityRole="link"
                    onPress={() => router.push(`/people/${toSlug(topPerson.name)}` as Href)}
                    style={styles.pulseColumn}
                  >
                    <Text style={styles.pulseKicker}>WHO CAME UP</Text>
                    <Text style={styles.pulseValue}>{topPerson.name}</Text>
                    <Text style={styles.pulseMeta}>
                      {topPerson.count} {topPerson.count === 1 ? 'Storey' : 'Storeys'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>

      {!isPhone ? (
        <StoreyboxDrawer
          isOpen={isDrawerOpen}
          isSigningOut={isSigningOut}
          onClose={() => setIsDrawerOpen(false)}
          onNavigate={navigate}
          onSignOut={() => void signOut()}
          returningThemes={themes.slice(0, 4).map((theme) => theme.name)}
          storeyCount={storeysFromCloud.length}
          avatarUrl={profileAvatarUrl}
          userInitial={firstName.slice(0, 1).toUpperCase()}
          userName={profileName || session?.user.email}
        />
      ) : null}
    </SafeAreaView>
  );
}

function IndexRail({
  onPersonPress,
  onThemePress,
  onTimePress,
  people,
  themes,
  timeItems,
}: {
  onPersonPress: (name: string) => void;
  onThemePress: (name: string) => void;
  onTimePress: () => void;
  people: ArchiveAggregate[];
  themes: ArchiveAggregate[];
  timeItems: ArchiveAggregate[];
}) {
  return (
    <View style={styles.rail}>
      <Text style={styles.railTitle}>INDEX</Text>
      {timeItems.length ? (
        <>
          <Text style={styles.railSection}>BY TIME</Text>
          <View style={styles.railGroup}>
            {timeItems.slice(0, 4).map((item, index) => (
              <Pressable
                accessibilityLabel={`${item.name}, ${item.count} Storeys`}
                accessibilityRole="button"
                hitSlop={4}
                key={item.name}
                onPress={onTimePress}
                style={[styles.timeRailItem, index === 0 && styles.timeRailItemActive]}
              >
                <Text style={[styles.timeRailText, index === 0 && styles.timeRailTextActive]}>
                  {item.name}
                </Text>
                <Text style={styles.railCount}>{item.count}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {themes.length ? (
        <>
          <Text style={styles.railSection}>BY THEME</Text>
          <View style={styles.railList}>
            {themes.slice(0, 6).map((item) => (
              <RailEntity key={item.name} item={item} onPress={() => onThemePress(item.name)} />
            ))}
          </View>
        </>
      ) : null}

      {people.length ? (
        <>
          <Text style={styles.railSection}>BY PERSON</Text>
          <View style={styles.railList}>
            {people.slice(0, 6).map((item) => (
              <RailEntity
                key={item.name}
                item={{ ...item, color: '#B08F8C' }}
                onPress={() => onPersonPress(item.name)}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

function RailEntity({ item, onPress }: { item: ArchiveAggregate; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={`${item.name}, ${item.count} Storeys`}
      accessibilityRole="link"
      hitSlop={4}
      onPress={onPress}
      style={styles.railEntity}
    >
      <View style={[styles.railDot, { backgroundColor: item.color }]} />
      <Text style={styles.railEntityName}>{item.name}</Text>
      <Text style={styles.railEntityCount}>{item.count}</Text>
    </Pressable>
  );
}

function LensSwitch({
  activeLens,
  isCompact = false,
  onChange,
}: {
  activeLens: ArchiveLens;
  isCompact?: boolean;
  onChange: (lens: ArchiveLens) => void;
}) {
  return (
    <View style={[styles.lensSwitch, isCompact && styles.lensSwitchPhone]}>
      {(['time', 'themes', 'people'] as ArchiveLens[]).map((nextLens) => (
        <Pressable
          accessibilityLabel={`View by ${nextLens}`}
          accessibilityRole="button"
          accessibilityState={{ selected: activeLens === nextLens }}
          hitSlop={4}
          key={nextLens}
          onPress={() => onChange(nextLens)}
          style={[
            styles.lensPill,
            isCompact && styles.lensPillPhone,
            activeLens === nextLens && styles.lensPillActive,
          ]}
        >
          <Text style={[styles.lensText, activeLens === nextLens && styles.lensTextActive]}>
            {nextLens.slice(0, 1).toUpperCase() + nextLens.slice(1)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function TimeLens({
  isCompact = false,
  periods,
  router,
  storeys,
}: {
  isCompact?: boolean;
  periods: ReturnType<typeof getArchivePeriods>;
  router: ReturnType<typeof useRouter>;
  storeys: ArchiveMoment[];
}) {
  if (!storeys.length) {
    return <EmptyLens message="Your Storeys will gather by season here." />;
  }

  return (
    <View style={styles.timeline}>
      {periods.map((period) => (
        <View key={`${period.label}-${period.sub}`} style={styles.period}>
          <View style={[styles.periodNode, { backgroundColor: period.color }]} />
          <View style={[styles.periodHead, isCompact && styles.periodHeadPhone]}>
            <View style={styles.periodTitleRow}>
              <Text style={styles.periodTitle}>{period.label}</Text>
              <Text style={styles.periodSub}>{period.sub}</Text>
            </View>
            <Text style={styles.periodCount}>{period.count} Storeys</Text>
          </View>
          <Text style={styles.periodThemes}>{period.themes}</Text>
          <View style={styles.periodMoments}>
            {period.moments.map((moment) => (
              <Pressable
                accessibilityLabel={`Open Storey: ${moment.title}, ${moment.stamp}`}
                accessibilityRole="button"
                hitSlop={6}
                key={moment.id}
                onPress={() => router.push(`/archive/${moment.id}` as Href)}
                style={({ pressed }) => [styles.momentRow, pressed && styles.momentRowPressed]}
              >
                <View style={[styles.momentDot, { backgroundColor: moment.textureColor }]} />
                <View style={styles.momentCopy}>
                  <Text style={styles.momentStamp}>{moment.stamp}</Text>
                  <Text numberOfLines={1} style={styles.momentTitle}>
                    {moment.title}
                  </Text>
                  <Text numberOfLines={1} style={styles.momentExcerpt}>
                    {moment.excerpt ? `“${moment.excerpt}”` : 'Still being prepared.'}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function ThemesLens({
  isCompact = false,
  router,
  themes,
}: {
  isCompact?: boolean;
  router: ReturnType<typeof useRouter>;
  themes: ArchiveAggregate[];
}) {
  if (!themes.length) {
    return <EmptyLens message="Themes will surface here as your Storeys find their subjects." />;
  }

  return (
    <View style={styles.themeGrid}>
      {themes.map((theme) => (
        <Pressable
          accessibilityLabel={`Theme: ${theme.name}, ${theme.count} Storeys`}
          accessibilityRole="link"
          key={theme.name}
          onPress={() => router.push(`/themes/${toSlug(theme.name)}` as Href)}
          style={[styles.themeTile, isCompact && styles.themeTilePhone]}
        >
          <View style={[styles.themeEdge, { backgroundColor: theme.color }]} />
          <View style={styles.tileHead}>
            <Text style={styles.tileTitle}>{theme.name}</Text>
            <Text style={styles.tileCount}>{theme.count}</Text>
          </View>
          <Text style={styles.openLink}>Open ›</Text>
        </Pressable>
      ))}
    </View>
  );
}

function PeopleLens({
  isCompact = false,
  people,
  router,
}: {
  isCompact?: boolean;
  people: ArchiveAggregate[];
  router: ReturnType<typeof useRouter>;
}) {
  if (!people.length) {
    return <EmptyLens message="The people your Storeys mention will gather here." />;
  }

  return (
    <View style={[styles.peopleGrid, isCompact && styles.peopleGridPhone]}>
      {people.map((person) => (
        <Pressable
          accessibilityLabel={`Person: ${person.name}, ${person.count} Storeys`}
          accessibilityRole="link"
          key={person.name}
          onPress={() => router.push(`/people/${toSlug(person.name)}` as Href)}
          style={[styles.personTile, isCompact && styles.personTilePhone]}
        >
          <View style={[styles.personAvatar, isCompact && styles.personAvatarPhone]}>
            <Text style={styles.personInitial}>{person.initial ?? person.name.slice(0, 1)}</Text>
          </View>
          <Text style={styles.personName}>{person.name}</Text>
          <Text style={styles.personCount}>{person.count} Storeys</Text>
        </Pressable>
      ))}
    </View>
  );
}

function EmptyLens({ message }: { message: string }) {
  return (
    <View style={styles.emptyLens}>
      <Text style={styles.emptyLensText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
    flexDirection: 'row',
  },
  screenPhone: {
    flexDirection: 'column',
  },
  rail: {
    backgroundColor: colors.rail,
    flexShrink: 0,
    paddingHorizontal: 24,
    paddingVertical: 28,
    width: 282,
  },
  railTitle: {
    color: colors.blueDark,
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 2.64,
    lineHeight: 16,
    marginBottom: 24,
  },
  railSection: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 1.6,
    lineHeight: 14,
    marginBottom: 12,
  },
  railGroup: {
    gap: 2,
    marginBottom: 24,
  },
  timeRailItem: {
    alignItems: 'center',
    borderRadius: 7,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  timeRailItemActive: {
    backgroundColor: '#DDE4EA',
  },
  timeRailText: {
    color: colors.muted,
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    fontWeight: '500',
  },
  timeRailTextActive: {
    color: colors.ink,
    fontWeight: '600',
  },
  railCount: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '400',
  },
  railList: {
    gap: 1,
    marginBottom: 24,
  },
  railEntity: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  railDot: {
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  railEntityName: {
    color: '#3A4350',
    flex: 1,
    fontFamily: fonts.serif,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
  },
  railEntityCount: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
  },
  main: {
    flexGrow: 1,
    paddingBottom: 56,
    paddingHorizontal: 44,
    paddingTop: 30,
  },
  mainPhone: {
    paddingBottom: 44,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  topRowPhone: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    marginHorizontal: -24,
    paddingBottom: 18,
    paddingHorizontal: 24,
  },
  mobileTopSpacer: {
    width: 44,
  },
  topActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  searchPill: {
    borderColor: '#DDE4EA',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  searchText: {
    color: colors.muted,
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    fontWeight: '500',
  },
  privateLabel: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 1.1,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.serifLight,
    fontSize: 44,
    fontWeight: '300',
    lineHeight: 50,
    marginTop: 26,
  },
  titlePhone: {
    fontSize: 34,
    lineHeight: 36,
    marginTop: 30,
  },
  countLine: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 21,
    marginTop: 12,
  },
  lensSwitch: {
    alignSelf: 'flex-start',
    backgroundColor: '#ECE6DB',
    borderRadius: 999,
    flexDirection: 'row',
    marginTop: 22,
    padding: 4,
  },
  lensSwitchPhone: {
    alignSelf: 'stretch',
  },
  lensPill: {
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  lensPillPhone: {
    alignItems: 'center',
    flex: 1,
  },
  lensPillActive: {
    backgroundColor: colors.white,
  },
  lensText: {
    color: colors.muted,
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    fontWeight: '600',
  },
  lensTextActive: {
    color: colors.ink,
  },
  timeline: {
    borderLeftColor: '#E0D8C8',
    borderLeftWidth: 1.5,
    marginTop: 22,
    paddingLeft: 26,
  },
  period: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingVertical: 24,
    position: 'relative',
  },
  periodNode: {
    borderColor: colors.background,
    borderRadius: 9.5,
    borderWidth: 4,
    height: 19,
    left: -36.5,
    position: 'absolute',
    top: 26,
    width: 19,
  },
  periodHead: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  periodHeadPhone: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    gap: 8,
  },
  periodTitleRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 12,
  },
  periodTitle: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 26,
    fontWeight: '400',
    lineHeight: 32,
  },
  periodSub: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '400',
  },
  periodCount: {
    color: colors.blueDark,
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    fontWeight: '500',
  },
  periodThemes: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    marginTop: 8,
  },
  periodMoments: {
    gap: 2,
    marginTop: 14,
  },
  momentRow: {
    alignItems: 'flex-start',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 12,
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  momentRowPressed: {
    backgroundColor: colors.surfaceWarm,
  },
  momentDot: {
    borderRadius: 4,
    height: 8,
    marginTop: 6,
    width: 8,
  },
  momentCopy: {
    flex: 1,
    minWidth: 0,
  },
  momentStamp: {
    color: colors.blueDark,
    fontFamily: fonts.monoBold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    lineHeight: 13,
    marginBottom: 3,
  },
  momentTitle: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 21,
  },
  momentExcerpt: {
    color: colors.muted,
    fontFamily: fonts.serifItalic,
    fontSize: 13,
    fontStyle: 'italic',
    fontWeight: '400',
    lineHeight: 18.2,
    marginTop: 2,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 22,
  },
  themeTile: {
    backgroundColor: colors.white,
    borderColor: '#E7E0D2',
    borderRadius: 16,
    borderWidth: 1,
    flexBasis: '31%',
    flexGrow: 1,
    minWidth: 220,
    overflow: 'hidden',
    padding: 22,
    position: 'relative',
  },
  themeTilePhone: {
    flexBasis: '47%',
    minWidth: 0,
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  themeEdge: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 4,
  },
  tileHead: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tileTitle: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 26,
    fontWeight: '400',
    lineHeight: 32,
  },
  tileCount: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '400',
  },
  openLink: {
    color: colors.blueDark,
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 14,
  },
  peopleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 30,
    marginTop: 26,
  },
  peopleGridPhone: {
    gap: 18,
    justifyContent: 'space-between',
  },
  personTile: {
    alignItems: 'center',
  },
  personTilePhone: {
    width: '29%',
  },
  personAvatar: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: '#E0D8C8',
    borderRadius: 36,
    borderWidth: 1,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  personAvatarPhone: {
    borderRadius: 37,
    height: 74,
    width: 74,
  },
  personInitial: {
    color: colors.blue,
    fontFamily: fonts.serifLight,
    fontSize: 28,
    fontWeight: '300',
  },
  personName: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22,
    marginTop: 11,
  },
  personCount: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    marginTop: 3,
  },
  pulseBand: {
    backgroundColor: colors.surfaceBlue,
    borderColor: colors.blueLine,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 44,
    paddingHorizontal: 26,
    paddingVertical: 24,
  },
  pulseLabel: {
    color: colors.blueDark,
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 2,
    lineHeight: 14,
    marginBottom: 18,
  },
  pulseGrid: {
    flexDirection: 'row',
    gap: 24,
  },
  pulseGridPhone: {
    flexDirection: 'column',
    gap: 18,
  },
  pulseColumn: {
    flex: 1,
    minWidth: 0,
  },
  pulseKicker: {
    color: colors.blueDark,
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 1.2,
    lineHeight: 14,
    marginBottom: 8,
  },
  pulseValue: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 22,
    fontWeight: '400',
    lineHeight: 28,
  },
  pulseMeta: {
    color: colors.blueDark,
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 6,
  },
  pulseDots: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 11,
  },
  pulseDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  emptyLens: {
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 26,
    padding: 22,
  },
  emptyLensText: {
    color: colors.muted,
    fontFamily: fonts.serifItalic,
    fontSize: 18,
    fontStyle: 'italic',
    lineHeight: 25,
  },
  feedback: {
    alignItems: 'center',
    marginTop: 34,
  },
  feedbackText: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 14,
    marginTop: 10,
  },
});
