// Two gates keep button-mashing out of the archive and off the OpenAI bill.
//
// They sit at different layers because they have to. Duration is known on the
// Box, so SB_MIN_RECORD_MS in firmware/storeybox_esp32/sb_config.h discards a
// short recording before it is ever uploaded. MIN_RECORD_MS below is the same
// number, re-checked server-side for Boxes still running older firmware — it
// runs before any OpenAI call, so a short recording still costs nothing.
//
// Word count is different: it cannot be known until the audio is transcribed,
// and transcription IS an OpenAI call. MIN_TRANSCRIPT_WORDS therefore cannot
// prevent transcription — it prevents the summarization call that follows, and
// keeps a near-empty Storey out of the archive.

export const MIN_RECORD_MS = 3000;
export const MIN_TRANSCRIPT_WORDS = 5;

export type DiscardReason = 'too_short' | 'too_few_words';

// Null means the Box never reported a duration (legacy rows); absent evidence
// is not evidence of a slip, so those fall through to the transcript gate.
export function isRecordingTooShort(durationMs: number | null | undefined) {
  return typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs < MIN_RECORD_MS;
}

// Whisper answers silence with punctuation or filler ("...", "Thank you."), so
// a token only counts as a word if it carries a letter or a digit.
export function countTranscriptWords(transcript: string | null | undefined) {
  if (!transcript) {
    return 0;
  }

  return transcript
    .trim()
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

export function hasTooFewWords(transcript: string | null | undefined) {
  return countTranscriptWords(transcript) < MIN_TRANSCRIPT_WORDS;
}

export function describeDiscard(reason: DiscardReason, detail: number) {
  return reason === 'too_short'
    ? `Discarded: ${detail}ms is under the ${MIN_RECORD_MS}ms minimum.`
    : `Discarded: ${detail} word(s) is under the ${MIN_TRANSCRIPT_WORDS}-word minimum.`;
}
