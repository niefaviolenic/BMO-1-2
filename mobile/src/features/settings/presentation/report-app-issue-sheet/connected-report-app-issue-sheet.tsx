import React, { useCallback, useEffect, useState } from 'react';

import { submitBugReport } from '@/features/settings/data/bug-report-api';
import { mapBugReportApiError } from '@/features/settings/domain/bug-report/bug-report';
import type { BugReportDraft } from '@/features/settings/domain/bug-report/types';

import {
  ReportAppIssueSheet,
  type ReportAppIssueSheetProps,
} from './report-app-issue-sheet';

export type ConnectedReportAppIssueSheetProps = Pick<
  ReportAppIssueSheetProps,
  'isVisible' | 'onClose' | 'supportUrl' | 'variant' | 'overlayZIndex' | 'style' | 'testID'
> & {
  onSuccess?: () => void;
};

export function ConnectedReportAppIssueSheet({
  isVisible,
  onClose,
  supportUrl,
  variant,
  overlayZIndex,
  style,
  testID = 'report-app-issue-sheet',
  onSuccess,
}: ConnectedReportAppIssueSheetProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isVisible) {
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [isVisible]);

  const handleSend = useCallback(
    async (draft: BugReportDraft) => {
      setIsSubmitting(true);
      setErrorMessage(null);

      try {
        await submitBugReport({
          category: draft.category ?? 'GENERAL',
          description: draft.description,
          includeScreenshot: draft.includeScreenshot,
          screenshotUris: draft.screenshotUris,
        });
        setIsSubmitting(false);
        onSuccess?.();
        onClose();
      } catch (error) {
        setIsSubmitting(false);
        setErrorMessage(mapBugReportApiError(error));
      }
    },
    [onClose, onSuccess],
  );

  return (
    <ReportAppIssueSheet
      isVisible={isVisible}
      onClose={onClose}
      onSend={handleSend}
      isSubmitting={isSubmitting}
      errorMessage={errorMessage}
      supportUrl={supportUrl}
      variant={variant}
      overlayZIndex={overlayZIndex}
      style={style}
      testID={testID}
    />
  );
}
