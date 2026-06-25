import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';

import { colors, fonts } from '@/lib/theme';

export type AuthMode = 'new' | 'back';

const recordHazeStyle = {
  animation: 'haze 7s ease-in-out infinite',
  backgroundImage: 'radial-gradient(circle,#9fc0de 0%,#bcd2e6 38%,transparent 70%)',
} as unknown as ViewStyle;

const glowStyle = {
  animation: 'breatheSoft 9s ease-in-out infinite',
  backgroundImage: 'radial-gradient(ellipse,#c7dcec,transparent 68%)',
} as unknown as ViewStyle;

const caretStyle = {
  animation: 'caret 1.1s step-end infinite',
} as unknown as ViewStyle;

export function StoreyboxAuthWordmark() {
  return <Text style={styles.wordmark}>STOREYBOX</Text>;
}

export function ModeSwitch({
  mode,
  onChange,
}: {
  mode: AuthMode;
  onChange: (mode: AuthMode) => void;
}) {
  return (
    <View style={styles.modeTrack}>
      <Pressable
        onPress={() => onChange('new')}
        style={[styles.modePill, mode === 'new' && styles.modePillActive]}
      >
        <Text style={[styles.modeText, mode === 'new' && styles.modeTextActive]}>New here</Text>
      </Pressable>
      <Pressable
        onPress={() => onChange('back')}
        style={[styles.modePill, mode === 'back' && styles.modePillActive]}
      >
        <Text style={[styles.modeText, mode === 'back' && styles.modeTextActive]}>Welcome back</Text>
      </Pressable>
    </View>
  );
}

export function HairlineEmailField({
  email,
  onChangeText,
  placeholder = 'you@example.com',
}: {
  email: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <View>
      <Text style={styles.emailLabel}>EMAIL</Text>
      <View style={styles.emailLine}>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.faint}
          returnKeyType="done"
          style={styles.emailInput}
          value={email}
        />
        <View style={[styles.caret, caretStyle]} />
      </View>
    </View>
  );
}

export function OAuthButton({
  kind,
  onPress,
}: {
  kind: 'apple' | 'google';
  onPress: () => void;
}) {
  const isApple = kind === 'apple';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.oauthButton,
        isApple ? styles.oauthButtonInk : styles.oauthButtonOutline,
        pressed && styles.pressed,
      ]}
    >
      {isApple ? (
        <Text style={styles.appleMark}>Apple</Text>
      ) : (
        <Text style={styles.googleMark}>G</Text>
      )}
      <Text style={[styles.oauthText, isApple ? styles.oauthTextInk : styles.oauthTextOutline]}>
        Continue with {isApple ? 'Apple' : 'Google'}
      </Text>
    </Pressable>
  );
}

