import { apiRequest } from '@/lib/api';
import { createUuid } from '@/features/chat/data/uuid';

export type MemorySummaryApiStatus = 'generating' | 'ready' | 'failed';

export type MemorySummaryDto = {
  content: string | null;
  status: MemorySummaryApiStatus;
  version: number;
  feedback: string | null;
  generatedAt: string | null;
  expiresAt: string | null;
  updatedAt: string;
};

export type MemorySummaryGetResponse = {
  summary: MemorySummaryDto | null;
};

export type MemorySummaryGenerationStatus = 'queued' | 'completed' | 'failed';

export type MemorySummaryRegenerateResponse = {
  summary: MemorySummaryDto | null;
  generation: {
    source: string;
    runtimeStatus: MemorySummaryGenerationStatus;
  };
};

export async function fetchMemorySummary(): Promise<MemorySummaryGetResponse> {
  return apiRequest<MemorySummaryGetResponse>('/memory/summary');
}

export async function regenerateMemorySummary(): Promise<MemorySummaryRegenerateResponse> {
  return apiRequest<MemorySummaryRegenerateResponse>('/memory/summary/regenerate', {
    method: 'POST',
    body: { idempotencyKey: createUuid() },
  });
}

export async function submitMemorySummaryFeedback(
  feedback: string,
): Promise<MemorySummaryGetResponse> {
  return apiRequest<MemorySummaryGetResponse>('/memory/summary/feedback', {
    method: 'POST',
    body: {
      idempotencyKey: createUuid(),
      feedback,
    },
  });
}
