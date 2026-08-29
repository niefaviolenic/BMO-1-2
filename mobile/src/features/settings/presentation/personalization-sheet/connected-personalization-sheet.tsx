import React, { useEffect, useState } from 'react';

import {
  fetchPersonalization,
  updatePersonalization,
} from '@/features/settings/data/personalization-api';
import { mapAccountApiError } from '@/features/settings/domain/account/profile';
import type { PersonalizationSettings } from '@/features/settings/domain/account/types';

import {
  PersonalizationSheet,
  type PersonalizationFormValues,
  type PersonalizationSheetProps,
} from './personalization-sheet';

export type ConnectedPersonalizationSheetProps = Pick<
  PersonalizationSheetProps,
  'isVisible' | 'onClose' | 'variant' | 'overlayZIndex' | 'style' | 'testID'
>;

export function ConnectedPersonalizationSheet({
  isVisible,
  onClose,
  variant,
  overlayZIndex,
  style,
  testID = 'personalization-sheet',
}: ConnectedPersonalizationSheetProps) {
  const [initialValues, setInitialValues] = useState<PersonalizationSettings | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    let cancelled = false;
    setErrorMessage(null);
    setLoading(true);

    void fetchPersonalization()
      .then((settings) => {
        if (!cancelled) {
          setInitialValues(settings);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(mapAccountApiError(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isVisible]);

  const handleSave = async (values: PersonalizationFormValues) => {
    setSaving(true);
    setErrorMessage(null);
    try {
      const saved = await updatePersonalization({
        baseStyleTone: values.baseStyleTone,
        warmth: values.warmth,
        enthusiasm: values.enthusiasm,
        headerAndLists: values.headerAndLists,
        emoji: values.emoji,
        fastAnswers: values.fastAnswers,
        customInstructions: values.customInstructions,
      });
      setInitialValues(saved);
      onClose();
    } catch (error) {
      setErrorMessage(mapAccountApiError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PersonalizationSheet
      isVisible={isVisible}
      onClose={onClose}
      initialValues={initialValues}
      onSave={handleSave}
      saving={saving || loading}
      errorMessage={errorMessage}
      variant={variant}
      overlayZIndex={overlayZIndex}
      style={style}
      testID={testID}
    />
  );
}
