import { supabase } from '@/lib/supabase';
import type { Memory } from '@/lib/memories';

type ProcessMemoryResponse = {
  memory: Memory;
};

export async function processMemory(memoryId: string, audioPath: string) {
  const result = await supabase.functions.invoke<ProcessMemoryResponse>('process-memory', {
    body: {
      memoryId,
      audioPath,
    },
  });

  if (!result.error) {
    return result;
  }

  return {
    data: result.data,
    error: new Error(await readFunctionErrorMessage(result.error)),
  };
}

async function readFunctionErrorMessage(error: unknown) {
  const context = isRecord(error) ? error.context : null;

  if (typeof Response !== 'undefined' && context instanceof Response) {
    try {
      const body = await context.clone().json();

      if (isRecord(body) && typeof body.error === 'string') {
        return body.error;
      }
    } catch {
      // Fall back to the client error message below.
    }
  }

  return error instanceof Error ? error.message : 'Memory processing failed.';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
