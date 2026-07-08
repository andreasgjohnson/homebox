import { type Href, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { StoreyboxWordmark } from '@/components/DaybookChrome';
import {
  buildArchiveMoments,
  fromSlug,
  type ArchiveMoment,
} from '@/lib/archiveView';
import { listStoreys, type StoreyListItem } from '@/lib/storeys';
import { colors, fonts, getTextureColor } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

export default function PersonScreen() {
  const { name } = useLocalSearchParams<{ name?: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const isPhone = width < 700;
  const [storeysFromCloud, setStoreysFromCloud] = useState<StoreyListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const personName = fromSlug(name) || 'Dad';

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
  const matchingMoments = moments.filter((moment) =>
    moment.people.some((person) => person.toLowerCase() === personName.toLowerCase()),
  );
  const visibleMoments = matchingMoments;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={[styles.container, isPhone && styles.containerPhone]}>
        <View style={[styles.topBar, isPhone && styles.topBarPhone]}>
          <Pressable onPress={() => router.push('/archive?lens=people' as Href)} style={styles.backLink}>
            <Text style={styles.backChevron}>‹</Text>
            <Text style={styles.backText}>Archive</Text>
          </Pressable>
          <StoreyboxWordmark />
          <Text style={styles.privateLabel}>PRIVATE</Text>
        </View>

        <View style={[styles.header, isPhone && styles.headerPhone]}>
          <View style={[styles.glow, isPhone && styles.glowPhone]} />
          <View style={[styles.avatar, isPhone && styles.avatarPhone]}>
            <Text style={styles.avatarInitial}>{personName.slice(0, 1).toUpperCase()}</Text>
          </View>
          <Text style={styles.eyebrow}>PERSON · {visibleMoments.length} STOREYS</Text>
          <Text style={[styles.title, isPhone && styles.titlePhone]}>{personName}</Text>
        </View>

        {isLoading ? (
          <View style={styles.feedback}>
            <ActivityIndicator color={colors.ink} />
            <Text style={styles.feedbackText}>Opening person...</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{errorMessage}</Text>
          </View>
        ) : null}

        {!isLoading && !errorMessage && visibleMoments.length ? (
          <>
            <TrendPanel personName={personName} />
            <TexturePanel />
            <PeriodDivider count={Math.min(visibleMoments.length, 4)} label="THIS MONTH" />
            <MomentCards moments={visibleMoments.slice(0, 4)} router={router} />
            <View style={styles.reflectionPanel}>
              <Text style={styles.reflectionLabel}>STOREYBOX NOTICED</Text>
              <Text style={styles.reflectionText}>
                One wish keeps returning — to know this person more fully while you can. It might
                be worth asking one more specific question next time.
              </Text>
            </View>
          </>
        ) : null}

        {!isLoading && !errorMessage && !visibleMoments.length ? (
          <EmptyState
            body={
              moments.length
                ? 'No Storeys in your archive mention this person yet.'
                : 'People will appear here after your Box syncs Storeys.'
            }
            title={`No Storeys for ${personName} yet.`}
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

function TrendPanel({ personName }: { personName: string }) {
  const { width } = useWindowDimensions();
  const isPhone = width < 700;
  const bars = [13, 26, 13, 26, 39, 52];

  return (
    <View style={[styles.trendPanel, isPhone && styles.trendPanelPhone]}>
      <View style={styles.trendHead}>
        <Text style={styles.trendLabel}>HOW OFTEN YOU REFLECT ON {personName.toUpperCase()}</Text>
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
        You have reflected on {personName} more this month — the clearest pattern in the archive.
      </Text>
    </View>
  );
}

function TexturePanel() {
  const { width } = useWindowDimensions();
  const isPhone = width < 700;
  const textures = ['Reflective', 'Tender', 'Reflective', 'Warm', 'Tender', 'Curious'];

  return (
    <View style={[styles.texturePanel, isPhone && styles.texturePanelPhone]}>
      <Text style={styles.textureLabel}>HOW THESE MEMORIES HAVE FELT</Text>
      <View style={styles.textureMonths}>
        {textures.map((texture, index) => (
          <View key={`${texture}-${index}`} style={styles.textureMonth}>
            <View style={[styles.textureDot, { backgroundColor: getTextureColor(texture) }]} />
            <Text style={styles.textureMonthLabel}>{['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][index]}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.textureSentence}>
        Tender through the spring, and a little more <Text style={styles.curiousWord}>curious</Text>{' '}
        lately — you keep wanting to ask more.
      </Text>
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
            <Text style={styles.cardExcerpt}>“{moment.excerpt}”</Text>
            <Text style={styles.cardProvenance}>KEPT AT HOME · Captured by your Box</Text>
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
  headerPhone: {
    marginTop: 34,
  },
  glow: {
    height: 240,
    left: '50%',
    pointerEvents: 'none',
    position: 'absolute',
    top: '64%',
    transform: [{ translateX: -220 }, { translateY: -120 }],
    width: 440,
  },
  glowPhone: {
    height: 200,
    transform: [{ translateX: -180 }, { translateY: -100 }],
    width: 360,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 40,
    height: 80,
    justifyContent: 'center',
    marginBottom: 20,
    position: 'relative',
    width: 80,
  },
  avatarPhone: {
    borderRadius: 36,
    height: 72,
    width: 72,
  },
  avatarInitial: {
    color: colors.background,
    fontFamily: fonts.serif,
    fontSize: 32,
    fontWeight: '300',
  },
  eyebrow: {
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 2.2,
    marginBottom: 16,
    position: 'relative',
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 56,
    fontWeight: '300',
    lineHeight: 59,
    position: 'relative',
  },
  titlePhone: {
    fontSize: 46,
    lineHeight: 49,
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
  trendPanelPhone: {
    paddingHorizontal: 22,
    paddingVertical: 22,
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
  texturePanel: {
    borderColor: colors.borderStrong,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 22,
    paddingHorizontal: 30,
    paddingVertical: 24,
  },
  texturePanelPhone: {
    paddingHorizontal: 22,
    paddingVertical: 22,
  },
  textureLabel: {
    color: '#8A939E',
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.98,
    marginBottom: 20,
  },
  textureMonths: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  textureMonth: {
    alignItems: 'center',
    gap: 10,
  },
  textureDot: {
    borderRadius: 8,
    height: 16,
    width: 16,
  },
  textureMonthLabel: {
    color: '#A6A092',
    fontFamily: fonts.mono,
    fontSize: 10,
  },
  textureSentence: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 18,
    textAlign: 'center',
  },
  curiousWord: {
    color: '#8A7790',
    fontWeight: '600',
  },
  periodDivider: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    marginTop: 38,
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
  cardProvenance: {
    color: '#B0A894',
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '400',
    letterSpacing: 0.54,
    lineHeight: 9,
    marginTop: 8,
  },
  duration: {
    alignSelf: 'center',
    color: '#A6A092',
    fontFamily: fonts.mono,
    fontSize: 12,
  },
  reflectionPanel: {
    backgroundColor: '#EDF1F4',
    borderRadius: 16,
    marginTop: 34,
    paddingHorizontal: 32,
    paddingVertical: 28,
  },
  reflectionLabel: {
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.98,
    marginBottom: 14,
    textAlign: 'center',
  },
  reflectionText: {
    color: colors.charcoal,
    fontFamily: fonts.serif,
    fontSize: 19,
    fontWeight: '400',
    lineHeight: 29.45,
    textAlign: 'center',
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
