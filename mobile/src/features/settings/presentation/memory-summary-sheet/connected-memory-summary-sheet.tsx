import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { MemorySummarySheetTokens } from '@/constants/theme';
import {
  fetchMemorySummary,
  regenerateMemorySummary,
  submitMemorySummaryFeedback,
  type MemorySummaryDto,
} from '@/features/settings/data/memory-summary-api';
import { mapAccountApiError } from '@/features/settings/domain/account/profile';
import { memorySummarySectionsFromContent } from '@/features/settings/domain/memory/summary';
import type { MemorySummaryStatus } from '@/features/settings/domain/memory/types';

import { MemorySummarySheet, type MemorySummarySheetProps } from './memory-summary-sheet';

export type ConnectedMemorySummarySheetProps = Pick<
  MemorySummarySheetProps,
  'isVisible' | 'onClose' | 'variant' | 'overlayZIndex' | 'style' | 'testID'
>;

const tokens = MemorySummarySheetTokens;

function mapStatus(dto: MemorySummaryDto | null): MemorySummaryStatus {
  if (!dto || dto.status === 'generating') {
    return 'generating';
  }
  if (dto.status === 'failed') {
    return 'failed';
  }
  return 'generated';
}

function subtitleFromSummary(dto: MemorySummaryDto | null, status: MemorySummaryStatus): string {
  if (status === 'generating') {
    return 'Generating';
  }
  if (status === 'failed') {
    return 'Failed';
  }
  if (!dto?.generatedAt) {
    return 'Updated just now';
  }
  const generatedAt = Date.parse(dto.generatedAt);
  if (Number.isNaN(generatedAt) || Date.now() - generatedAt < 60_000) {
    return 'Updated just now';
  }
  return `Updated ${new Date(generatedAt).toLocaleString()}`;
}

export function ConnectedMemorySummarySheet({
  isVisible,
  onClose,
  variant,
  overlayZIndex,
  style,
  testID = 'memory-summary-sheet',
}: ConnectedMemorySummarySheetProps) {
  const [summary, setSummary] = useState<MemorySummaryDto | null>(null);
  const [hasError, setHasError] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);

  const clearPoll = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const applySummary = useCallback((next: MemorySummaryDto | null) => {
    if (!cancelled.current) {
      setSummary(next);
    }
  }, []);

  const loadSummary = useCallback(async (options: { regenerateIfMissing: boolean; startedAt: number }) => {
    try {
      const payload = await fetchMemorySummary();
      if (cancelled.current) {
        return;
      }

      let next = payload.summary;
      if (options.regenerateIfMissing && next === null) {
        const regenerated = await regenerateMemorySummary();
        next = regenerated.summary;
      }

      applySummary(next);
      setHasError(false);
      const status = mapStatus(next);
      const elapsed = Date.now() - options.startedAt;
      if (status === 'generating' && elapsed < tokens.pollTimeoutMs) {
        pollTimer.current = setTimeout(() => {
          void loadSummary({ regenerateIfMissing: false, startedAt: options.startedAt });
        }, tokens.pollIntervalMs);
        return;
      }
      if (status === 'generating') {
        setHasError(true);
      }
    } catch (error) {
      if (!cancelled.current) {
        Alert.alert('Unable to load memory summary', mapAccountApiError(error));
        setHasError(true);
      }
    }
  }, [applySummary]);

  useEffect(() => {
    if (!isVisible) {
      cancelled.current = true;
      clearPoll();
      return;
    }

    cancelled.current = false;
    setSummary(null);
    setHasError(false);
    void loadSummary({ regenerateIfMissing: true, startedAt: Date.now() });

    return () => {
      cancelled.current = true;
      clearPoll();
    };
  }, [isVisible, clearPoll, loadSummary]);

  const handleRegenerate = async () => {
    clearPoll();
    setHasError(false);
    applySummary(summary ? { ...summary, status: 'generating', content: null } : null);
    try {
      const regenerated = await regenerateMemorySummary();
      applySummary(regenerated.summary);
      if (regenerated.summary?.status === 'generating') {
        void loadSummary({ regenerateIfMissing: false, startedAt: Date.now() });
      }
    } catch (error) {
      Alert.alert('Unable to regenerate memory summary', mapAccountApiError(error));
    }
  };

  const handleFeedback = async (text: string) => {
    clearPoll();
    setHasError(false);
    applySummary(summary ? { ...summary, status: 'generating' } : null);
    try {
      const payload = await submitMemorySummaryFeedback(text.slice(0, 500));
      applySummary(payload.summary);
      if (payload.summary?.status === 'generating') {
        void loadSummary({ regenerateIfMissing: false, startedAt: Date.now() });
      }
    } catch (error) {
      Alert.alert('Unable to save feedback', mapAccountApiError(error));
    }
  };

  const status = hasError ? 'failed' : mapStatus(summary);

  return (
    <MemorySummarySheet
      isVisible={isVisible}
      onClose={onClose}
      variant={variant}
      overlayZIndex={overlayZIndex}
      onRegenerate={() => {
        void handleRegenerate();
      }}
      onComposerSubmit={(text) => {
        void handleFeedback(text);
      }}
      sections={memorySummarySectionsFromContent(summary?.content)}
      status={status}
      subtitle={subtitleFromSummary(summary, status)}
      style={style}
      testID={testID}
    />
  );
}
