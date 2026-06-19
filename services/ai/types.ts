export type MemorySummary = {
  title: string;
  summary: string;
  emotional_tone: string;
  tags: string[];
  memorable_quotes: string[];
};

export type AIProvider = {
  transcribeAudio(audio: Blob, fileName: string): Promise<string>;
  summarizeMemory(transcript: string, options?: SummarizeMemoryOptions): Promise<MemorySummary>;
};

export type SummarizeMemoryOptions = {
  ownerFirstName?: string | null;
};
