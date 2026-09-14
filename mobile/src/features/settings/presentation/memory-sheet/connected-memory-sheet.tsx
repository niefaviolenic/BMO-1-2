import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { useAuthSession } from '@/features/auth/presentation/auth-session-provider';
import {
  deleteMemoryRecord,
  fetchMemoriesList,
  fetchMemoryProfileFields,
  fetchMemorySettings,
  saveMemoryProfileFields,
  updateMemorySettings,
  type MemoryItemDto,
} from '@/features/settings/data/memory-settings-api';
import { mapAccountApiError } from '@/features/settings/domain/account/profile';
import type { MemorySettings } from '@/features/settings/domain/memory/types';

import { MemorySheet, type MemorySheetProps } from './memory-sheet';

export type ConnectedMemorySheetProps = Pick<
  MemorySheetProps,
  | 'isVisible'
  | 'onClose'
  | 'onMemorySummaryPress'
  | 'onLearnMorePress'
  | 'onCustomInstructionsPress'
  | 'variant'
  | 'overlayZIndex'
  | 'style'
  | 'testID'
>;

export function ConnectedMemorySheet({
  isVisible,
  onClose,
  onMemorySummaryPress,
  onLearnMorePress,
  onCustomInstructionsPress,
  variant,
  overlayZIndex,
  style,
  testID = 'memory-sheet',
}: ConnectedMemorySheetProps) {
  const { user, applyUser } = useAuthSession();
  const [initialValues, setInitialValues] = useState<Partial<MemorySettings> | undefined>();
  const [memories, setMemories] = useState<MemoryItemDto[]>([]);
  const [isLoadingMemories, setIsLoadingMemories] = useState(false);

  useEffect(() => {
    if (!isVisible || !user) {
      return;
    }

    let cancelled = false;

    void Promise.all([
      fetchMemorySettings(),
      fetchMemoryProfileFields(user.id, user.displayName),
    ])
      .then(([settings, profile]) => {
        if (!cancelled) {
          setInitialValues({
            enableMemory: settings.automaticMemoryCandidates,
            nickname: profile.nickname,
            occupation: profile.occupation,
            moreAboutYou: profile.moreAboutYou,
          });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          Alert.alert('Unable to load memory settings', mapAccountApiError(error));
        }
      });

    setIsLoadingMemories(true);
    void fetchMemoriesList()
      .then((list) => {
        if (!cancelled) {
          setMemories(list);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setIsLoadingMemories(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isVisible, user?.id, user?.displayName]);

  const handleSave = async (values: MemorySettings) => {
    if (!user) {
      Alert.alert('Unable to save memory settings', 'Sign in to save memory settings.');
      throw new Error('Not authenticated');
    }

    try {
      const [saved, nickname] = await Promise.all([
        updateMemorySettings(values.enableMemory),
        saveMemoryProfileFields(user.id, {
          nickname: values.nickname,
          occupation: values.occupation,
          moreAboutYou: values.moreAboutYou,
        }),
      ]);

      if (nickname !== (user.displayName ?? '')) {
        await applyUser({ ...user, displayName: nickname || null });
      }

      setInitialValues({
        enableMemory: saved.automaticMemoryCandidates,
        nickname,
        occupation: values.occupation,
        moreAboutYou: values.moreAboutYou,
      });
    } catch (error) {
      Alert.alert('Unable to save memory settings', mapAccountApiError(error));
      throw error;
    }
  };

  const handleDeleteMemory = async (id: string) => {
    await deleteMemoryRecord(id);
    setMemories((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <MemorySheet
      isVisible={isVisible}
      variant={variant}
      overlayZIndex={overlayZIndex}
      onClose={onClose}
      initialValues={initialValues}
      onSave={handleSave}
      onMemorySummaryPress={onMemorySummaryPress}
      onLearnMorePress={onLearnMorePress}
      onCustomInstructionsPress={onCustomInstructionsPress}
      memories={memories}
      isLoadingMemories={isLoadingMemories}
      onDeleteMemory={handleDeleteMemory}
      style={style}
      testID={testID}
    />
  );
}
