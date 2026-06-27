import { type Href, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { colors, fonts } from '@/lib/theme';

const passageWords = [
  'Small',
  'moments',
  'stay',
  'lit',
  'when',
  'someone',
  'makes',
  'room',
  'for',
  'them,',
  'a',
  'voice',
  'in',
  'the',
  'dark',
  'becoming',
  'a',
  'place',
  'to',
  'begin.',
];

const amberWords = new Set(['stay', 'lit', 'voice', 'dark']);
const wordIntervalMs = 190;
const bloomStartMs = 4400;
const greetStartMs = 7600;
const introDoneMs = 11000;

type IntroPhase = 'night' | 'bloom' | 'greet';

export function StoreyHero() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isPhone = width < 700;
  const [phase, setPhase] = useState<IntroPhase>('night');
  const [visibleWords, setVisibleWords] = useState(0);
  const [replayKey, setReplayKey] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>>>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener?.('change', updatePreference);
    return () => mediaQuery.removeEventListener?.('change', updatePreference);
  }, []);

  useEffect(() => {
    clearTimers();
    setPhase(prefersReducedMotion ? 'greet' : 'night');
    setVisibleWords(prefersReducedMotion ? passageWords.length : 0);

    if (prefersReducedMotion) {
      return clearTimers;
    }

    const wordTimer = setInterval(() => {
      setVisibleWords((current) => {
        const next = Math.min(current + 1, passageWords.length);

        if (next === passageWords.length) {
          clearInterval(wordTimer);
        }

        return next;
      });
    }, wordIntervalMs);

    const bloomTimer = setTimeout(() => setPhase('bloom'), bloomStartMs);
    const greetTimer = setTimeout(() => setPhase('greet'), greetStartMs);
    const doneTimer = setTimeout(() => {
      setPhase('greet');
      setVisibleWords(passageWords.length);
    }, introDoneMs);

    timersRef.current = [wordTimer, bloomTimer, greetTimer, doneTimer];
    return clearTimers;
  }, [prefersReducedMotion, replayKey]);

  const stageStyle = useMemo(
    () => [styles.stage, phase === 'greet' && styles.stageDawn],
    [phase],
  );

  function clearTimers() {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];
  }

  function replayIntro() {
    setReplayKey((current) => current + 1);
  }

  function skipToGreet() {
    clearTimers();
    setVisibleWords(passageWords.length);
    setPhase('greet');
  }

  function goToOnboarding() {
    router.push('/onboarding' as Href);
  }

  const showNight = phase === 'night' || phase === 'bloom';
  const showBloom = phase === 'bloom';
  const showGreet = phase === 'greet';

  return (
    <View style={stageStyle}>
      <Pressable
        accessibilityElementsHidden={!showNight}
        accessibilityLabel="Skip intro"
        accessibilityRole="button"
        disabled={!showNight}
        onPress={skipToGreet}
        style={[
          styles.nightLayer,
          !isPhone && styles.nightLayerDesktop,
          { opacity: showNight ? 1 : 0 },
        ]}
      >
        <StarField />
        <View style={styles.horizonGlow} />
        <View style={[styles.nightContent, isPhone ? styles.nightContentPhone : styles.nightContentDesktop]}>
          <Text style={styles.nightWordmark}>STOREYBOX</Text>
          <View style={styles.passageWrap}>
            <View style={styles.passageRule} />
            <Text style={[styles.passage, isPhone ? styles.passagePhone : styles.passageDesktop]}>
              {passageWords.map((word, index) => (
                <Text
                  key={`${word}-${index}`}
                  style={[
                    styles.passageWord,
                    index < visibleWords && styles.passageWordVisible,
                    amberWords.has(word.replace(/[,.]/g, '')) && styles.passageWordAmber,
                  ]}
                >
                  {word}{' '}
                </Text>
              ))}
            </Text>
            <View style={styles.passageRuleBottom} />
          </View>

          <View style={styles.beginWrap}>
            <View style={styles.beginButton}>
              <View style={[styles.pulseRing, styles.pulseRingOne]} />
              <View style={[styles.pulseRing, styles.pulseRingTwo]} />
              <View style={styles.beginCore}>
                <HeroMicIcon color="#f1d8aa" />
              </View>
            </View>
            <Text style={styles.beginLabel}>CLICK TO BEGIN YOUR STOREY</Text>
          </View>
        </View>
        <View style={[styles.heroEmber, showBloom && styles.heroEmberBloom]} />
      </Pressable>

      <View
        accessibilityElementsHidden={!showGreet}
        style={[
          styles.greetLayer,
          !isPhone && styles.greetLayerDesktop,
          { opacity: showGreet ? 1 : 0 },
        ]}
      >
        <View style={styles.greetSunrise} />
        <View style={[styles.greetGlow, isPhone ? styles.greetGlowPhone : styles.greetGlowDesktop]} />
        <View style={[styles.greetContent, isPhone ? styles.greetContentPhone : styles.greetContentDesktop]}>
          <Text style={styles.greetWordmark}>STOREYBOX</Text>
          <View style={styles.greetIntro}>
            <Text style={[styles.greetTitle, isPhone ? styles.greetTitlePhone : styles.greetTitleDesktop]}>
              There you are.{'\n'}
              <Text style={styles.greetTitleItalic}>I'm Storey.</Text>
            </Text>
            <Text style={styles.greetBody}>
              Introduce yourself — your name, where you are, and what kind of day it's been.
            </Text>
          </View>

          <View style={styles.greetActions}>
            <Pressable
              accessibilityLabel="Begin with voice"
              accessibilityRole="button"
              onPress={goToOnboarding}
              style={styles.greetMic}
            >
              <View style={styles.greetHaze} />
              <View style={styles.greetRing} />
              <View style={styles.greetCore}>
                <HeroMicIcon color="#cdd9e5" />
              </View>
            </Pressable>
            <Text style={styles.greetHint}>Press, and say hello.</Text>
            <Pressable
              accessibilityLabel="Use email instead"
              accessibilityRole="button"
              onPress={goToOnboarding}
              style={styles.emailLink}
            >
              <Text style={styles.emailLinkText}>Use email instead</Text>
            </Pressable>
            <Text style={styles.privacyLine}>PRIVATE BY DEFAULT · YOUR STORY STAYS YOURS</Text>
          </View>
        </View>
      </View>

      <View style={[styles.envelope, getEnvelopeStyle(showBloom)]} />

      {__DEV__ ? (
        <Pressable onPress={replayIntro} style={styles.replayButton}>
          <Text style={styles.replayIcon}>↺</Text>
          <Text style={styles.replayText}>REPLAY</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function getEnvelopeStyle(isVisible: boolean) {
  return {
    opacity: isVisible ? 0.97 : 0,
    transform: [{ translateX: '-50%' }, { translateY: '-50%' }, { scale: isVisible ? 1.08 : 0.02 }],
  } as unknown as ViewStyle;
}

function StarField() {
  const stars = [
    { top: '11%', left: '18%', size: 2, opacity: 0.5 },
    { top: '17%', left: '38%', size: 3, opacity: 0.82 },
    { top: '14%', left: '76%', size: 2, opacity: 0.6 },
    { top: '24%', left: '84%', size: 2, opacity: 0.72 },
    { top: '30%', left: '14%', size: 2, opacity: 0.4 },
    { top: '39%', left: '82%', size: 3, opacity: 0.78 },
    { top: '27%', left: '48%', size: 2, opacity: 0.3 },
  ];
  const embers = [
    { left: '28%', bottom: '23%' },
    { left: '44%', bottom: '17%' },
    { left: '62%', bottom: '20%' },
    { left: '74%', bottom: '15%' },
    { left: '52%', bottom: '12%' },
  ];

  return (
    <>
      {stars.map((star, index) => (
        <View
          key={`star-${index}`}
          style={[
            styles.star,
            {
              height: star.size,
              left: star.left,
              opacity: star.opacity,
              top: star.top,
              width: star.size,
            } as unknown as ViewStyle,
          ]}
        />
      ))}
      {embers.map((ember, index) => (
        <View
          key={`ember-${index}`}
          style={[
            styles.ember,
            {
              bottom: ember.bottom,
              left: ember.left,
              opacity: 0.25 + index * 0.11,
              transform: [{ translateY: -index * 18 }],
            } as unknown as ViewStyle,
          ]}
        />
      ))}
    </>
  );
}

function HeroMicIcon({ color }: { color: string }) {
  return (
    <View style={styles.micWrap}>
      <View style={[styles.micBody, { borderColor: color }]} />
      <View style={[styles.micArc, { borderBottomColor: color, borderLeftColor: color, borderRightColor: color }]} />
      <View style={[styles.micStem, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    backgroundColor: '#0f141c',
    bottom: 0,
    fontFamily: fonts.sans,
    height: '100vh',
    left: 0,
    minHeight: '100vh',
    overflow: 'hidden',
    position: 'fixed',
    right: 0,
    top: 0,
    width: '100vw',
  } as unknown as ViewStyle,
  stageDawn: {
    backgroundColor: colors.background,
  },
  nightLayer: {
    backgroundImage: 'radial-gradient(ellipse at 50% 38%,#2c3c54 0%,#1b2533 56%,#131922 100%)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    transition: 'opacity 1.2s ease',
    zIndex: 2,
  } as unknown as ViewStyle,
  nightLayerDesktop: {
    backgroundImage:
      'radial-gradient(ellipse at 50% 38%,#2c3c54 0%,#1b2533 48%,#111822 100%)',
  } as unknown as ViewStyle,
  horizonGlow: {
    backgroundImage: 'radial-gradient(ellipse at 50% 100%,rgba(233,199,154,.30),transparent 66%)',
    bottom: '-6%',
    height: '34%',
    left: 0,
    pointerEvents: 'none',
    position: 'absolute',
    right: 0,
  } as unknown as ViewStyle,
  nightContent: {
    alignItems: 'center',
    bottom: 0,
    flexDirection: 'column',
    left: 0,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
    top: 0,
  } as unknown as ViewStyle,
  nightContentPhone: {
    paddingBottom: 64,
    paddingHorizontal: 40,
    paddingTop: 84,
  },
  nightContentDesktop: {
    left: '50%',
    maxWidth: 430,
    paddingBottom: 64,
    paddingHorizontal: 40,
    paddingTop: 84,
    transform: [{ translateX: -215 }],
    width: 430,
  } as unknown as ViewStyle,
  nightWordmark: {
    color: '#9fb4c9',
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 3.74,
    lineHeight: 11,
  },
  passageWrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  passageRule: {
    backgroundColor: 'rgba(201,219,235,.45)',
    height: 1,
    marginBottom: 26,
    width: 26,
  },
  passageRuleBottom: {
    backgroundColor: 'rgba(201,219,235,.45)',
    height: 1,
    marginTop: 26,
    width: 26,
  },
  passage: {
    color: '#eef2f6',
    fontFamily: fonts.serif,
    fontWeight: '300',
    letterSpacing: 0,
    textAlign: 'center',
  },
  passagePhone: {
    fontSize: 24,
    lineHeight: 37.92,
    maxWidth: 308,
  },
  passageDesktop: {
    fontSize: 27,
    lineHeight: 42,
    maxWidth: 350,
  },
  passageWord: {
    color: '#f0d9ab',
    opacity: 0,
    textShadow: '0 0 14px rgba(236,200,143,.95)',
    transition: 'opacity .7s ease, color .7s ease, text-shadow .7s ease',
  } as unknown as TextStyle,
  passageWordAmber: {
    color: '#eccf9a',
    fontStyle: 'italic',
    textShadow: '0 0 9px rgba(236,200,143,.4)',
  } as unknown as TextStyle,
  passageWordVisible: {
    color: '#eef2f6',
    opacity: 1,
    textShadow: '0 0 0 rgba(0,0,0,0)',
  } as unknown as TextStyle,
  beginWrap: {
    alignItems: 'center',
    gap: 14,
  },
  beginButton: {
    height: 74,
    position: 'relative',
    width: 74,
  },
  pulseRing: {
    borderColor: 'rgba(236,200,143,.5)',
    borderRadius: 37,
    borderWidth: 1,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  pulseRingOne: {
    opacity: 0.5,
  },
  pulseRingTwo: {
    opacity: 0.24,
    transform: [{ scale: 1.28 }],
  },
  beginCore: {
    alignItems: 'center',
    backgroundImage: 'radial-gradient(circle at 40% 36%,#36475f,#1d2735)',
    borderColor: 'rgba(236,200,143,.6)',
    borderRadius: 37,
    borderWidth: 1,
    bottom: 0,
    boxShadow: '0 0 26px rgba(233,199,154,.26)',
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  } as unknown as ViewStyle,
  beginLabel: {
    color: '#d8c5a4',
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 2.64,
    lineHeight: 14,
    textAlign: 'center',
  },
  heroEmber: {
    backgroundColor: '#f4dcae',
    borderRadius: 2.5,
    bottom: '18%',
    boxShadow: '0 0 16px 4px rgba(244,220,174,.9)',
    height: 5,
    left: '50%',
    opacity: 0,
    position: 'absolute',
    transform: [{ translateX: -2.5 }],
    transition: 'opacity .5s ease, transform 2s ease',
    width: 5,
  } as unknown as ViewStyle,
  heroEmberBloom: {
    opacity: 1,
    transform: [{ translateX: -2.5 }, { translateY: -330 }, { scale: 0.65 }],
  },
  greetLayer: {
    backgroundImage: 'linear-gradient(180deg,#f7f3ec 0%,#f3ecdf 100%)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    transition: 'opacity 1.2s ease',
    zIndex: 3,
  } as unknown as ViewStyle,
  greetLayerDesktop: {
    backgroundImage:
      'radial-gradient(ellipse at 50% 0%,rgba(238,206,150,.28),transparent 50%), linear-gradient(180deg,#f7f3ec 0%,#f3ecdf 100%)',
  } as unknown as ViewStyle,
  greetSunrise: {
    backgroundImage: 'radial-gradient(ellipse at 50% 0%,rgba(238,206,150,.4),transparent 64%)',
    height: '36%',
    left: 0,
    pointerEvents: 'none',
    position: 'absolute',
    right: 0,
    top: '-8%',
  } as unknown as ViewStyle,
  greetGlow: {
    backgroundImage: 'radial-gradient(ellipse,#cbdcea,transparent 68%)',
    pointerEvents: 'none',
    position: 'absolute',
  } as unknown as ViewStyle,
  greetGlowPhone: {
    height: 320,
    left: '50%',
    top: '34%',
    transform: [{ translateX: -220 }, { translateY: -160 }],
    width: 440,
  },
  greetGlowDesktop: {
    height: 360,
    left: '50%',
    top: '44%',
    transform: [{ translateX: -240 }, { translateY: -180 }],
    width: 480,
  },
  greetContent: {
    alignItems: 'center',
    bottom: 0,
    flexDirection: 'column',
    left: 0,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
    top: 0,
  } as unknown as ViewStyle,
  greetContentPhone: {
    paddingBottom: 56,
    paddingHorizontal: 40,
    paddingTop: 104,
  },
  greetContentDesktop: {
    left: '50%',
    maxWidth: 430,
    paddingBottom: 64,
    paddingHorizontal: 40,
    paddingTop: 84,
    transform: [{ translateX: -215 }],
    width: 430,
  } as unknown as ViewStyle,
  greetWordmark: {
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 3.74,
    lineHeight: 11,
  },
  greetIntro: {
    alignItems: 'center',
    marginTop: 36,
  },
  greetTitle: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontWeight: '300',
    letterSpacing: 0,
    textAlign: 'center',
  },
  greetTitlePhone: {
    fontSize: 42,
    lineHeight: 44.52,
  },
  greetTitleDesktop: {
    fontSize: 48,
    lineHeight: 51,
  },
  greetTitleItalic: {
    fontStyle: 'italic',
    fontWeight: '200',
  },
  greetBody: {
    color: '#5f6a76',
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 24,
    marginTop: 18,
    maxWidth: 300,
    textAlign: 'center',
  },
  greetActions: {
    alignItems: 'center',
    marginTop: 'auto',
  },
  greetMic: {
    height: 116,
    position: 'relative',
    width: 116,
  },
  greetHaze: {
    backgroundImage: 'radial-gradient(circle,#9fc0de 0%,#bcd2e6 38%,transparent 70%)',
    borderRadius: 76,
    bottom: -18,
    left: -18,
    opacity: 0.86,
    position: 'absolute',
    right: -18,
    top: -18,
  } as unknown as ViewStyle,
  greetRing: {
    borderColor: '#cdd9e5',
    borderRadius: 58,
    borderWidth: 1,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  greetCore: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 45,
    bottom: 13,
    boxShadow: '0 12px 30px rgba(30,38,48,.28)',
    justifyContent: 'center',
    left: 13,
    position: 'absolute',
    right: 13,
    top: 13,
  } as unknown as ViewStyle,
  greetHint: {
    color: '#8a939e',
    fontFamily: fonts.serif,
    fontSize: 15,
    fontStyle: 'italic',
    fontWeight: '400',
    lineHeight: 15,
    marginTop: 16,
    textAlign: 'center',
  },
  emailLink: {
    marginTop: 16,
  },
  emailLinkText: {
    color: colors.blue,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  privacyLine: {
    color: '#a6a092',
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '400',
    letterSpacing: 1.44,
    lineHeight: 12,
    marginTop: 16,
    textAlign: 'center',
  },
  envelope: {
    backgroundImage:
      'radial-gradient(circle,rgba(226,239,250,1) 0%,rgba(172,202,229,.98) 32%,rgba(112,144,178,.85) 60%,transparent 76%)',
    borderRadius: '50%',
    height: '150vmax',
    left: '50%',
    pointerEvents: 'none',
    position: 'absolute',
    top: '50%',
    transition: 'transform 2.8s cubic-bezier(.2,.65,.25,1), opacity 1.1s ease',
    width: '150vmax',
    willChange: 'transform,opacity',
    zIndex: 4,
  } as unknown as ViewStyle,
  replayButton: {
    alignItems: 'center',
    bottom: 16,
    flexDirection: 'row',
    gap: 6,
    opacity: 0.7,
    position: 'absolute',
    right: 18,
    zIndex: 20,
  },
  replayIcon: {
    color: '#9aa3ad',
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 12,
  },
  replayText: {
    color: '#9aa3ad',
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 1.2,
    lineHeight: 10,
  },
  star: {
    backgroundColor: colors.white,
    borderRadius: 2,
    position: 'absolute',
  },
  ember: {
    backgroundColor: '#e9c79a',
    borderRadius: 1.5,
    boxShadow: '0 0 8px 1px rgba(233,199,154,.8)',
    height: 3,
    position: 'absolute',
    width: 3,
  } as unknown as ViewStyle,
  micWrap: {
    alignItems: 'center',
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  micBody: {
    borderRadius: 5,
    borderWidth: 1.6,
    height: 17,
    width: 9,
  },
  micArc: {
    borderBottomWidth: 1.6,
    borderLeftWidth: 1.6,
    borderRightWidth: 1.6,
    borderTopWidth: 0,
    height: 10,
    marginTop: -6,
    width: 19,
  },
  micStem: {
    height: 7,
    width: 1.6,
  },
});
