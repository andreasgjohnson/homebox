import { type Href, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { makeWave, Waveform } from '@/components/AuthFlowComponents';
import { colors, fonts } from '@/lib/theme';

type HeroPhase = 'read' | 'reading' | 'transition' | 'greet';
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

const passage =
  'We die containing a richness of lovers and tribes, tastes we have swallowed, bodies we have plunged into and swum up as if rivers of wisdom, characters we have climbed into as if trees, fears we have hidden in as if caves. We live to burn, burn, burn like fabulous yellow roman candles exploding like spiders across the stars.';

const passageWords = passage.split(' ');
const highlightIntervalMs = 300;
const recognitionFallbackDelayMs = 2400;
const transitionDelayMs = 4200;

export function StoreyHero() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < 860;
  const [phase, setPhase] = useState<HeroPhase>('read');
  const [highlightedWords, setHighlightedWords] = useState(0);
  const [readMessage, setReadMessage] = useState<string | null>(null);
  const [isWaitingForAudio, setIsWaitingForAudio] = useState(false);
  const [hasAccessibilityFallback, setHasAccessibilityFallback] = useState(false);
  const [isGreetRecording, setIsGreetRecording] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserFrameRef = useRef<number | null>(null);
  const fallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const highlightedWordsRef = useRef(0);
  const phaseRef = useRef<HeroPhase>('read');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stageStyle = useMemo(
    () => [styles.stage, phase === 'greet' && styles.stageDawn],
    [phase],
  );

  useEffect(() => {
    return () => {
      stopReadingCapture();
      clearTransitionTimeout();
    };
  }, []);

  useEffect(() => {
    highlightedWordsRef.current = highlightedWords;
  }, [highlightedWords]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  async function pressRead() {
    if (phase === 'reading') {
      if (highlightedWords > 3) {
        startTransition();
      } else {
        setReadMessage('Keep reading aloud for a moment, then tap again when you are done.');
      }
      return;
    }

    if (phase !== 'read') {
      return;
    }

    setReadMessage(null);
    setHighlightedWords(0);
    setHasAccessibilityFallback(false);
    setIsWaitingForAudio(true);

    const stream = await requestMicrophoneStream();

    if (!stream) {
      setIsWaitingForAudio(false);
      setHasAccessibilityFallback(true);
      setReadMessage('Storey needs microphone access to hear the passage. Enable it, or use the accessibility entry below.');
      return;
    }

    streamRef.current = stream;
    waitForAudioInput(stream);
  }

  function waitForAudioInput(stream: MediaStream) {
    const AudioContextClass = getAudioContextClass();

    if (!AudioContextClass) {
      setIsWaitingForAudio(false);
      setPhase('reading');
      setReadMessage('Read the passage aloud, then tap when done.');
      startSpeechRecognitionWithFallback();
      return;
    }

    const audioContext = new AudioContextClass();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    const data = new Uint8Array(analyser.fftSize);
    let silentFrames = 0;

    analyser.fftSize = 512;
    source.connect(analyser);
    audioContextRef.current = audioContext;

    const inspect = () => {
      analyser.getByteTimeDomainData(data);
      const level = getInputLevel(data);

      if (level > 0.045) {
        setIsWaitingForAudio(false);
        setPhase('reading');
        setReadMessage(null);
        startSpeechRecognitionWithFallback();
        return;
      }

      silentFrames += 1;

      if (silentFrames > 160) {
        setReadMessage('Your microphone is on. Start reading aloud so Storey can hear you.');
      }

      analyserFrameRef.current = requestAnimationFrame(inspect);
    };

    inspect();
  }

  function startSpeechRecognitionWithFallback() {
    const Recognition = getSpeechRecognitionClass();

    if (!Recognition) {
      setReadMessage('Speech recognition is not available here, so Storey will follow your reading pace gently.');
      startTimedHighlight();
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      clearFallbackTimeout();
      const transcript = getSpeechTranscript(event);
      const nextCount = Math.min(countSpokenWords(transcript), passageWords.length);

      setHighlightedWords((current) => Math.max(current, nextCount));

      if (nextCount >= passageWords.length - 4) {
        startTransition();
        return;
      }

      scheduleRecognitionFallback();
    };
    recognition.onerror = () => {
      setReadMessage('It is noisy, so Storey will keep the reading glow moving while you continue.');
      startTimedHighlight();
    };
    recognition.onend = () => {
      if (phaseRef.current === 'reading' && highlightedWordsRef.current < passageWords.length - 4) {
        setReadMessage('Storey lost the words for a moment, so the reading glow will keep pace from here.');
        startTimedHighlight();
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      scheduleRecognitionFallback();
    } catch {
      setReadMessage('Speech recognition did not start, so Storey will follow your reading pace gently.');
      startTimedHighlight();
    }
  }

  function scheduleRecognitionFallback() {
    clearFallbackTimeout();
    fallbackTimeoutRef.current = setTimeout(() => {
      if (phaseRef.current !== 'reading' || highlightedWordsRef.current >= passageWords.length - 4) {
        return;
      }

      setReadMessage('It is noisy, so Storey will keep the reading glow moving while you continue.');
      startTimedHighlight();
    }, recognitionFallbackDelayMs);
  }

  function startTimedHighlight() {
    clearFallbackTimeout();
    clearHighlightInterval();
    highlightIntervalRef.current = setInterval(() => {
      setHighlightedWords((current) => {
        const next = current + 1;

        if (next >= passageWords.length) {
          clearHighlightInterval();
          setTimeout(startTransition, 700);
        }

        return Math.min(next, passageWords.length);
      });
    }, highlightIntervalMs);
  }

  function startTransition() {
    if (phase === 'transition' || phase === 'greet') {
      return;
    }

    stopReadingCapture();
    setPhase('transition');
    setHighlightedWords(passageWords.length);
    clearTransitionTimeout();
    transitionTimeoutRef.current = setTimeout(() => {
      setPhase('greet');
    }, transitionDelayMs);
  }

  async function pressGreet() {
    if (isGreetRecording) {
      setIsGreetRecording(false);
      return;
    }

    const stream = await requestMicrophoneStream();

    if (!stream) {
      setReadMessage('Microphone access is optional here. You can use email to continue.');
      return;
    }

    stream.getTracks().forEach((track) => track.stop());
    setIsGreetRecording(true);
  }

  function goToOnboarding(step?: 1 | 2) {
    router.push((step === 2 ? '/onboarding?step=2' : '/onboarding') as Href);
  }

  function stopReadingCapture() {
    if (analyserFrameRef.current) {
      cancelAnimationFrame(analyserFrameRef.current);
      analyserFrameRef.current = null;
    }

    clearFallbackTimeout();
    clearHighlightInterval();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // The browser may already have stopped the recognizer.
      }
      recognitionRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }

  function clearTransitionTimeout() {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
  }

  function clearHighlightInterval() {
    if (highlightIntervalRef.current) {
      clearInterval(highlightIntervalRef.current);
      highlightIntervalRef.current = null;
    }
  }

  function clearFallbackTimeout() {
    if (fallbackTimeoutRef.current) {
      clearTimeout(fallbackTimeoutRef.current);
      fallbackTimeoutRef.current = null;
    }
  }

  const showReadLayer = phase === 'read' || phase === 'reading';
  const showGreet = phase === 'greet';
  const showTransition = phase === 'transition';

  return (
    <View style={stageStyle}>
      <View style={[styles.nightBg, { opacity: showGreet ? 0 : 1 }]} />
      <View style={[styles.cosmosLayer, { opacity: showReadLayer ? 1 : 0 }]}>
        <Nebula />
        <StarField />
      </View>
      <View style={[styles.dawnBg, { opacity: showTransition || showGreet ? 1 : 0 }]} />
      <View style={[styles.dawnGlow, { opacity: showGreet ? 1 : 0 }]} />
      <View style={[styles.envelope, getEnvelopeStyle(showTransition || showGreet, showTransition)]} />

      <View
        pointerEvents={showReadLayer ? 'auto' : 'none'}
        style={[styles.readLayer, { opacity: showReadLayer ? 1 : 0 }]}
      >
        <Text style={styles.nightWordmark}>STOREYBOX</Text>
        <View style={styles.passageWrap}>
          <View style={styles.passageRule} />
          <Text style={styles.passage}>
            {passageWords.map((word, index) => (
              <Text
                key={`${word}-${index}`}
                style={index < highlightedWords ? styles.passageWordActive : styles.passageWord}
              >
                {word}{' '}
              </Text>
            ))}
          </Text>
          <View style={styles.passageRuleBottom} />
        </View>
        <View style={styles.readControl}>
          <Pressable onPress={() => void pressRead()} style={styles.readButton}>
            {phase === 'read' ? (
              <>
                <View style={[styles.pulseRing, styles.pulseRingOne]} />
                <View style={[styles.pulseRing, styles.pulseRingTwo]} />
              </>
            ) : null}
            {phase === 'reading' ? <View style={styles.readingRing} /> : null}
            <View style={styles.readButtonCore}>
              <HeroMicIcon color="#f1d8aa" />
            </View>
          </Pressable>
          <Text style={phase === 'reading' ? styles.readingLabel : styles.readLabel}>
            {phase === 'reading'
              ? '● READING · TAP WHEN DONE'
              : isWaitingForAudio
                ? 'LISTENING FOR YOUR VOICE'
                : 'PRESS TO READ ALOUD'}
          </Text>
          {phase === 'read' ? (
            <Text style={styles.readHint}>Reading aloud is how you enter — your microphone will turn on.</Text>
          ) : null}
          {readMessage ? <Text style={styles.readMessage}>{readMessage}</Text> : null}
          {hasAccessibilityFallback ? (
            <Pressable onPress={startTransition} style={styles.accessibilityLink}>
              <Text style={styles.accessibilityText}>Use accessibility entry</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View
        pointerEvents={showGreet ? 'auto' : 'none'}
        style={[styles.greetLayer, { opacity: showGreet ? 1 : 0 }]}
      >
        <View style={[styles.greetGrid, isCompact && styles.greetGridCompact]}>
          {!isCompact ? (
            <>
              <View style={styles.greetBrand}>
                <View style={styles.greetBrandGlow} />
                <Text style={styles.greetWordmark}>STOREYBOX</Text>
                <View style={styles.greetBrandCopy}>
                  <Text style={styles.greetBrandTitle}>A place for the things worth keeping.</Text>
                  <Text style={styles.greetBrandBody}>
                    Speak a memory. Storeybox keeps the audio, a clean transcript, a gentle summary,
                    and a few quiet signals — then hands it back when you need it.
                  </Text>
                </View>
                <View>
                  <Text style={styles.greetPromise}>Nothing is shared. Your story stays yours.</Text>
                  <Text style={styles.greetFoot}>PRIVATE BY DEFAULT · ENCRYPTED · DELETABLE ANYTIME</Text>
                </View>
              </View>
              <View style={styles.greetDivider} />
            </>
          ) : null}

          <View style={styles.greetMain}>
            <View style={styles.greetSunrise} />
            <Text style={styles.greetTitle}>
              There you are.{'\n'}
              <Text style={styles.greetTitleItalic}>I'm Storey.</Text>
            </Text>
            <Text style={styles.greetBody}>
              Introduce yourself — your name, where you are, and what kind of day it's been. However
              you'd greet a friend you've missed.
            </Text>
            <Pressable onPress={() => void pressGreet()} style={styles.greetMic}>
              <View style={styles.greetHaze} />
              <View style={styles.greetRing} />
              {isGreetRecording ? <View style={styles.greetLiveRing} /> : null}
              <View style={styles.greetCore}>
                <HeroMicIcon color="#cdd9e5" />
              </View>
            </Pressable>

            {isGreetRecording ? (
              <>
                <View style={styles.greetListening}>
                  <View style={styles.greetListeningDot} />
                  <Text style={styles.greetListeningText}>LISTENING</Text>
                </View>
                <Waveform bars={makeWave(44, 9, 26)} color="#c4a06a" height={30} />
                <Pressable onPress={() => goToOnboarding()} style={styles.greetContinue}>
                  <Text style={styles.greetContinueText}>That's me — continue</Text>
                  <Text style={styles.greetContinueArrow}>›</Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.greetHint}>Press, and say hello.</Text>
            )}

            <Pressable onPress={() => goToOnboarding(2)} style={styles.emailLink}>
              <Text style={styles.emailLinkText}>
                Prefer to type? <Text style={styles.emailLinkAccent}>Use email</Text>
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

async function requestMicrophoneStream() {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') {
    return null;
  }

  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    return null;
  }
}

function getAudioContextClass() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.AudioContext ?? window.webkitAudioContext ?? null;
}

function getSpeechRecognitionClass() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

function getSpeechTranscript(event: SpeechRecognitionEventLike) {
  const pieces: string[] = [];

  for (let index = 0; index < event.results.length; index += 1) {
    const result = event.results[index];
    const item = result[0];

    if (item?.transcript) {
      pieces.push(item.transcript);
    }
  }

  return pieces.join(' ');
}

function countSpokenWords(transcript: string) {
  return transcript
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function getInputLevel(data: Uint8Array) {
  let total = 0;

  data.forEach((value) => {
    const centered = (value - 128) / 128;
    total += centered * centered;
  });

  return Math.sqrt(total / data.length);
}

function getEnvelopeStyle(isOpen: boolean, isVisible: boolean) {
  return {
    opacity: isVisible ? 0.97 : 0,
    transform: [{ translateX: '-50%' }, { translateY: '-50%' }, { scale: isOpen ? 1 : 0.0005 }],
  } as unknown as ViewStyle;
}

function Nebula() {
  return (
    <>
      <View style={[styles.nebula, styles.nebulaViolet]} />
      <View style={[styles.nebula, styles.nebulaTeal]} />
      <View style={[styles.nebula, styles.nebulaRose]} />
      <View style={[styles.nebula, styles.nebulaGold]} />
      <View style={[styles.nebula, styles.nebulaMagenta]} />
      <View style={[styles.nebula, styles.nebulaDust]} />
    </>
  );
}

function StarField() {
  const stars = [
    { top: '9%', left: '14%', size: 2, opacity: 0.5 },
    { top: '16%', left: '26%', size: 3, animation: 'twinkle 4s ease-in-out infinite' },
    { top: '12%', left: '74%', size: 2, opacity: 0.6 },
    { top: '22%', left: '84%', size: 2, animation: 'twinkle 5s ease-in-out infinite .5s' },
    { top: '34%', left: '8%', size: 2, opacity: 0.4 },
    { top: '30%', left: '90%', size: 3, animation: 'twinkle 6s ease-in-out infinite 1s' },
    { top: '26%', left: '48%', size: 2, opacity: 0.3 },
    { top: '42%', left: '64%', size: 2, animation: 'twinkle 4.5s ease-in-out infinite 1.4s' },
  ];
  const sparks = [
    { left: '24%', bottom: '18%', delay: '0s' },
    { left: '38%', bottom: '14%', delay: '1.4s' },
    { left: '56%', bottom: '20%', delay: '2.6s' },
    { left: '68%', bottom: '15%', delay: '3.8s' },
    { left: '47%', bottom: '12%', delay: '5s' },
  ];

  return (
    <>
      {stars.map((star, index) => (
        <View
          key={`star-${index}`}
          style={[
            styles.star,
            {
              animation: star.animation,
              height: star.size,
              left: star.left,
              opacity: star.opacity,
              top: star.top,
              width: star.size,
            } as unknown as ViewStyle,
          ]}
        />
      ))}
      {sparks.map((spark, index) => (
        <View
          key={`spark-${index}`}
          style={[
            styles.spark,
            {
              animationDelay: spark.delay,
              bottom: spark.bottom,
              left: spark.left,
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

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitAudioContext?: typeof AudioContext;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

const styles = StyleSheet.create({
  stage: {
    backgroundColor: '#131922',
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
  nightBg: {
    backgroundImage: 'radial-gradient(ellipse at 50% 36%,#2c3c54 0%,#1b2533 56%,#131922 100%)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    transition: 'opacity 1.7s ease',
  } as unknown as ViewStyle,
  cosmosLayer: {
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
    position: 'absolute',
    right: 0,
    top: 0,
    transition: 'opacity 1.3s ease',
  } as unknown as ViewStyle,
  dawnBg: {
    backgroundImage: 'linear-gradient(180deg,#f7f3ec 0%,#f3ecdf 100%)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    transition: 'opacity 1.7s ease',
  } as unknown as ViewStyle,
  dawnGlow: {
    backgroundImage: 'radial-gradient(ellipse at 50% 100%,rgba(238,206,150,.5),transparent 64%)',
    bottom: -80,
    height: '42vh',
    left: 0,
    pointerEvents: 'none',
    position: 'absolute',
    right: 0,
    transition: 'opacity 1.7s ease',
  } as unknown as ViewStyle,
  envelope: {
    backgroundImage:
      'radial-gradient(circle, rgba(228,240,251,1) 0%, rgba(190,214,235,.96) 26%, rgba(140,168,198,.84) 48%, rgba(120,150,184,.46) 70%, rgba(120,150,184,.14) 88%, rgba(120,150,184,0) 100%)',
    borderRadius: '50%',
    height: '200vmax',
    left: '50%',
    pointerEvents: 'none',
    position: 'absolute',
    top: '50%',
    transition: 'transform 4s cubic-bezier(.2,.65,.25,1), opacity 1.2s ease',
    width: '200vmax',
    willChange: 'transform,opacity',
    zIndex: 3,
  } as unknown as ViewStyle,
  readLayer: {
    alignItems: 'center',
    bottom: 0,
    flexDirection: 'column',
    height: '100vh',
    left: 0,
    paddingHorizontal: '8vw',
    paddingVertical: '6vh',
    position: 'absolute',
    right: 0,
    textAlign: 'center',
    top: 0,
    transition: 'opacity 1s ease',
    width: '100vw',
  } as unknown as ViewStyle,
  nightWordmark: {
    color: '#9fb4c9',
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 4.08,
    lineHeight: 12,
  },
  passageWrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  passageRule: {
    backgroundColor: 'rgba(201,219,235,.45)',
    height: 1,
    marginBottom: 30,
    width: 28,
  },
  passageRuleBottom: {
    backgroundColor: 'rgba(201,219,235,.45)',
    height: 1,
    marginTop: 30,
    width: 28,
  },
  passage: {
    fontFamily: fonts.serif,
    fontSize: 27,
    fontWeight: '300',
    letterSpacing: -0.135,
    lineHeight: 43.2,
    maxWidth: 620,
    textAlign: 'center',
  },
  passageWord: {
    color: '#e9eef3',
    textShadow: '0 0 0 rgba(0,0,0,0)',
    transition: 'color .55s ease, text-shadow .3s ease',
  } as unknown as TextStyle,
  passageWordActive: {
    color: '#eccf9a',
    textShadow: '0 0 14px rgba(233,199,154,.35)',
    transition: 'color .55s ease, text-shadow .3s ease',
  } as unknown as TextStyle,
  readControl: {
    alignItems: 'center',
    gap: 15,
  },
  readButton: {
    height: 76,
    position: 'relative',
    width: 76,
  },
  pulseRing: {
    borderColor: 'rgba(236,200,143,.5)',
    borderRadius: '50%',
    borderWidth: 1,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  } as unknown as ViewStyle,
  pulseRingOne: {
    animation: 'pulseRing 3s ease-out infinite',
  } as unknown as ViewStyle,
  pulseRingTwo: {
    animation: 'pulseRing 3s ease-out infinite 1.5s',
  } as unknown as ViewStyle,
  readingRing: {
    borderColor: '#c0883f',
    borderRadius: '50%',
    borderWidth: 1.5,
    bottom: -6,
    boxShadow: '0 0 0 7px rgba(192,136,63,.14), 0 0 28px rgba(192,136,63,.3)',
    left: -6,
    position: 'absolute',
    right: -6,
    top: -6,
  } as unknown as ViewStyle,
  readButtonCore: {
    alignItems: 'center',
    backgroundImage: 'radial-gradient(circle at 40% 36%,#36475f,#1d2735)',
    borderColor: 'rgba(236,200,143,.6)',
    borderRadius: '50%',
    borderWidth: 1,
    bottom: 0,
    boxShadow: '0 0 26px rgba(233,199,154,.26)',
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    transition: 'transform .25s ease, box-shadow .25s ease',
  } as unknown as ViewStyle,
  readLabel: {
    color: '#d8c5a4',
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 2.88,
    lineHeight: 12,
  },
  readingLabel: {
    color: '#e7b27a',
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 2.88,
    lineHeight: 12,
  },
  readHint: {
    color: '#94a2b4',
    fontFamily: fonts.serif,
    fontSize: 14,
    fontStyle: 'italic',
    fontWeight: '400',
    lineHeight: 19.6,
    maxWidth: 340,
    textAlign: 'center',
  },
  readMessage: {
    color: '#f1d8aa',
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    maxWidth: 360,
    textAlign: 'center',
  },
  accessibilityLink: {
    borderColor: 'rgba(236,200,143,.45)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  accessibilityText: {
    color: '#d8c5a4',
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '600',
  },
  greetLayer: {
    bottom: 0,
    height: '100vh',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    transition: 'opacity 1.4s ease .15s',
    width: '100vw',
    zIndex: 4,
  } as unknown as ViewStyle,
  greetGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1px 1.04fr',
    height: '100vh',
    minHeight: '100vh',
    width: '100vw',
  } as unknown as ViewStyle,
  greetGridCompact: {
    display: 'flex',
    height: '100vh',
  } as unknown as ViewStyle,
  greetBrand: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    justifyContent: 'space-between',
    overflow: 'hidden',
    paddingHorizontal: '4vw',
    paddingVertical: '7vh',
    position: 'relative',
  } as unknown as ViewStyle,
  greetBrandGlow: {
    animation: 'breatheSoft 8s ease-in-out infinite',
    backgroundImage: 'radial-gradient(ellipse,#cbdcea,transparent 66%)',
    height: 340,
    left: '40%',
    opacity: 0.5,
    pointerEvents: 'none',
    position: 'absolute',
    top: '46%',
    transform: [{ translateX: -230 }, { translateY: -170 }],
    width: 460,
  } as unknown as ViewStyle,
  greetWordmark: {
    color: colors.blue,
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 3.6,
    lineHeight: 12,
  },
  greetBrandCopy: {
    position: 'relative',
  },
  greetBrandTitle: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 40,
    fontWeight: '300',
    letterSpacing: -0.6,
    lineHeight: 44,
    maxWidth: 420,
  },
  greetBrandBody: {
    color: '#5f6a76',
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 24,
    marginTop: 22,
    maxWidth: 360,
  },
  greetPromise: {
    color: '#3a4a58',
    fontFamily: fonts.serif,
    fontSize: 19,
    fontStyle: 'italic',
    fontWeight: '400',
    lineHeight: 26.6,
    maxWidth: 320,
  },
  greetFoot: {
    color: '#a6a092',
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 1.6,
    lineHeight: 10,
    marginTop: 12,
  },
  greetDivider: {
    backgroundColor: '#e6ddcd',
    height: '100vh',
  } as unknown as ViewStyle,
  greetMain: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: '5vw',
    paddingVertical: '7vh',
    position: 'relative',
    textAlign: 'center',
  } as unknown as ViewStyle,
  greetSunrise: {
    backgroundImage: 'radial-gradient(ellipse at 50% 0%,rgba(238,206,150,.34),transparent 64%)',
    height: 260,
    left: 0,
    pointerEvents: 'none',
    position: 'absolute',
    right: 0,
    top: -60,
  } as unknown as ViewStyle,
  greetTitle: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 50,
    fontWeight: '300',
    letterSpacing: -1,
    lineHeight: 52.5,
    position: 'relative',
    textAlign: 'center',
  },
  greetTitleItalic: {
    fontStyle: 'italic',
    fontWeight: '200',
  },
  greetBody: {
    color: '#5f6a76',
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 25.92,
    marginTop: 22,
    maxWidth: 390,
    position: 'relative',
    textAlign: 'center',
  },
  greetMic: {
    height: 122,
    marginTop: 34,
    position: 'relative',
    width: 122,
  },
  greetHaze: {
    animation: 'haze 7s ease-in-out infinite',
    backgroundImage: 'radial-gradient(circle,#9fc0de 0%,#bcd2e6 38%,transparent 70%)',
    borderRadius: '50%',
    bottom: -18,
    left: -18,
    position: 'absolute',
    right: -18,
    top: -18,
  } as unknown as ViewStyle,
  greetRing: {
    borderColor: '#cdd9e5',
    borderRadius: '50%',
    borderWidth: 1,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  } as unknown as ViewStyle,
  greetLiveRing: {
    borderColor: '#c0883f',
    borderRadius: '50%',
    borderWidth: 1.5,
    bottom: -9,
    boxShadow: '0 0 0 7px rgba(192,136,63,.12)',
    left: -9,
    position: 'absolute',
    right: -9,
    top: -9,
  } as unknown as ViewStyle,
  greetCore: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: '50%',
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
    position: 'relative',
  },
  greetListening: {
    alignItems: 'center',
    backgroundColor: '#f6ecde',
    borderColor: '#e7d3b3',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    position: 'relative',
  },
  greetListeningDot: {
    backgroundColor: '#c0883f',
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  greetListeningText: {
    color: '#a06c2f',
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  greetContinue: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    height: 48,
    marginTop: 20,
    paddingHorizontal: 26,
  },
  greetContinueText: {
    color: colors.background,
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '600',
  },
  greetContinueArrow: {
    color: colors.background,
    fontFamily: fonts.sans,
    fontSize: 21,
    lineHeight: 20,
  },
  emailLink: {
    marginTop: 26,
    position: 'relative',
  },
  emailLinkText: {
    color: colors.faint,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '500',
  },
  emailLinkAccent: {
    color: colors.blue,
  },
  nebula: {
    filter: 'blur(30px)',
    mixBlendMode: 'screen',
    position: 'absolute',
  } as unknown as ViewStyle,
  nebulaViolet: {
    animation: 'swirl 120s linear infinite, nebulaPulse 14s ease-in-out infinite',
    backgroundImage:
      'radial-gradient(ellipse 50% 40% at 50% 50%, rgba(140,98,196,.72), rgba(96,78,178,.32) 45%, transparent 70%)',
    height: '125%',
    left: '-22%',
    top: '-30%',
    width: '95%',
  } as unknown as ViewStyle,
  nebulaTeal: {
    animation: 'swirlRev 150s linear infinite, nebulaPulse 18s ease-in-out infinite 2s',
    backgroundImage:
      'radial-gradient(ellipse 46% 44% at 50% 50%, rgba(58,166,182,.66), rgba(46,108,168,.3) 48%, transparent 72%)',
    bottom: '-22%',
    filter: 'blur(34px)',
    height: '100%',
    right: '-16%',
    width: '85%',
  } as unknown as ViewStyle,
  nebulaRose: {
    animation: 'drift 26s ease-in-out infinite',
    backgroundImage:
      'radial-gradient(ellipse 50% 46% at 50% 50%, rgba(224,118,138,.56), rgba(176,86,128,.22) 50%, transparent 74%)',
    bottom: '-26%',
    filter: 'blur(36px)',
    height: '75%',
    left: '14%',
    width: '70%',
  } as unknown as ViewStyle,
  nebulaGold: {
    animation: 'nebulaPulse 11s ease-in-out infinite',
    backgroundImage: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(236,194,128,.4), transparent 66%)',
    filter: 'blur(28px)',
    height: '44%',
    left: '50%',
    top: '22%',
    transform: [{ translateX: '-50%' }],
    width: '50%',
  } as unknown as ViewStyle,
  nebulaMagenta: {
    animation: 'drift 32s ease-in-out infinite 3s',
    backgroundImage: 'radial-gradient(ellipse 50% 48% at 50% 50%, rgba(186,104,182,.46), transparent 68%)',
    filter: 'blur(32px)',
    height: '56%',
    right: '6%',
    top: '-12%',
    width: '46%',
  } as unknown as ViewStyle,
  nebulaDust: {
    animation: 'nebulaPulse 16s ease-in-out infinite 4s',
    backgroundImage: 'radial-gradient(ellipse 60% 30% at 50% 50%, rgba(190,206,236,.26), transparent 64%)',
    filter: 'blur(24px)',
    height: '62%',
    left: '-10%',
    top: '6%',
    transform: [{ rotate: '-18deg' }],
    width: '120%',
  } as unknown as ViewStyle,
  star: {
    backgroundColor: colors.white,
    borderRadius: '50%',
    position: 'absolute',
  } as unknown as ViewStyle,
  spark: {
    animation: 'rise 7s ease-in infinite',
    backgroundColor: '#e9c79a',
    borderRadius: '50%',
    boxShadow: '0 0 7px 1px rgba(233,199,154,.75)',
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
    width: 8,
  },
  micArc: {
    borderBottomWidth: 1.6,
    borderLeftWidth: 1.6,
    borderRightWidth: 1.6,
    borderTopWidth: 0,
    height: 10,
    marginTop: -5,
    width: 18,
  },
  micStem: {
    height: 7,
    width: 1.6,
  },
});
