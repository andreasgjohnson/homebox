import type { AIProvider, MemorySummary, SummarizeMemoryOptions } from './types.ts';

const memorySummarySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'emotional_tone', 'tags', 'memorable_quotes'],
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    emotional_tone: { type: 'string' },
    tags: {
      type: 'array',
      items: { type: 'string' },
    },
    memorable_quotes: {
      type: 'array',
      items: { type: 'string' },
    },
  },
};

const summarySystemPrompt = [
  'You are helping users preserve meaningful memories.',
  'Read the transcript of a personal audio recording and return concise structured metadata.',
  'Keep the title specific and human, not generic.',
  'Use warm, plain language without inventing details that are not in the transcript.',
  'If the transcript is short, sparse, or unclear, still summarize only what is present.',
].join(' ');

export class OpenAIProvider implements AIProvider {
  constructor(
    private readonly apiKey: string,
    private readonly transcribeModel = 'gpt-4o-transcribe',
    private readonly summaryModel = 'gpt-4.1-mini',
  ) {}

  async transcribeAudio(audio: Blob, fileName: string) {
    const formData = new FormData();
    formData.append('model', this.transcribeModel);
    formData.append('response_format', 'json');
    formData.append('file', new File([audio], fileName, { type: getAudioMimeType(audio) }));

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    const body = await parseOpenAIResponse(response);

    if (!isRecord(body) || typeof body.text !== 'string' || body.text.trim().length === 0) {
      throw new Error('OpenAI returned an empty transcription.');
    }

    return body.text.trim();
  }

  async summarizeMemory(transcript: string, options: SummarizeMemoryOptions = {}) {
    const ownerFirstName = cleanOwnerFirstName(options.ownerFirstName);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.summaryModel,
        messages: [
          { role: 'system', content: summarySystemPrompt },
          {
            role: 'system',
            content: ownerFirstName
              ? `The account owner's first name is ${ownerFirstName}. Write directly to the account owner in second person. When referring to the speaker or account owner, use "you" instead of "${ownerFirstName}", "the speaker", "the user", or "they". Use first names only when naming other people mentioned in the transcript.`
              : 'Write directly to the account owner in second person when that feels natural. Avoid robotic phrases like "the speaker" or "the user". Use first names only when naming people mentioned in the transcript.',
          },
          {
            role: 'user',
            content: `Transcript:\n\n${transcript}`,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'memory_summary',
            strict: true,
            schema: memorySummarySchema,
          },
        },
      }),
    });

    const body = await parseOpenAIResponse(response);
    const content = getChatCompletionContent(body);

    let parsed: unknown;

    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error('OpenAI returned summary JSON that could not be parsed.');
    }

    return validateMemorySummary(parsed);
  }
}

function cleanOwnerFirstName(ownerFirstName: string | null | undefined) {
  const cleaned = ownerFirstName?.replace(/\s+/g, ' ').trim().split(' ')[0];

  if (!cleaned) {
    return null;
  }

  return cleaned.slice(0, 80);
}

function getAudioMimeType(audio: Blob) {
  return audio.type || 'audio/mp4';
}

async function parseOpenAIResponse(response: Response) {
  const text = await response.text();
  let body: unknown = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const message =
      isRecord(body) && isRecord(body.error) && typeof body.error.message === 'string'
        ? body.error.message
        : `OpenAI request failed with status ${response.status}.`;

    throw new Error(message);
  }

  return body;
}

function getChatCompletionContent(body: unknown) {
  if (!isRecord(body) || !Array.isArray(body.choices)) {
    throw new Error('OpenAI returned an unexpected summary response.');
  }

  const firstChoice = body.choices[0];

  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    throw new Error('OpenAI returned an unexpected summary response.');
  }

  const { content } = firstChoice.message;

  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('OpenAI returned an empty summary.');
  }

  return content;
}

function validateMemorySummary(value: unknown): MemorySummary {
  if (!isRecord(value)) {
    throw new Error('OpenAI summary did not match the expected structure.');
  }

  const title = readRequiredString(value, 'title');
  const summary = readRequiredString(value, 'summary');
  const emotional_tone = readRequiredString(value, 'emotional_tone');
  const tags = readStringArray(value, 'tags').slice(0, 8);
  const memorable_quotes = readStringArray(value, 'memorable_quotes').slice(0, 5);

  return {
    title,
    summary,
    emotional_tone,
    tags,
    memorable_quotes,
  };
}

function readRequiredString(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`OpenAI summary is missing "${key}".`);
  }

  return value.trim();
}

function readStringArray(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`OpenAI summary is missing "${key}".`);
  }

  return value.map((item) => item.trim()).filter(Boolean);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
