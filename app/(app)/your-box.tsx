import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomTabBar, StoreyboxWordmark } from '@/components/DaybookChrome';
import { BoxIllustration, BoxStatusBadge } from '@/components/BoxHardware';
import { defaultBox, getBoxStateDetail } from '@/lib/box';
import { colors, fonts } from '@/lib/theme';

export default function YourBoxScreen() {
  const box = defaultBox;
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
          <BoxStatusBadge box={box} />
        </View>

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

        <View style={styles.panel}>
          <Text style={styles.mutedLabel}>OPTIONAL NOTIFICATIONS</Text>
          {[
            { isOn: true, label: 'A Storey is ready to revisit' },
            { isOn: true, label: 'A new Storey has arrived' },
            { isOn: false, label: 'A prompt waiting at home' },
          ].map(({ isOn, label }) => (
            <View key={label} style={styles.notificationRow}>
              <Text style={styles.notificationLabel}>{label}</Text>
              <View style={[styles.toggleTrack, !isOn && styles.toggleTrackOff]}>
                <View style={[styles.toggleKnob, !isOn && styles.toggleKnobOff]} />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <BottomTabBar activeTab="box" />
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
    paddingBottom: 96,
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
    lineHeight: 31,
    marginBottom: 8,
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
    color: '#5A6470',
    fontFamily: fonts.sans,
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
    color: colors.blue,
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
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 1.8,
    lineHeight: 10,
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
    color: '#8A939E',
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 1.8,
    lineHeight: 10,
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
    color: '#9AA1AB',
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '400',
  },
  notificationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  notificationLabel: {
    color: '#3A4350',
    flex: 1,
    fontFamily: fonts.serif,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19.6,
  },
  toggleTrack: {
    backgroundColor: colors.blue,
    borderRadius: 999,
    height: 24,
    position: 'relative',
    width: 40,
  },
  toggleTrackOff: {
    backgroundColor: '#DDE4EA',
  },
  toggleKnob: {
    backgroundColor: colors.white,
    borderRadius: 9,
    elevation: 2,
    height: 18,
    left: 19,
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { height: 1, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    top: 3,
    width: 18,
  },
  toggleKnobOff: {
    left: 3,
  },
});
