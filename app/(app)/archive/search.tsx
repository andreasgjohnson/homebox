import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StoreyboxWordmark } from '@/components/DaybookChrome';
import { Icon } from '@/components/Icon';
import { buildArchiveMoments, getThemeAggregates, toSlug } from '@/lib/archiveView';
import { listStoreys, type StoreyListItem } from '@/lib/storeys';
import { colors, fonts } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

export default function ArchiveSearchScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [storeysFromCloud, setStoreysFromCloud] = useState<StoreyListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [query, setQuery] = useState('');

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

  const storeys = useMemo(() => buildArchiveMoments(storeysFromCloud), [storeysFromCloud]);
  const themes = useMemo(() => getThemeAggregates(storeys), [storeys]);
  const filteredStoreys = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    if (!cleanQuery) {
      return [];
    }

    return storeys
      .filter((storey) =>
        [storey.title, storey.excerpt, storey.primaryTheme, ...storey.tags, ...storey.people]
          .join(' ')
          .toLowerCase()
          .includes(cleanQuery),
      )
      .slice(0, 8);
  }, [query, storeys]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Back to Archive"
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => router.replace('/archive' as Href)}
          style={styles.backLink}
        >
          <Icon color={colors.muted} fallbackGlyph="‹" name="chevron.left" size={15} />
          <Text style={styles.backText}>Archive</Text>
        </Pressable>
        <StoreyboxWordmark />
        <Text style={styles.privateLabel}>PRIVATE</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.searchLine}>
          <TextInput
            accessibilityLabel="Search your archive"
            autoCapitalize="none"
            onChangeText={setQuery}
            placeholder="Find something you left behind"
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
        </View>

        {isLoading ? (
          <View style={styles.feedback}>
            <ActivityIndicator color={colors.ink} />
            <Text style={styles.feedbackText}>Opening search...</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{errorMessage}</Text>
          </View>
        ) : null}

        {filteredStoreys.length ? (
          <View style={styles.block}>
            <Text style={styles.label}>FOUND IN YOUR ARCHIVE</Text>
            {filteredStoreys.map((storey) => (
              <Pressable
                accessibilityLabel={`Open Storey: ${storey.title}`}
                accessibilityRole="button"
                key={storey.id}
                onPress={() => router.push(`/archive/${storey.id}` as Href)}
                style={styles.resultRow}
              >
                <View style={[styles.dot, { backgroundColor: storey.textureColor }]} />
                <View style={styles.resultCopy}>
                  <Text style={styles.resultTitle}>{storey.title}</Text>
                  <Text numberOfLines={1} style={styles.resultExcerpt}>
                    {storey.excerpt ? `"${storey.excerpt}"` : 'Still being prepared.'}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        {!isLoading && !errorMessage && query.trim() && !filteredStoreys.length ? (
          <View style={styles.block}>
            <Text style={styles.label}>NOTHING FOUND</Text>
            <Text style={styles.emptyText}>
              Nothing in your archive matches "{query.trim()}". Try a person, a place, or a word
              you remember saying.
            </Text>
          </View>
        ) : null}

        {themes.length ? (
          <View style={styles.block}>
            <Text style={styles.label}>THEMES IN YOUR ARCHIVE</Text>
            <View style={styles.themeChips}>
              {themes.map((theme) => (
                <Pressable
                  accessibilityLabel={`Theme: ${theme.name}`}
                  accessibilityRole="link"
                  key={theme.name}
                  onPress={() => router.push(`/themes/${toSlug(theme.name)}` as Href)}
                  style={styles.themeChip}
                >
                  <View style={[styles.dot, { backgroundColor: theme.color }]} />
                  <Text style={styles.themeText}>{theme.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
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
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
  backLink: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minHeight: 44,
    minWidth: 86,
  },
  backText: {
    color: colors.muted,
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    fontWeight: '500',
  },
  privateLabel: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    minWidth: 86,
    textAlign: 'right',
  },
  container: {
    alignSelf: 'center',
    maxWidth: 640,
    padding: 28,
    width: '100%',
  },
  searchLine: {
    borderBottomColor: '#CDD9E5',
    borderBottomWidth: 1.5,
    paddingBottom: 10,
  },
  searchInput: {
    color: colors.ink,
    fontFamily: fonts.serifLightItalic,
    fontSize: 18,
    fontStyle: 'italic',
    fontWeight: '300',
    padding: 0,
  },
  block: {
    marginTop: 30,
  },
  label: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 2,
    lineHeight: 14,
    marginBottom: 14,
  },
  emptyText: {
    color: colors.muted,
    fontFamily: fonts.serifItalic,
    fontSize: 16,
    fontStyle: 'italic',
    lineHeight: 24,
  },
  themeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  themeChip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: '#DDE4EA',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  dot: {
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  themeText: {
    color: '#3A4350',
    fontFamily: fonts.serif,
    fontSize: 14,
    fontWeight: '400',
  },
  resultRow: {
    alignItems: 'center',
    borderBottomColor: '#F0E8DA',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 13,
  },
  resultCopy: {
    flex: 1,
  },
  resultTitle: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 20,
  },
  resultExcerpt: {
    color: colors.muted,
    fontFamily: fonts.serifItalic,
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
    marginTop: 3,
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
