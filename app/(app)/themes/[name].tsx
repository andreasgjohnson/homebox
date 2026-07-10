import { type Href, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
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

import { StoreyboxWordmark } from '@/components/DaybookChrome';
import { Icon } from '@/components/Icon';
import {
  buildArchiveMoments,
  fromSlug,
  getThemeAggregates,
  type ArchiveMoment,
} from '@/lib/archiveView';
import { listStoreys, type StoreyListItem } from '@/lib/storeys';
import { colors, fonts } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

export default function ThemeScreen() {
  const { name } = useLocalSearchParams<{ name?: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const isPhone = width < 700;
  const [storeysFromCloud, setStoreysFromCloud] = useState<StoreyListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const themeName = fromSlug(name) || 'This theme';

  const loadStoreys = useCallback(async () => {
    if (!session?.user.id) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    const { data, error } = await listStoreys(session.user.id);

    if (error) {
      setErrorMessage(error.message);
    } else {
      setStoreysFromCloud(data ?? []);
    }

    setIsLoading(false);
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      void loadStoreys();
    }, [loadStoreys]),
  );

  const moments = useMemo(() => buildArchiveMoments(storeysFromCloud), [storeysFromCloud]);
  const themes = useMemo(() => getThemeAggregates(moments), [moments]);
  const theme = themes.find((item) => item.name.toLowerCase() === themeName.toLowerCase());
  const matchingMoments = moments.filter((moment) =>
    moment.tags.some((tag) => tag.toLowerCase() === themeName.toLowerCase()),
  );
  const visibleMoments = matchingMoments;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={[styles.container, isPhone && styles.containerPhone]}>
        <View style={[styles.topBar, isPhone && styles.topBarPhone]}>
          <Pressable
            accessibilityLabel="Back to Archive"
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => router.push('/archive?lens=themes' as Href)}
            style={styles.backLink}
          >
            <Icon color={colors.muted} fallbackGlyph="‹" name="chevron.left" size={15} />
            <Text style={styles.backText}>Archive</Text>
          </Pressable>
          <StoreyboxWordmark />
          <Text style={styles.privateLabel}>PRIVATE</Text>
        </View>

        <View style={[styles.header, isPhone && styles.headerPhone]}>
          <View style={[styles.glow, isPhone && styles.glowPhone]} />
          <Text style={styles.eyebrow}>THEME · {theme?.count ?? visibleMoments.length} STOREYS</Text>
          <Text style={[styles.title, isPhone && styles.titlePhone]}>{themeName}</Text>
        </View>

        {isLoading ? (
          <View style={styles.feedback}>
            <ActivityIndicator color={colors.ink} />
            <Text style={styles.feedbackText}>Opening theme...</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{errorMessage}</Text>
          </View>
        ) : null}

        {!isLoading && !errorMessage && visibleMoments.length ? (
          <>
            <PeriodDivider count={visibleMoments.length} label="STOREYS" />
            <MomentCards moments={visibleMoments} router={router} />
          </>
        ) : null}

        {!isLoading && !errorMessage && !visibleMoments.length ? (
          <EmptyState
            body={
              moments.length
                ? 'No Storeys in your archive carry this theme yet.'
                : 'Storeys will appear here after your Box syncs.'
            }
            title={`No ${themeName} Storeys yet.`}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function EmptyState({ body, title }: { body: string; title: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{body}</Text>
    </View>
  );
}

function PeriodDivider({ count, label }: { count: number; label: string }) {
  return (
    <View style={styles.periodDivider}>
      <Text style={styles.periodLabel}>{label}</Text>
      <View style={styles.periodRule} />
      <Text style={styles.periodCount}>{count} Storeys</Text>
    </View>
  );
}

function MomentCards({
  moments,
  router,
}: {
  moments: ArchiveMoment[];
  router: ReturnType<typeof useRouter>;
}) {
  if (!moments.length) {
    return null;
  }

  return (
    <View style={styles.cards}>
      {moments.map((moment) => (
        <Pressable
          accessibilityLabel={`Open Storey: ${moment.title}`}
          accessibilityRole="button"
          key={moment.id}
          onPress={() => router.push(`/archive/${moment.id}` as Href)}
          style={[styles.card, { borderLeftColor: moment.textureColor }]}
        >
          <View style={styles.cardBody}>
            <View style={styles.cardMetaRow}>
              <Text style={styles.cardStamp}>{moment.stamp}</Text>
              <Text style={styles.cardTexture}>{moment.texture} · {moment.primaryTheme}</Text>
            </View>
            <Text style={styles.cardTitle}>{moment.title}</Text>
            <Text style={styles.cardExcerpt}>
              {moment.excerpt ? `“${moment.excerpt}”` : 'Still being prepared.'}
            </Text>
            <Text style={styles.cardProvenance}>{moment.provenanceLabel}</Text>
          </View>
        </Pressable>
      ))}
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
    maxWidth: 760,
    paddingBottom: 64,
    paddingHorizontal: 40,
    width: '100%',
  },
  containerPhone: {
    maxWidth: undefined,
    paddingBottom: 44,
    paddingHorizontal: 24,
  },
  topBar: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: -40,
    paddingHorizontal: 40,
    paddingVertical: 22,
  },
  topBarPhone: {
    marginHorizontal: -24,
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
  backLink: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
  },
  backText: {
    color: colors.muted,
    fontFamily: fonts.sansMedium,
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
  privateLabel: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.32,
  },
  header: {
    alignItems: 'center',
    marginTop: 46,
    position: 'relative',
  },
  headerPhone: {
    marginTop: 34,
  },
  glow: {
    height: 220,
    left: '50%',
    pointerEvents: 'none',
    position: 'absolute',
    top: '62%',
    transform: [{ translateX: -220 }, { translateY: -110 }],
    width: 440,
  },
  glowPhone: {
    height: 200,
    transform: [{ translateX: -180 }, { translateY: -100 }],
    width: 360,
  },
  eyebrow: {
    color: colors.blueDark,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 2.2,
    marginBottom: 18,
    position: 'relative',
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.serifLight,
    fontSize: 58,
    fontWeight: '300',
    lineHeight: 66,
    position: 'relative',
  },
  titlePhone: {
    fontSize: 46,
    lineHeight: 53,
  },
  periodDivider: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    marginTop: 42,
  },
  periodLabel: {
    color: colors.blueDark,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 2.2,
  },
  periodRule: {
    backgroundColor: colors.blueLine,
    flex: 1,
    height: 1,
  },
  periodCount: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 11,
  },
  cards: {
    gap: 12,
    marginTop: 16,
  },
  card: {
    backgroundColor: colors.surfaceWarm,
    borderColor: '#E8EEF3',
    borderLeftWidth: 4,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 18,
    paddingHorizontal: 22,
    paddingVertical: 18,
  },
  cardBody: {
    flex: 1,
  },
  cardMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  cardStamp: {
    color: colors.blueDark,
    fontFamily: fonts.monoBold,
    fontSize: 11,
    fontWeight: '700',
  },
  cardTexture: {
    color: colors.muted,
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    fontWeight: '600',
  },
  cardTitle: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 21,
    fontWeight: '400',
    lineHeight: 25.2,
    marginBottom: 5,
  },
  cardExcerpt: {
    color: colors.muted,
    fontFamily: fonts.serifItalic,
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 21.75,
  },
  cardProvenance: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 0.54,
    lineHeight: 13,
    marginTop: 8,
  },
  feedback: {
    alignItems: 'center',
    marginTop: 32,
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
    marginTop: 24,
    padding: 16,
  },
  noticeText: {
    color: colors.danger,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 28,
    paddingHorizontal: 24,
    paddingVertical: 30,
  },
  emptyTitle: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 24,
    fontWeight: '400',
    lineHeight: 29,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.muted,
    fontFamily: fonts.serif,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'center',
  },
});
