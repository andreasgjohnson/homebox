import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  countTranscriptWords,
  hasTooFewWords,
  isRecordingTooShort,
  MIN_RECORD_MS,
  MIN_TRANSCRIPT_WORDS,
} from './gates.ts';

Deno.test('the thresholds are the ones the Box enforces', () => {
  assertEquals(MIN_RECORD_MS, 3000);
  assertEquals(MIN_TRANSCRIPT_WORDS, 5);
});

Deno.test('a slipped button is too short', () => {
  assertEquals(isRecordingTooShort(120), true);
  assertEquals(isRecordingTooShort(2999), true);
});

Deno.test('three seconds exactly is kept — the gate is "less than"', () => {
  assertEquals(isRecordingTooShort(3000), false);
  assertEquals(isRecordingTooShort(3001), false);
  assertEquals(isRecordingTooShort(180000), false);
});

Deno.test('an unknown duration is not treated as a slip', () => {
  // Legacy rows report no duration. Discarding on absent evidence would drop
  // real Storeys, so these fall through to the transcript gate instead.
  assertEquals(isRecordingTooShort(null), false);
  assertEquals(isRecordingTooShort(undefined), false);
  assertEquals(isRecordingTooShort(Number.NaN), false);
});

Deno.test('Whisper answering silence does not count as words', () => {
  // What Whisper actually returns for near-silent audio.
  assertEquals(countTranscriptWords('...'), 0);
  assertEquals(countTranscriptWords('. . . -'), 0);
  assertEquals(countTranscriptWords(''), 0);
  assertEquals(countTranscriptWords('   '), 0);
  assertEquals(countTranscriptWords(null), 0);
  assertEquals(countTranscriptWords(undefined), 0);
});

Deno.test('punctuation clinging to a word does not split or inflate it', () => {
  assertEquals(countTranscriptWords('Thank you.'), 2);
  assertEquals(countTranscriptWords('Hello, world!'), 2);
  assertEquals(countTranscriptWords('  spaced   out  words  '), 3);
});

Deno.test('four words is too few, five is enough', () => {
  assertEquals(hasTooFewWords('one two three four'), true);
  assertEquals(hasTooFewWords('one two three four five'), false);
});

Deno.test('a real Storey passes the word gate', () => {
  const transcript =
    'Grandma told me about the summer she learned to drive the tractor, and how she nearly put it through the barn door.';

  assertEquals(hasTooFewWords(transcript), false);
});

Deno.test('a cough or a single word is let go', () => {
  assertEquals(hasTooFewWords('Hey'), true);
  assertEquals(hasTooFewWords('you'), true);
  assertEquals(hasTooFewWords('Thank you.'), true);
});

Deno.test('word counting handles accents and non-Latin scripts', () => {
  // \p{L} rather than A-Z: a Storey in any language still counts as words.
  assertEquals(countTranscriptWords('mormor fortalte meg om sommeren'), 5);
  assertEquals(hasTooFewWords('mormor fortalte meg om sommeren'), false);
  assertEquals(countTranscriptWords('这 是 一 个 故事'), 5);
});

Deno.test('numbers count as words', () => {
  assertEquals(countTranscriptWords('1969 was the year'), 4);
});
