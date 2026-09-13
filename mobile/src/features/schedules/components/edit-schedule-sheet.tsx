import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ModalBottomSheet } from '@/components/ui/modal-bottom-sheet';
import { useTheme } from '@/hooks/use-theme';
import {
  mapScheduleApiError,
  type Schedule,
  type ScheduleTimeOfDay,
} from '../domain/schedule';
import { SchedulePromptField } from './schedule-prompt-field';
import { ScheduleTimeField } from './schedule-time-field';

export type EditScheduleSheetProps = {
  isVisible: boolean;
  onClose: () => void;
  schedule: Schedule | null;
  onSave: (id: string, patch: { prompt?: string; timeOfDay?: ScheduleTimeOfDay }) => Promise<void>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const TIMES_OF_DAY: ScheduleTimeOfDay[] = ['Morning', 'Afternoon', 'Evening'];

export function EditScheduleSheet({
  isVisible,
  onClose,
  schedule,
  onSave,
  style,
  testID = 'edit-schedule-sheet',
}: EditScheduleSheetProps) {
  const theme = useTheme();
  const [prompt, setPrompt] = useState(() => schedule?.payload?.prompt ?? '');
  const [timeOfDay, setTimeOfDay] = useState<ScheduleTimeOfDay>(() => {
    const scheduleTime = schedule?.recurrence?.timeOfDay;
    if (scheduleTime === 'Morning' || scheduleTime === 'Afternoon' || scheduleTime === 'Evening') {
      return scheduleTime;
    }
    return 'Morning';
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (schedule) {
      setPrompt(schedule.payload?.prompt ?? '');
      const scheduleTime = schedule.recurrence?.timeOfDay;
      if (scheduleTime === 'Morning' || scheduleTime === 'Afternoon' || scheduleTime === 'Evening') {
        setTimeOfDay(scheduleTime);
      }
    }
  }, [schedule]);

  const handleCycleTime = () => {
    const currentIndex = TIMES_OF_DAY.indexOf(timeOfDay);
    const nextIndex = (currentIndex + 1) % TIMES_OF_DAY.length;
    setTimeOfDay(TIMES_OF_DAY[nextIndex]);
  };

  const handleSave = async () => {
    if (!schedule || !prompt.trim()) return;
    setIsSaving(true);
    try {
      await onSave(schedule.id, {
        prompt: prompt.trim(),
        timeOfDay,
      });
      onClose();
    } catch (error) {
      Alert.alert('Unable to save changes', mapScheduleApiError(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalBottomSheet
      isVisible={isVisible}
      onClose={onClose}
      dragBehavior="resist"
      testID={testID}
      closeButtonTestID={`${testID}-close-button`}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.container, style]}
        testID={`${testID}-content`}
      >
        <View style={styles.headerWrapper} testID={`${testID}-header`}>
          <Text style={[styles.titleText, { color: theme.text }]} testID={`${testID}-title`}>
            Edit Schedule
          </Text>
          <Text style={[styles.subtitleText, { color: theme.textSecondary }]}>
            Update your scheduled reminder prompt and time.
          </Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.fieldsContainer}>
            <SchedulePromptField
              value={prompt}
              onChangeText={setPrompt}
              placeholder="What would you like Joy to remind you?"
              style={styles.fieldWidth}
              testID={`${testID}-prompt-field`}
            />

            <ScheduleTimeField
              timeValue={timeOfDay}
              onPressTime={handleCycleTime}
              style={styles.fieldWidth}
              testID={`${testID}-time-field`}
            />
          </View>
        </ScrollView>

        <View style={styles.actionContainer}>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              { backgroundColor: theme.text },
              (pressed || isSaving || !prompt.trim()) && styles.buttonDisabled,
            ]}
            onPress={handleSave}
            disabled={isSaving || !prompt.trim()}
            accessibilityRole="button"
            accessibilityLabel="Save Changes"
            testID={`${testID}-save-button`}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={theme.background} />
            ) : (
              <Text style={[styles.saveButtonText, { color: theme.background }]}>
                Save Changes
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ModalBottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 16,
    maxHeight: 520,
  },
  headerWrapper: {
    gap: 4,
    marginBottom: 4,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '600',
  },
  subtitleText: {
    fontSize: 13,
  },
  scrollContent: {
    gap: 12,
    alignItems: 'center',
    paddingVertical: 4,
  },
  fieldsContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  fieldWidth: {
    width: '100%',
  },
  actionContainer: {
    paddingTop: 8,
    gap: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  saveButton: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
