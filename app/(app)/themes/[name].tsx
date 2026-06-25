import { type Href, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
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

import {
  buildArchiveMoments,
  fromSlug,
  getThemeAggregates,
  type ArchiveMoment,
} from '@/lib/archiveView';
import { listMemories, type MemoryListItem } from '@/lib/memories';
import { colors, fonts, getTextureColor } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

const glowStyle = {
  backgroundImage: 'radial-gradient(ellipse,#c7dcec,transparent 68%)',
} as unknown as ViewStyle;

const washStyle = {
  backgroundImage: 'linear-gradient(180deg,#eaf1f7,#eef3f7)',
} as unknown as ViewStyle;

export default function ThemeScreen() {
  const { name } = useLocalSearchParams<{ name?: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [memories, setMemories] = useState<MemoryListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const themeName = fromSlug(name) || 'Home';

  const loadMemories = useCallback(async () => {
    if (!session?.user.id) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    const { data, error } = await listMemories(session.user.id);

    if (error) {
      setErrorMessage(error.message);
    } else {
      setMemories(data ?? []);
    }

    setIsLoading(false);
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      void loadMemories();
    }, [loadMemories]),
  );

  const moments = useMemo(() => buildArchiveMoments(memories), [memories]);
  const themes = useMemo(() => getThemeAggregates(moments), [moments]);
  const theme = themes.find((item) => item.name.toLowerCase() === themeName.toLowerCase());
  const matchingMoments = moments.filter((moment) =>
    moment.tags.some((tag) => tag.toLowerCase() === themeName.toLowerCase()),
  );
  const visibleMoments = matchingMoments.length ? matchingMoments : moments.slice(0, 4);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.push('/memories?lens=themes' as Href)} style={styles.backLink}>
            <Text style={styles.backChevron}>‹</Text>
            <Text style={styles.backText}>Memories</Text>
          </Pressable>
          <Text style={styles.wordmark}>STOREYBOX</Text>
          <Text style={styles.privateLabel}>PRIVATE</Text>
        </View>

        <View style={styles.header}>
          <View style={[styles.glow, glowStyle]} />
          <Text style={styles.eyebrow}>THEME · {theme?.count ?? visibleMoments.length} MOMENTS · RISING</Text>
          <Text style={styles.title}>{themeName}</Text>
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

        {!isLoading && !errorMessage ? (
          <>
            <TrendPanel label={`HOW OFTEN ${themeName.toUpperCase()} COMES UP`} />
            <PeriodDivider count={Math.min(visibleMoments.length, 3)} label="THIS MONTH" />
            <MomentCards moments={visibleMoments.slice(0, 3)} router={router} />
            <PeriodDivider count={Math.max(visibleMoments.length - 3, 0)} label="EARLIER THIS SPRING" />
            <MomentCards moments={visibleMoments.slice(3, 6)} router={router} />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function TrendPanel({ label }: { label: string }) {
  const bars = [12, 18, 18, 29, 40, 52];

  return (
    <View style={[styles.trendPanel, washStyle]}>
      <View style={styles.trendHead}>
        <Text style={styles.trendLabel}>{label}</Text>
        <Text style={styles.trendRange}>Past 6 months</Text>
      </View>
      <View style={styles.bars}>
        {bars.map((height, index) => (
          <View key={`${height}-${index}`} style={styles.barWrap}>
            <View style={styles.barSlot}>
              <View
                style={[
                  styles.bar,
                  {
                    backgroundColor: index === bars.length - 1 ? colors.blue : '#BCCCD9',
                    height,
                  },
                ]}
              />
            </View>
            <Text style={styles.barLabel}>{['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][index]}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.takeaway}>
        This theme has been rising since April — and it keeps arriving in the same breath as
        the future.
      </Text>
    </View>
  );
}

function PeriodDivider({ count, label }: { count: number; label: string }) {
  return (
    <View style={styles.periodDivider}>
      <Text style={styles.periodLabel}>{label}</Text>
      <View style={styles.periodRule} />
      <Text style={styles.periodCount}>{count} moments</Text>
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
          key={moment.id}
          onPress={() => router.push(`/memories/${moment.id}` as Href)}
          style={[styles.card, { borderLeftColor: moment.textureColor }]}
        >
          <View style={styles.cardBody}>
            <View style={styles.cardMetaRow}>
              <Text style={styles.cardStamp}>{moment.stamp}</Text>
              <Text style={styles.cardTexture}>{moment.texture} · {moment.primaryTheme}</Text>
            </View>
            <Text style={styles.cardTitle}>{moment.title}</Text>
            <Text style={styles.cardExcerpt}>“{moment.excerpt}”</Text>
          </View>
          <Text style={styles.duration}>3:48</Text>
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
  backLink: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  backChevron: {
    color: '#5A6470',
    fontFamily: fonts.serif,
    fontSize: 22,
    lineHeight: 16,
  },
  backText: {
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
  privateLabel: {
    color: '#A6A092',
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.32,
  },
  header: {
    alignItems: 'center',
    marginTop: 46,
    position: 'relative',
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
  eyebrow: {
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 2.2,
    marginBottom: 18,
    position: 'relative',
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 58,
    fontWeight: '300',
    lineHeight: 61,
    position: 'relative',
  },
  trendPanel: {
    backgroundColor: '#EAF1F7',
    borderColor: '#DDE8F0',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 40,
    paddingHorizontal: 30,
    paddingVertical: 26,
  },
  trendHead: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  trendLabel: {
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.98,
  },
  trendRange: {
    color: '#7E94A8',
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '500',
  },
  bars: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    height: 64,
    justifyContent: 'space-between',
  },
  barWrap: {
    alignItems: 'center',
    gap: 9,
  },
  barSlot: {
    alignItems: 'center',
    height: 54,
    justifyContent: 'flex-end',
    width: 34,
  },
  bar: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    width: 14,
  },
  barLabel: {
    color: '#8A9BAB',
    fontFamily: fonts.mono,
    fontSize: 10,
  },
  takeaway: {
    borderTopColor: '#DBE6EF',
    borderTopWidth: 1,
    color: '#3A4A58',
    fontFamily: fonts.serif,
    fontSize: 17,
    fontStyle: 'italic',
    fontWeight: '400',
    lineHeight: 25.5,
    marginTop: 20,
    paddingTop: 18,
    textAlign: 'center',
  },
  periodDivider: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    marginTop: 42,
  },
  periodLabel: {
    color: colors.blue,
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
    color: '#A6A092',
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
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
  },
  cardTexture: {
    color: colors.muted,
    fontFamily: fonts.sans,
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
    fontFamily: fonts.serif,
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 21.75,
  },
  duration: {
    alignSelf: 'center',
    color: '#A6A092',
    fontFamily: fonts.mono,
    fontSize: 12,
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
});
