import { StyleSheet, Text, View } from 'react-native';

import { type StoreyBox, getBoxStateDetail } from '@/lib/box';
import { colors, fonts } from '@/lib/theme';

type BoxIllustrationProps = {
  ledColor?: string;
  size?: number;
};

export function BoxIllustration({ ledColor = '#3D5F7E', size = 92 }: BoxIllustrationProps) {
  const outerRadius = Math.round(size * 0.21);
  const innerRadius = Math.round(size * 0.15);
  const lensSize = Math.round(size * 0.52);
  const lensInset = Math.round((size - lensSize) / 2);
  const ringSize = Math.round(size * 0.35);
  const ringInset = Math.round((size - ringSize) / 2);
  const coreSize = Math.round(size * 0.2);
  const coreInset = Math.round((size - coreSize) / 2);
  const ledSize = Math.max(7, Math.round(size * 0.08));

  return (
    <View
      accessibilityLabel="Storeybox hardware"
      accessibilityRole="image"
      style={[
        styles.boxOuter,
        {
          borderRadius: outerRadius,
          height: size,
          width: size,
        },
      ]}
    >
      <View
        style={[
          styles.boxInner,
          {
            borderRadius: innerRadius,
            bottom: size * 0.08,
            left: size * 0.08,
            right: size * 0.08,
            top: size * 0.08,
          },
        ]}
      />
      <View
        style={[
          styles.lensOuter,
          {
            borderRadius: lensSize / 2,
            height: lensSize,
            left: lensInset,
            top: lensInset,
            width: lensSize,
          },
        ]}
      />
      <View
        style={[
          styles.lensRing,
          {
            borderRadius: ringSize / 2,
            height: ringSize,
            left: ringInset,
            top: ringInset,
            width: ringSize,
          },
        ]}
      />
      <View
        style={[
          styles.lensCore,
          {
            borderRadius: coreSize / 2,
            height: coreSize,
            left: coreInset,
            top: coreInset,
            width: coreSize,
          },
        ]}
      />
      <View style={[styles.lensGlint, { left: size * 0.43, top: size * 0.4 }]} />
      <View
        style={[
          styles.led,
          {
            backgroundColor: ledColor,
            borderRadius: ledSize / 2,
            height: ledSize,
            right: size * 0.18,
            top: size * 0.72,
            width: ledSize,
          },
        ]}
      />
      <View style={[styles.restDot, { left: size * 0.22, top: size * 0.74 }]} />
    </View>
  );
}

export function BoxPresenceCard({ box }: { box: StoreyBox }) {
  const detail = getBoxStateDetail(box);
  const isRecording = box.state === 'recording';
  const isReady = box.state === 'ready';

  return (
    <View
      style={[
        styles.presenceCard,
        isRecording && styles.presenceCardRecording,
      ]}
    >
      {isRecording ? <View style={styles.amberWash} /> : null}
      <View style={styles.boxStage}>
        {isRecording ? (
          <>
            <View style={[styles.amberRingOuter, styles.amberPulse]} />
            <View style={[styles.amberRingInner, styles.amberPulseDelay]} />
          </>
        ) : null}
        {isReady ? <View style={styles.boxGlow} /> : null}
        <BoxIllustration ledColor={detail.ledColor} size={92} />
      </View>
      <Text style={[styles.presenceTitle, isRecording && styles.presenceTitleRecording]}>
        {detail.cardTitle}
      </Text>
      <Text style={[styles.presenceSub, isRecording && styles.presenceSubRecording]}>
        {detail.sub(box)}
      </Text>
      <View style={styles.presenceRule} />
      <Text style={styles.presenceNote}>{detail.note}</Text>
    </View>
  );
}

export function BoxStatusBadge({ box }: { box: StoreyBox }) {
  const detail = getBoxStateDetail(box);

  return (
    <View style={styles.statusBadge}>
      <View style={[styles.statusDot, { backgroundColor: detail.ledColor }]} />
      <Text style={styles.statusText}>
        {box.state === 'ready' ? 'Here and ready' : detail.cardTitle.replace('Your Box is ', '')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  boxOuter: {
    backgroundColor: colors.ink,
    borderColor: '#283848',
    borderWidth: 1.2,
    position: 'relative',
  },
  boxInner: {
    backgroundColor: '#17212D',
    position: 'absolute',
  },
  lensOuter: {
    backgroundColor: '#1C2838',
    position: 'absolute',
  },
  lensRing: {
    backgroundColor: '#142030',
    borderColor: '#2B3D50',
    borderWidth: 1.5,
    position: 'absolute',
  },
  lensCore: {
    backgroundColor: '#19253A',
    position: 'absolute',
  },
  lensGlint: {
    backgroundColor: '#243650',
    borderRadius: 5,
    height: 8,
    opacity: 0.44,
    position: 'absolute',
    width: 10,
  },
  led: {
    position: 'absolute',
  },
  restDot: {
    backgroundColor: '#222E3C',
    borderRadius: 2,
    height: 4,
    position: 'absolute',
    width: 4,
  },
  presenceCard: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 24,
    paddingVertical: 28,
    position: 'relative',
  },
  presenceCardRecording: {
    borderColor: 'rgba(192,136,63,.45)',
  },
  amberWash: {
    backgroundColor: 'rgba(192,136,63,.08)',
    borderRadius: 20,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  boxStage: {
    alignItems: 'center',
    height: 104,
    justifyContent: 'center',
    marginBottom: 20,
    position: 'relative',
    width: 128,
  },
  boxGlow: {
    backgroundColor: 'rgba(188,210,230,.24)',
    borderRadius: 68,
    bottom: -16,
    left: -4,
    position: 'absolute',
    right: -4,
    top: -16,
  },
  amberRingOuter: {
    borderColor: 'rgba(192,136,63,.6)',
    borderRadius: 64,
    borderWidth: 1.5,
    height: 128,
    position: 'absolute',
    width: 128,
  },
  amberRingInner: {
    borderColor: 'rgba(192,136,63,.38)',
    borderRadius: 54,
    borderWidth: 1,
    height: 108,
    position: 'absolute',
    width: 108,
  },
  amberPulse: {
    opacity: 0.58,
  },
  amberPulseDelay: {
    opacity: 0.38,
  },
  presenceTitle: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 22,
    fontWeight: '400',
    lineHeight: 26.4,
    marginBottom: 6,
    textAlign: 'center',
  },
  presenceTitleRecording: {
    color: '#C0883F',
  },
  presenceSub: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 1.32,
    lineHeight: 15,
    textAlign: 'center',
  },
  presenceSubRecording: {
    color: '#C07030',
  },
  presenceRule: {
    alignSelf: 'stretch',
    backgroundColor: colors.border,
    height: 1,
    marginTop: 20,
  },
  presenceNote: {
    color: colors.muted,
    fontFamily: fonts.serifLightItalic,
    fontSize: 14,
    fontStyle: 'italic',
    fontWeight: '300',
    lineHeight: 21,
    marginTop: 18,
    textAlign: 'center',
  },
  statusBadge: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  statusDot: {
    borderRadius: 3.5,
    height: 7,
    width: 7,
  },
  statusText: {
    color: colors.blue,
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 17,
  },
});