export function OrDivider() {
  return (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>OR</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

export function SpeakToEnter({
  isRecording,
  onContinue,
  onToggleRecording,
}: {
  isRecording: boolean;
  onContinue: () => void;
  onToggleRecording: () => void;
}) {
  return (
    <View style={styles.speakWrap}>
      <Pressable onPress={onToggleRecording} style={styles.speakTarget}>
        <View style={[styles.speakHaze, recordHazeStyle]} />
        <View style={styles.speakRing} />
        {isRecording ? <View style={styles.speakLiveRing} /> : null}
        <View style={styles.speakCore}>
          <MicIcon />
        </View>
      </Pressable>
      <Text style={styles.speakLabel}>Click and say your name</Text>
      <Text style={styles.speakHint}>Just your name, and where you are.</Text>

      {isRecording ? (
        <View style={styles.recordingWrap}>
          <View style={styles.listeningPill}>
            <View style={styles.listeningDot} />
            <Text style={styles.listeningText}>LISTENING · 0:03</Text>
          </View>
          <Waveform bars={makeWave(48, 7)} color="#c4a06a" height={32} />
          <Pressable onPress={onContinue} style={({ pressed }) => [styles.voiceContinue, pressed && styles.pressed]}>
            <Text style={styles.voiceContinueText}>That's me — continue</Text>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function OnboardingVoiceRecorder({
  isRecording,
  label,
  onToggleRecording,
}: {
  isRecording: boolean;
  label: string;
  onToggleRecording: () => void;
}) {
  return (
    <View style={styles.onboardingRecordRow}>
      <Pressable onPress={onToggleRecording} style={styles.onboardingRecordPressable}>
        <View style={styles.onboardingRecordCore}>
          <View style={isRecording ? styles.recordingSquare : styles.recordingDot} />
        </View>
        <Text style={[styles.onboardingRecordLabel, isRecording && styles.onboardingRecordLabelLive]}>
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

export function StepProgress({ step }: { step: number }) {
  return (
    <View style={styles.progress}>
      {[1, 2, 3].map((item) => (
        <View
          key={item}
          style={[styles.progressSegment, { backgroundColor: step >= item ? colors.blue : '#e2dccf' }]}
        />
      ))}
    </View>
  );
}

export function PasskeyToggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      onPress={onToggle}
      style={[styles.toggleTrack, { backgroundColor: enabled ? colors.blue : '#cfc8b8' }]}
    >
      <View style={[styles.toggleKnob, { left: enabled ? 25 : 3 }]} />
    </Pressable>
  );
}

export function RecapCard({
  badge,
  badgeMuted = false,
  children,
  title,
}: {
  badge: ReactNode;
  badgeMuted?: boolean;
  children: ReactNode;
  title: string;
}) {
  return (
    <View style={styles.recapCard}>
      <View style={[styles.recapBadge, badgeMuted && styles.recapBadgeMuted]}>
        {typeof badge === 'string' ? (
          <Text style={[styles.recapBadgeText, badgeMuted && styles.recapBadgeTextMuted]}>{badge}</Text>
        ) : (
          badge
        )}
      </View>
      <View style={styles.recapTextWrap}>
        <Text style={styles.recapTitle}>{title}</Text>
        <Text style={styles.recapSub}>{children}</Text>
      </View>
    </View>
  );
}

export function Waveform({
  bars,
  color,
  height,
}: {
  bars: number[];
  color: string;
  height: number;
}) {
  return (
    <View style={[styles.waveform, { height }]}>
      {bars.map((bar, index) => (
        <View
          key={`${bar}-${index}`}
          style={[styles.waveBar, { backgroundColor: color, height: bar }]}
        />
      ))}
    </View>
  );
}

export function SoftGlow({ style }: { style?: ViewStyle }) {
  return <View style={[styles.softGlow, glowStyle, style]} />;
}

export function PrimaryButton({
  children,
  disabled = false,
  isLoading = false,
  onPress,
}: {
  children: ReactNode;
  disabled?: boolean;
  isLoading?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled || isLoading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        (disabled || isLoading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={colors.background} />
      ) : (
        <>
          <Text style={styles.primaryButtonText}>{children}</Text>
          <Text style={styles.arrow}>›</Text>
        </>
      )}
    </Pressable>
  );
}

export function BackChevron() {
  return <Text style={styles.backChevron}>‹</Text>;
}

function MicIcon() {
  return (
    <View style={styles.micWrap}>
      <View style={styles.micBody} />
      <View style={styles.micArc} />
      <View style={styles.micStem} />
    </View>
  );
}

export function makeWave(count: number, seed: number, maxHeight = 34) {
  let nextSeed = seed;
  const bars: number[] = [];

  for (let index = 0; index < count; index += 1) {
    nextSeed = (nextSeed * 9301 + 49297) % 233280;
    const random = nextSeed / 233280;
    const envelope = 0.35 + 0.65 * Math.sin((index / count) * Math.PI);
    bars.push(Math.round(4 + maxHeight * random * envelope));
  }

  return bars;
}

const styles = StyleSheet.create({
  wordmark: {
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 3.9,
    lineHeight: 13,
  },
  modeTrack: {
    backgroundColor: '#ece6db',
    borderRadius: 999,
    flexDirection: 'row',
    padding: 4,
  },
  modePill: {
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 9,
  },
  modePillActive: {
    backgroundColor: colors.white,
  },
  modeText: {
    color: colors.faint,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '600',
  },
  modeTextActive: {
    color: colors.ink,
  },
  emailLabel: {
    color: '#8a939e',
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 1.98,
    lineHeight: 11,
    marginBottom: 12,
  },
  emailLine: {
    alignItems: 'center',
    borderBottomColor: colors.blueLine,
    borderBottomWidth: 1.5,
    flexDirection: 'row',
    paddingBottom: 12,
    paddingTop: 6,
  },
  emailInput: {
    color: colors.ink,
    flex: 1,
    fontFamily: fonts.serif,
    fontSize: 19,
    fontWeight: '400',
    padding: 0,
  },
  caret: {
    backgroundColor: colors.blue,
    height: 22,
    marginLeft: 3,
    width: 2,
  },
  oauthButton: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 10,
    height: 52,
    justifyContent: 'center',
  },
  oauthButtonInk: {
    backgroundColor: colors.ink,
    borderWidth: 0,
  },
  oauthButtonOutline: {
    backgroundColor: colors.surfaceWarm,
    borderColor: '#d8d0c0',
    borderWidth: 1,
  },
  appleMark: {
    color: colors.background,
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
  },
  googleMark: {
    color: colors.blue,
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '700',
  },
  oauthText: {
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '600',
  },
  oauthTextInk: {
    color: colors.background,
  },
  oauthTextOutline: {
    color: colors.ink,
  },
  divider: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  dividerLine: {
    backgroundColor: '#e2dccf',
    flex: 1,
    height: 1,
  },
  dividerText: {
    color: '#a6a092',
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 1.76,
  },
  speakWrap: {
    alignItems: 'center',
    marginTop: 38,
  },
  speakTarget: {
    height: 150,
    position: 'relative',
    width: 150,
  },
  speakHaze: {
    borderRadius: 97,
    bottom: -22,
    left: -22,
    position: 'absolute',
    right: -22,
    top: -22,
  },
  speakRing: {
    borderColor: '#cdd9e5',
    borderRadius: 75,
    borderWidth: 1,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  speakLiveRing: {
    borderColor: '#c0883f',
    borderRadius: 85,
    borderWidth: 1.5,
    bottom: -10,
    boxShadow: '0 0 0 7px rgba(192,136,63,.12)',
    left: -10,
    position: 'absolute',
    right: -10,
    top: -10,
  } as ViewStyle,
  speakCore: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 60,
    bottom: 15,
    boxShadow: '0 12px 30px rgba(30,38,48,.28)',
    justifyContent: 'center',
    left: 15,
    position: 'absolute',
    right: 15,
    top: 15,
  } as ViewStyle,
  speakLabel: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 20,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 22,
  },
  speakHint: {
    color: '#8a939e',
    fontFamily: fonts.serif,
    fontSize: 14,
    fontStyle: 'italic',
    fontWeight: '400',
    lineHeight: 14,
    marginTop: 8,
  },
  recordingWrap: {
    alignItems: 'center',
    marginTop: 18,
  },
  listeningPill: {
    alignItems: 'center',
    backgroundColor: '#f6ecde',
    borderColor: '#e7d3b3',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  listeningDot: {
    backgroundColor: '#c0883f',
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  listeningText: {
    color: '#a06c2f',
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  voiceContinue: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    height: 48,
    marginTop: 22,
    paddingHorizontal: 26,
  },
  voiceContinueText: {
    color: colors.background,
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '600',
  },
  arrow: {
    color: colors.background,
    fontFamily: fonts.sans,
    fontSize: 21,
    fontWeight: '500',
    lineHeight: 20,
  },
  waveform: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 2,
    justifyContent: 'center',
    marginTop: 14,
  },
  waveBar: {
    borderRadius: 3,
    width: 3,
  },
  onboardingRecordRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'center',
    marginTop: 20,
  },
  onboardingRecordPressable: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
  },
  onboardingRecordCore: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 26,
    boxShadow: '0 8px 20px rgba(30,38,48,.22)',
    height: 52,
    justifyContent: 'center',
    width: 52,
  } as ViewStyle,
  recordingDot: {
    backgroundColor: '#c0883f',
    borderRadius: 7,
    height: 14,
    width: 14,
  },
  recordingSquare: {
    backgroundColor: '#c0883f',
    borderRadius: 3,
    height: 15,
    width: 15,
  },
  onboardingRecordLabel: {
    color: '#4a525d',
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '600',
  },
  onboardingRecordLabelLive: {
    color: '#a06c2f',
  },
  progress: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 24,
    maxWidth: 600,
    width: '100%',
  },
  progressSegment: {
    borderRadius: 3,
    flex: 1,
    height: 4,
  },
  toggleTrack: {
    borderRadius: 999,
    height: 28,
    position: 'relative',
    width: 50,
  },
  toggleKnob: {
    backgroundColor: colors.white,
    borderRadius: 11,
    boxShadow: '0 1px 3px rgba(0,0,0,.25)',
    height: 22,
    position: 'absolute',
    top: 3,
    width: 22,
  } as ViewStyle,
  recapCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceWarm,
    borderColor: '#e8e1d2',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  recapBadge: {
    alignItems: 'center',
    backgroundColor: '#eef2f5',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  recapBadgeMuted: {
    backgroundColor: '#efe9dd',
  },
  recapBadgeText: {
    color: colors.blue,
    fontFamily: fonts.sans,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 20,
  },
  recapBadgeTextMuted: {
    color: '#a6a092',
  },
  recapTextWrap: {
    flex: 1,
  },
  recapTitle: {
    color: colors.ink,
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 18,
  },
  recapSub: {
    color: colors.muted,
    fontFamily: fonts.serif,
    fontSize: 14,
    fontStyle: 'italic',
    fontWeight: '400',
    lineHeight: 19.6,
    marginTop: 3,
  },
  softGlow: {
    height: 200,
    position: 'absolute',
    width: 380,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 9,
    height: 52,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  primaryButtonText: {
    color: colors.background,
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '600',
  },
  backChevron: {
    color: '#5a6470',
    fontFamily: fonts.serif,
    fontSize: 20,
    fontWeight: '400',
    lineHeight: 15,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.72,
  },
  micWrap: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  micBody: {
    borderColor: '#cdd9e5',
    borderRadius: 5,
    borderWidth: 1.6,
    height: 18,
    width: 8,
  },
  micArc: {
    borderBottomColor: '#cdd9e5',
    borderBottomWidth: 1.6,
    borderLeftColor: '#cdd9e5',
    borderLeftWidth: 1.6,
    borderRightColor: '#cdd9e5',
    borderRightWidth: 1.6,
    borderTopWidth: 0,
    height: 10,
    marginTop: -6,
    width: 18,
  },
  micStem: {
    backgroundColor: '#cdd9e5',
    height: 7,
    marginTop: 0,
    width: 1.6,
  },
});
