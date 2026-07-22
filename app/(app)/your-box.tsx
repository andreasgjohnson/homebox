import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StoreyboxWordmark } from '@/components/DaybookChrome';
import { BoxIllustration, BoxStatusBadge } from '@/components/BoxHardware';
import { ErrorNotice } from '@/components/ErrorNotice';
import { defaultBox, fetchPrimaryStoreyBox, getBoxStateDetail, type StoreyBox } from '@/lib/box';
import { colors, fonts } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

export default function YourBoxScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [box, setBox] = useState<StoreyBox>(defaultBox);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasLoadedRef = useRef(false);

  const loadBox = useCallback(async () => {
    if (!session?.user.id) {
      return;
    }

    setIsLoading(!hasLoadedRef.current);
    const { box: userBox, error } = await fetchPrimaryStoreyBox(session.user.id);

    if (error) {
      console.warn('Box status load failed:', error);
    } else {
      hasLoadedRef.current = true;
    }

    setBox(userBox);
    setErrorMessage(
      error ? "Your Box couldn't be reached just now. Your Storeys are safe." : null,
    );
    setIsLoading(false);
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      void loadBox();
    }, [loadBox]),
  );

  const boxDetail = getBoxStateDetail(box);
  const isPaired = box.state !== 'unpaired';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <View style={styles.topSpacer} />
        <StoreyboxWordmark />
        <View style={styles.topSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <View style={styles.boxStage}>
            <View style={styles.glow} />
            <BoxIllustration size={118} ledColor={boxDetail.ledColor} />
          </View>
          <Text style={styles.boxName}>{box.name}</Text>
          {isLoading ? <ActivityIndicator color={colors.ink} /> : <BoxStatusBadge box={box} />}
          {!isLoading && !isPaired ? (
            <>
              <Pressable
                accessibilityLabel="Set up your Box"
                accessibilityRole="button"
                onPress={() => router.push('/setup-box' as Href)}
                style={styles.pairButton}
              >
                <Text style={styles.pairButtonText}>Set up your Box</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Enter a pairing code"
                accessibilityRole="button"
                onPress={() => router.push('/pair-box' as Href)}
                style={styles.pairCodeLink}
              >
                <Text style={styles.pairCodeLinkText}>Already online? Enter a pairing code</Text>
              </Pressable>
            </>
          ) : null}
        </View>

        {errorMessage ? (
          <ErrorNotice message={errorMessage} onRetry={() => void loadBox()} />
        ) : null}

        <View style={styles.table}>
          {[
            {
              label: 'Connection',
              value: isPaired ? (box.connection === 'wifi' ? 'Wi-Fi connected' : 'Offline') : 'Not paired yet',
            },
            { label: 'Last sync', value: box.lastSync ? formatBoxDate(box.lastSync) : 'Waiting for pairing' },
            {
              label: 'Last Storey received',
              value: box.lastStoreyAt ? formatBoxDate(box.lastStoreyAt) : 'No Storeys yet',
            },
            { label: 'Location', value: box.location ?? 'Choose during pairing' },
            { label: 'Status', value: isPaired ? boxDetail.cardTitle.replace(/\.$/, '') : 'Pairing required' },
          ].map(({ label, value }) => (
            <View key={label} style={styles.tableRow}>
              <Text style={styles.tableLabel}>{label}</Text>
              <Text style={[styles.tableValue, label === 'Connection' && styles.tableValueBlue]}>
                {value}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.privacyCard}>
          <Text style={styles.blueLabel}>PRIVACY</Text>
          <Text style={styles.privacyText}>
            Your Box only captures when you press it.{'\n'}Your Storeys stay private unless you
            choose otherwise.
          </Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.mutedLabel}>WHAT THE LIGHT MEANS</Text>
          {[
            { color: '#C0883F', description: 'Listening', label: 'Amber, breathing' },
            { color: '#5B7895', description: 'Syncing', label: 'Blue, pulsing' },
            { color: '#CDD9E5', description: 'Ready', label: 'Soft white, steady' },
            { color: '#283040', description: 'Resting', label: 'Off' },
          ].map(({ color, description, label }) => (
            <View key={label} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <Text style={styles.legendLabel}>{label}</Text>
              <Text style={styles.legendDescription}>{description}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function formatBoxDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
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
    paddingBottom: 40,
    paddingHorizontal: 28,
    width: '100%',
  },
  hero: {
    alignItems: 'center',
    paddingBottom: 28,
    paddingTop: 36,
  },
  boxStage: {
    alignItems: 'center',
    height: 150,
    justifyContent: 'center',
    marginBottom: 22,
    position: 'relative',
    width: 180,
  },
  glow: {
    backgroundColor: '#BCD2E6',
    borderRadius: 90,
    height: 180,
    opacity: 0.28,
    position: 'absolute',
    width: 180,
  },
  boxName: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 35,
    marginBottom: 8,
  },
  pairButton: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 999,
    marginTop: 16,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  pairButtonText: {
    color: colors.background,
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    fontWeight: '600',
  },
  pairCodeLink: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    minHeight: 44,
  },
  pairCodeLinkText: {
    color: colors.blueDark,
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    fontWeight: '500',
  },
  table: {
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
  },
  tableRow: {
    alignItems: 'center',
    borderBottomColor: '#F0E8DA',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  tableLabel: {
    color: colors.muted,
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    fontWeight: '500',
  },
  tableValue: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '400',
  },
  tableValueBlue: {
    color: colors.blueDark,
  },
  privacyCard: {
    backgroundColor: '#EDF3F8',
    borderColor: colors.blueLine,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
    paddingHorizontal: 22,
    paddingVertical: 20,
  },
  blueLabel: {
    color: colors.blueDark,
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 1.8,
    lineHeight: 14,
    marginBottom: 11,
  },
  privacyText: {
    color: '#3A4A58',
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 24.75,
  },
  panel: {
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
    paddingHorizontal: 22,
    paddingVertical: 20,
  },
  mutedLabel: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 1.8,
    lineHeight: 14,
    marginBottom: 14,
  },
  legendRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 6,
  },
  legendDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  legendLabel: {
    color: '#3A4350',
    flex: 1,
    fontFamily: fonts.serif,
    fontSize: 14,
    fontWeight: '400',
  },
  legendDescription: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '400',
  },
});
