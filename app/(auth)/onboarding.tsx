import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BoxIllustration } from '@/components/BoxHardware';
import { colors, fonts } from '@/lib/theme';

const locations = ['Bedside', 'Desk', 'Kitchen', 'Living room', 'Custom'];

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [selectedLocation, setSelectedLocation] = useState('Bedside');
  const isLastStep = step === 3;

  function next() {
    if (isLastStep) {
      router.replace('/login' as Href);
      return;
    }

    setStep((current) => Math.min(current + 1, 3));
  }

  function back() {
    if (step === 0) {
      router.replace('/' as Href);
      return;
    }

    setStep((current) => Math.max(current - 1, 0));
  }

  return (
    <View style={styles.screen}>
      <View style={styles.progress}>
        {[0, 1, 2, 3].map((item) => (
          <View
            key={item}
            style={[
              styles.progressDot,
              step === item && styles.progressDotActive,
              { backgroundColor: step === item ? colors.ink : '#DDE4EA' },
            ]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 0 ? (
          <View style={styles.centerStep}>
            <View style={styles.softGlow} />
            <Text style={styles.wordmark}>STOREYBOX HOME</Text>
            <Text style={styles.heroTitle}>Welcome home.</Text>
            <Text style={styles.body}>
              Your Box is a private place to leave the moments you want to keep.
            </Text>
          </View>
        ) : null}

        {step === 1 ? (
          <View style={styles.centerStep}>
            <View style={styles.boxStage}>
              <View style={styles.softCircle} />
              <BoxIllustration size={110} ledColor="#5B7895" />
            </View>
            <View style={styles.connectedPill}>
              <View style={styles.connectedDot} />
              <Text style={styles.connectedText}>Pairing starts after setup</Text>
            </View>
            <Text style={styles.stepTitle}>Pair your Box.</Text>
            <Text style={styles.bodySmall}>Where does it live?</Text>
            <View style={styles.locationWrap}>
              {locations.map((location) => {
                const isSelected = selectedLocation === location;

                return (
                  <Pressable
                    key={location}
                    onPress={() => setSelectedLocation(location)}
                    style={[styles.locationChip, isSelected && styles.locationChipSelected]}
                  >
                    <Text style={[styles.locationText, isSelected && styles.locationTextSelected]}>
                      {location}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.centerStep}>
            <View style={styles.ritualIcon}>
              <View style={styles.amberRingOuter} />
              <View style={styles.amberRingInner} />
              <View style={styles.ritualCore}>
                <View style={styles.ritualLens} />
                <View style={styles.ritualLed} />
              </View>
            </View>
            <Text style={styles.stepTitle}>The ritual.</Text>
            <View style={styles.ritualCard}>
              <RitualRow number="1">Press once to begin.</RitualRow>
              <View style={styles.ritualRule} />
              <RitualRow number="2">Press again when you are done.</RitualRow>
              <View style={styles.ritualRule} />
              <View style={styles.ritualRow}>
                <View style={styles.checkBadge}>
                  <Text style={styles.checkText}>✓</Text>
                </View>
                <Text style={styles.ritualNote}>Your voice stays yours.</Text>
              </View>
            </View>
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.centerStep}>
            <View style={styles.softGlow} />
            <View style={styles.readyBadge}>
              <Text style={styles.readyCheck}>✓</Text>
            </View>
            <Text style={styles.heroTitle}>Your Box is ready.</Text>
            <Text style={styles.body}>
              The app will keep what you leave with your {selectedLocation} Box.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={back} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Back</Text>
        </Pressable>
        <Pressable onPress={next} style={styles.primaryButton}>
          <Text style={styles.primaryText}>{isLastStep ? 'Finish setup' : 'Continue'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function RitualRow({ children, number }: { children: string; number: string }) {
  return (
    <View style={styles.ritualRow}>
      <View style={styles.numberBadge}>
        <Text style={styles.numberText}>{number}</Text>
      </View>
      <Text style={styles.ritualText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  progress: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingTop: 26,
  },
  progressDot: {
    borderRadius: 999,
    height: 4,
    width: 6,
  },
  progressDotActive: {
    width: 24,
  },
  content: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  centerStep: {
    alignItems: 'center',
    maxWidth: 380,
    position: 'relative',
    width: '100%',
  },
  softGlow: {
    backgroundColor: '#C7DCEC',
    borderRadius: 220,
    height: 280,
    opacity: 0.25,
    position: 'absolute',
    top: -40,
    width: 440,
  },
  wordmark: {
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 2.42,
    lineHeight: 11,
    marginBottom: 30,
  },
  heroTitle: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 50,
    fontWeight: '300',
    lineHeight: 55,
    marginBottom: 16,
    textAlign: 'center',
  },
  stepTitle: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 36,
    fontWeight: '300',
    lineHeight: 40,
    marginBottom: 10,
    textAlign: 'center',
  },
  body: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 28,
    maxWidth: 310,
    textAlign: 'center',
  },
  bodySmall: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 24,
    marginBottom: 26,
    textAlign: 'center',
  },
  boxStage: {
    alignItems: 'center',
    height: 140,
    justifyContent: 'center',
    marginBottom: 22,
    position: 'relative',
    width: 180,
  },
  softCircle: {
    backgroundColor: '#BCD2E6',
    borderRadius: 90,
    height: 180,
    opacity: 0.28,
    position: 'absolute',
    width: 180,
  },
  connectedPill: {
    alignItems: 'center',
    backgroundColor: '#EDF3F8',
    borderColor: colors.blueLine,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 26,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  connectedDot: {
    backgroundColor: colors.blue,
    borderRadius: 3.5,
    height: 7,
    width: 7,
  },
  connectedText: {
    color: colors.blue,
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '500',
  },
  locationWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  locationChip: {
    backgroundColor: colors.surfaceWarm,
    borderColor: '#DDE4EA',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  locationChipSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  locationText: {
    color: '#4A5568',
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '500',
  },
  locationTextSelected: {
    color: colors.background,
  },
  ritualIcon: {
    alignItems: 'center',
    height: 148,
    justifyContent: 'center',
    marginBottom: 34,
    position: 'relative',
    width: 148,
  },
  amberRingOuter: {
    borderColor: 'rgba(192,136,63,.55)',
    borderRadius: 74,
    borderWidth: 1.5,
    height: 148,
    position: 'absolute',
    width: 148,
  },
  amberRingInner: {
    borderColor: 'rgba(192,136,63,.38)',
    borderRadius: 60,
    borderWidth: 1,
    height: 120,
    position: 'absolute',
    width: 120,
  },
  ritualCore: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderColor: '#2E3C4A',
    borderRadius: 44,
    borderWidth: 1.5,
    height: 88,
    justifyContent: 'center',
    position: 'relative',
    width: 88,
  },
  ritualLens: {
    backgroundColor: '#182232',
    borderColor: '#2C3D4E',
    borderRadius: 27,
    borderWidth: 1,
    height: 54,
    width: 54,
  },
  ritualLed: {
    backgroundColor: '#C0883F',
    borderRadius: 4.5,
    bottom: 13,
    height: 9,
    position: 'absolute',
    right: 13,
    width: 9,
  },
  ritualCard: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 18,
    paddingHorizontal: 24,
    paddingVertical: 22,
    width: '100%',
  },
  ritualRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 15,
  },
  numberBadge: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  numberText: {
    color: colors.background,
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '600',
  },
  ritualText: {
    color: colors.ink,
    flex: 1,
    fontFamily: fonts.serif,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
  },
  ritualRule: {
    backgroundColor: colors.border,
    height: 1,
    marginLeft: 43,
  },
  checkBadge: {
    alignItems: 'center',
    backgroundColor: '#F1EDE4',
    borderColor: '#DDE4EA',
    borderRadius: 14,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  checkText: {
    color: colors.blue,
    fontFamily: fonts.serif,
    fontSize: 16,
  },
  ritualNote: {
    color: colors.muted,
    flex: 1,
    fontFamily: fonts.serif,
    fontSize: 15,
    fontStyle: 'italic',
    fontWeight: '400',
    lineHeight: 21,
  },
  readyBadge: {
    alignItems: 'center',
    backgroundColor: '#F1EDE4',
    borderColor: '#DDE4EA',
    borderRadius: 29,
    borderWidth: 1,
    height: 58,
    justifyContent: 'center',
    marginBottom: 30,
    width: 58,
  },
  readyCheck: {
    color: colors.blue,
    fontFamily: fonts.sans,
    fontSize: 22,
    fontWeight: '600',
  },
  footer: {
    alignSelf: 'center',
    gap: 10,
    maxWidth: 400,
    paddingBottom: 52,
    paddingHorizontal: 32,
    width: '100%',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 12,
    padding: 16,
  },
  primaryText: {
    color: colors.background,
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#DDE4EA',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  secondaryText: {
    color: '#8A939E',
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '500',
  },
});
