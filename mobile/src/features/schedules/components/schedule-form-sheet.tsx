import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ModalBottomSheet } from '@/components/ui/modal-bottom-sheet';
import { useTheme } from '@/hooks/use-theme';
import {
  type DayOfWeek,
  ScheduleDaysSelectionField,
} from './schedule-days-selection-field';
import { SchedulePromptField } from './schedule-prompt-field';
import { useRobotConnection } from '@/features/robot/data/use-robot-connection';
import type { RobotDeviceInfo } from '@/features/robot/domain/robot-connection';
import {
  mapScheduleApiError,
  type Schedule,
  type ScheduleTimeOfDay,
  type ScheduleWeekday,
} from '../domain/schedule';

export type ScheduleFormData = {
  prompt: string;
  frequency: 'Daily' | 'Weekly' | 'Once';
  exactTime: string;
  timeOfDay: ScheduleTimeOfDay;
  deliveryTargets: Array<'MOBILE' | 'DEVICE'>;
  deviceId?: string | null;
  date?: string;
  days?: ScheduleWeekday[];
  repeatDay?: ScheduleWeekday;
};

export type ScheduleFormSheetProps = {
  isVisible: boolean;
  mode?: 'create' | 'edit';
  schedule?: Schedule | null;
  initialPrompt?: string;
  onClose: () => void;
  onSubmit: (data: ScheduleFormData) => Promise<void>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  devices?: RobotDeviceInfo[];
  activeDeviceId?: string | null;
};
const TIME_PRESETS = [
  { label: 'Pagi 09:00', hour: '09', minute: '00', period: 'Morning' as const },
  { label: 'Siang 13:00', hour: '13', minute: '00', period: 'Afternoon' as const },
  { label: 'Sore 16:30', hour: '16', minute: '30', period: 'Afternoon' as const },
  { label: 'Malam 20:00', hour: '20', minute: '00', period: 'Evening' as const },
];

type TimePreset = (typeof TIME_PRESETS)[number];

function deriveTimeOfDay(hourNum: number): ScheduleTimeOfDay {
  if (hourNum < 12) return 'Morning';
  if (hourNum < 18) return 'Afternoon';
  return 'Evening';
}

export function ScheduleFormSheet({
  isVisible,
  mode = 'create',
  schedule,
  initialPrompt,
  onClose,
  onSubmit,
  style,
  testID = 'schedule-form-sheet',
  devices: propsDevices,
  activeDeviceId: propsActiveDeviceId,
}: ScheduleFormSheetProps) {
  const theme = useTheme();
  const robotConnection = useRobotConnection();
  const availableDevices = propsDevices ?? robotConnection.devices;
  const activeId =
    propsActiveDeviceId ??
    robotConnection.activeDeviceId ??
    robotConnection.device?.id ??
    availableDevices[0]?.id ??
    null;

  const [targetMode, setTargetMode] = useState<'BOTH' | 'DEVICE' | 'MOBILE'>(() => {
    if (schedule && mode === 'edit') {
      const targets = schedule.payload?.deliveryTargets;
      if (targets?.includes('MOBILE') && targets?.includes('DEVICE')) return 'BOTH';
      if (targets?.includes('DEVICE')) return 'DEVICE';
      return 'MOBILE';
    }
    return activeId ? 'BOTH' : 'MOBILE';
  });

  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(() => {
    if (schedule && mode === 'edit') {
      return schedule.targetDeviceId ?? null;
    }
    return activeId;
  });
  const [prompt, setPrompt] = useState(() =>
    schedule && mode === 'edit' ? schedule.payload?.prompt ?? '' : initialPrompt ?? '',
  );
  const [frequency, setFrequency] = useState<'Daily' | 'Weekly' | 'Once'>(() => {
    const f = schedule?.recurrence?.frequency;
    if (mode === 'edit' && (f === 'Daily' || f === 'Weekly' || f === 'Once')) return f;
    return 'Daily';
  });
  const [hour, setHour] = useState(() => {
    if (schedule && mode === 'edit' && schedule.recurrence?.exactTime?.includes(':')) {
      const [h] = schedule.recurrence.exactTime.split(':');
      return h?.padStart(2, '0') ?? '09';
    }
    return '09';
  });
  const [minute, setMinute] = useState(() => {
    if (schedule && mode === 'edit' && schedule.recurrence?.exactTime?.includes(':')) {
      const [, m] = schedule.recurrence.exactTime.split(':');
      return m?.padStart(2, '0') ?? '00';
    }
    return '00';
  });
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>(() => {
    if (schedule && mode === 'edit' && Array.isArray(schedule.recurrence?.days)) {
      return schedule.recurrence.days as DayOfWeek[];
    }
    return ['Monday'];
  });
  const [dateString, setDateString] = useState(() => {
    if (schedule && mode === 'edit' && schedule.recurrence?.date) {
      return schedule.recurrence.date;
    }
    const tomorrow = new Date(Date.now() + 86400000);
    return tomorrow.toISOString().split('T')[0] ?? '';
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (schedule && mode === 'edit') {
      setPrompt(schedule.payload?.prompt ?? '');
      const rec = schedule.recurrence;
      if (rec?.frequency === 'Weekly' || rec?.frequency === 'Once' || rec?.frequency === 'Daily') {
        setFrequency(rec.frequency);
      }
      if (rec?.exactTime && rec.exactTime.includes(':')) {
        const [h, m] = rec.exactTime.split(':');
        setHour(h?.padStart(2, '0') ?? '09');
        setMinute(m?.padStart(2, '0') ?? '00');
      } else if (schedule.nextRunAt) {
        try {
          const d = new Date(schedule.nextRunAt);
          if (!isNaN(d.getTime())) {
            const jakarta = new Date(d.getTime() + 7 * 60 * 60 * 1000);
            setHour(String(jakarta.getUTCHours()).padStart(2, '0'));
            setMinute(String(jakarta.getUTCMinutes()).padStart(2, '0'));
          }
        } catch {
          // fallback
        }
      }
      if (rec?.frequency === 'Weekly' && Array.isArray(rec.days) && rec.days.length > 0) {
        setSelectedDays(rec.days as DayOfWeek[]);
      }
      if (rec?.frequency === 'Once' && rec.date) {
        setDateString(rec.date);
      }
      const targets = schedule.payload?.deliveryTargets;
      if (targets?.includes('MOBILE') && targets?.includes('DEVICE')) {
        setTargetMode('BOTH');
      } else if (targets?.includes('DEVICE')) {
        setTargetMode('DEVICE');
      } else {
        setTargetMode('MOBILE');
      }
      setSelectedDeviceId(schedule.targetDeviceId ?? null);
    } else if (mode === 'create') {
      setPrompt(initialPrompt ?? '');
      setFrequency('Daily');
      setMinute('00');
      setSelectedDays(['Monday']);
      setTargetMode(activeId ? 'BOTH' : 'MOBILE');
      setSelectedDeviceId(activeId);
    }
  }, [schedule, mode, isVisible, activeId]);

  const isValidTime = useMemo(() => {
    const h = parseInt(hour, 10);
    const m = parseInt(minute, 10);
    return !isNaN(h) && h >= 0 && h <= 23 && !isNaN(m) && m >= 0 && m <= 59;
  }, [hour, minute]);

  const isDeviceTargeted = targetMode === 'BOTH' || targetMode === 'DEVICE';
  const selectedDevice = availableDevices.find((d) => d.id === selectedDeviceId);
  const isDeviceValid = !isDeviceTargeted || (Boolean(selectedDeviceId) && Boolean(selectedDevice));

  const isFormValid = useMemo(() => {
    if (!prompt.trim()) return false;
    if (!isValidTime) return false;
    if (frequency === 'Weekly' && selectedDays.length === 0) return false;
    if (frequency === 'Once' && !/^\d{4}-\d{2}-\d{2}$/u.test(dateString)) return false;
    if (isDeviceTargeted && !isDeviceValid) return false;
    return true;
  }, [prompt, isValidTime, frequency, selectedDays, dateString, isDeviceTargeted, isDeviceValid]);

  const handleToggleDay = (day: DayOfWeek) => {
    setSelectedDays((prev) => {
      if (prev.includes(day)) {
        if (prev.length <= 1) return prev;
        return prev.filter((d) => d !== day);
      }
      return [...prev, day];
    });
  };

  const handlePresetSelect = (preset: TimePreset) => {
    setHour(preset.hour);
    setMinute(preset.minute);
  };

  const handleSubmit = async () => {
    if (!isFormValid || isSubmitting) return;
    setIsSubmitting(true);

    const cleanHour = hour.padStart(2, '0');
    const cleanMinute = minute.padStart(2, '0');
    const exactTime = `${cleanHour}:${cleanMinute}`;
    const timeOfDay = deriveTimeOfDay(parseInt(cleanHour, 10));

    try {
      const deliveryTargets: Array<'MOBILE' | 'DEVICE'> =
        targetMode === 'BOTH'
          ? ['MOBILE', 'DEVICE']
          : targetMode === 'DEVICE'
            ? ['DEVICE']
            : ['MOBILE'];
      const deviceId = isDeviceTargeted ? (selectedDeviceId ?? null) : null;

      await onSubmit({
        prompt: prompt.trim(),
        frequency,
        exactTime,
        timeOfDay,
        deliveryTargets,
        deviceId,
        ...(frequency === 'Once' ? { date: dateString } : {}),
        ...(frequency === 'Weekly'
          ? {
              days: selectedDays as ScheduleWeekday[],
              repeatDay: selectedDays[0] as ScheduleWeekday,
            }
          : {}),
      });
      onClose();
    } catch (error) {
      Alert.alert(
        mode === 'create' ? 'Unable to create schedule' : 'Unable to save schedule',
        mapScheduleApiError(error),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEdit = mode === 'edit';

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
            {isEdit ? 'Edit Schedule' : 'New Schedule'}
          </Text>
          <Text style={[styles.subtitleText, { color: theme.textSecondary }]}>
            {isEdit
              ? 'Update your schedule time and reminder prompt.'
              : 'Set a reminder or routine for Joy.'}
          </Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Prompt input field */}
          <View style={styles.fieldSection}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>REMINDER PROMPT</Text>
            <SchedulePromptField
              value={prompt}
              onChangeText={setPrompt}
              placeholder="e.g. Minum air putih & istirahat sejenak"
              style={styles.fieldFullWidth}
              testID={`${testID}-prompt-field`}
            />
          </View>
          {/* Delivery Target Section */}
          <View style={styles.fieldSection}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>DELIVERY TARGET</Text>
            <View style={[styles.deliverySegment, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              {([
                { id: 'BOTH' as const, label: 'Mobile + BMO' },
                { id: 'DEVICE' as const, label: 'BMO Saja' },
                { id: 'MOBILE' as const, label: 'Mobile Saja' },
              ]).map((opt) => {
                const isSelected = targetMode === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    style={[
                      styles.deliverySegmentItem,
                      isSelected && [styles.deliverySegmentActive, { backgroundColor: theme.cardBackground }],
                    ]}
                    onPress={() => setTargetMode(opt.id)}
                    testID={`${testID}-target-${opt.id.toLowerCase()}`}
                  >
                    <Text style={[styles.deliverySegmentText, { color: isSelected ? theme.text : theme.textSecondary }]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {isDeviceTargeted ? (
              <View style={[styles.devicePickerCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                {availableDevices.length === 0 ? (
                  <Text style={[styles.deviceWarningText, { color: '#E53E3E' }]} testID={`${testID}-no-devices-warning`}>
                    Belum ada BMO terhubung. Hubungkan BMO untuk mengaktifkan pengingat di robot.
                  </Text>
                ) : !selectedDevice ? (
                  <Text style={[styles.deviceWarningText, { color: '#E53E3E' }]} testID={`${testID}-device-invalid-warning`}>
                    Perangkat BMO sebelumnya tidak ditemukan atau telah di-unpair. Pilih perangkat valid di bawah.
                  </Text>
                ) : (
                  <View style={styles.deviceInfoRow}>
                    <Text style={[styles.deviceInfoText, { color: theme.text }]}>
                      {selectedDevice.name}
                    </Text>
                    <Text
                      style={[
                        styles.deviceStatusBadge,
                        {
                          color: selectedDevice.online ? '#38A169' : theme.textMuted,
                          backgroundColor: theme.backgroundElement,
                        },
                      ]}
                    >
                      {selectedDevice.online ? 'Online' : 'Offline'}
                    </Text>
                  </View>
                )}

                {availableDevices.length > 1 ? (
                  <View style={styles.deviceSelectionList}>
                    {availableDevices.map((dev) => {
                      const isChosen = dev.id === selectedDeviceId;
                      return (
                        <Pressable
                          key={dev.id}
                          style={[
                            styles.deviceOptionChip,
                            {
                              borderColor: isChosen ? theme.text : theme.border,
                              backgroundColor: isChosen ? theme.text : theme.backgroundElement,
                            },
                          ]}
                          onPress={() => setSelectedDeviceId(dev.id)}
                          testID={`${testID}-device-option-${dev.id}`}
                        >
                          <Text style={[styles.deviceOptionText, { color: isChosen ? theme.background : theme.text }]}>
                            {dev.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}

                {selectedDevice && !selectedDevice.online ? (
                  <Text style={[styles.deviceOfflineNotice, { color: theme.textMuted }]}>
                    BMO sedang offline. Pengingat akan dikirim saat BMO online.
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>

          {/* Exact Time section */}
          <View style={styles.fieldSection}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>TIME (WIB)</Text>
            <View style={[styles.timePickerCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
              <View style={styles.timeInputsRow}>
                <View style={styles.timeInputBox}>
                  <Text style={[styles.timeSublabel, { color: theme.textMuted }]}>Hour</Text>
                  <TextInput
                    style={[styles.timeDigitInput, { color: theme.text, borderColor: theme.border }]}
                    value={hour}
                    onChangeText={(val) => setHour(val.replace(/\D/gu, '').slice(0, 2))}
                    placeholder="09"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="number-pad"
                    maxLength={2}
                    testID={`${testID}-hour-input`}
                  />
                </View>
                <Text style={[styles.timeSeparator, { color: theme.text }]}>:</Text>
                <View style={styles.timeInputBox}>
                  <Text style={[styles.timeSublabel, { color: theme.textMuted }]}>Minute</Text>
                  <TextInput
                    style={[styles.timeDigitInput, { color: theme.text, borderColor: theme.border }]}
                    value={minute}
                    onChangeText={(val) => setMinute(val.replace(/\D/gu, '').slice(0, 2))}
                    placeholder="00"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="number-pad"
                    maxLength={2}
                    testID={`${testID}-minute-input`}
                  />
                </View>
                <Text style={[styles.timeZoneBadge, { color: theme.textSecondary, backgroundColor: theme.backgroundElement }]}>
                  WIB
                </Text>
              </View>

              {/* Quick Presets */}
              <View style={styles.presetChipsRow}>
                {TIME_PRESETS.map((p) => {
                  const isSelected = hour === p.hour && minute === p.minute;
                  return (
                    <Pressable
                      key={p.label}
                      style={[
                        styles.presetChip,
                        { borderColor: theme.border, backgroundColor: isSelected ? theme.text : theme.backgroundElement },
                      ]}
                      onPress={() => handlePresetSelect(p)}
                    >
                      <Text style={[styles.presetChipText, { color: isSelected ? theme.background : theme.text }]}>
                        {p.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Frequency Segment */}
          <View style={styles.fieldSection}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>FREQUENCY</Text>
            <View style={[styles.frequencySegment, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              {(['Daily', 'Weekly', 'Once'] as const).map((freq) => {
                const isSelected = frequency === freq;
                return (
                  <Pressable
                    key={freq}
                    style={[
                      styles.frequencySegmentItem,
                      isSelected && [styles.frequencySegmentActive, { backgroundColor: theme.cardBackground }],
                    ]}
                    onPress={() => setFrequency(freq)}
                    testID={`${testID}-freq-${freq.toLowerCase()}`}
                  >
                    <Text style={[styles.frequencySegmentText, { color: isSelected ? theme.text : theme.textSecondary }]}>
                      {freq === 'Once' ? 'Sekali' : freq === 'Daily' ? 'Setiap Hari' : 'Mingguan'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Conditional: Days selection for Weekly */}
          {frequency === 'Weekly' ? (
            <View style={styles.fieldSection}>
              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>DAYS</Text>
              <ScheduleDaysSelectionField
                selectedDays={selectedDays}
                onToggleDay={handleToggleDay}
                style={styles.fieldFullWidth}
                testID={`${testID}-days-selection`}
              />
            </View>
          ) : null}

          {/* Conditional: Date picker for Once */}
          {frequency === 'Once' ? (
            <View style={styles.fieldSection}>
              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>DATE (YYYY-MM-DD)</Text>
              <View style={[styles.dateInputContainer, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                <TextInput
                  style={[styles.dateInput, { color: theme.text }]}
                  value={dateString}
                  onChangeText={setDateString}
                  placeholder="2026-09-14"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                  testID={`${testID}-date-input`}
                />
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.actionContainer}>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              { backgroundColor: theme.text },
              (pressed || isSubmitting || !isFormValid) && styles.buttonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting || !isFormValid}
            accessibilityRole="button"
            accessibilityLabel={isEdit ? 'Save Changes' : 'Create Schedule'}
            testID={`${testID}-submit-button`}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={theme.background} />
            ) : (
              <Text style={[styles.submitButtonText, { color: theme.background }]}>
                {isEdit ? 'Save Changes' : 'Create Schedule'}
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
    maxHeight: 620,
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
    gap: 16,
    alignItems: 'center',
    paddingVertical: 4,
  },
  fieldSection: {
    width: '100%',
    gap: 6,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  fieldFullWidth: {
    width: '100%',
  },
  timePickerCard: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  timeInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  timeInputBox: {
    alignItems: 'center',
    gap: 4,
  },
  timeSublabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  timeDigitInput: {
    width: 60,
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 14,
  },
  timeZoneBadge: {
    marginTop: 14,
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  presetChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  frequencySegment: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    gap: 4,
  },
  frequencySegmentItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  frequencySegmentActive: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  frequencySegmentText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dateInputContainer: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  dateInput: {
    fontSize: 15,
    fontWeight: '500',
  },
  actionContainer: {
    paddingTop: 8,
    gap: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  submitButton: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  deliverySegment: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    gap: 4,
  },
  deliverySegmentItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  deliverySegmentActive: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  deliverySegmentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  devicePickerCard: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  deviceInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deviceInfoText: {
    fontSize: 13,
    fontWeight: '600',
  },
  deviceStatusBadge: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  deviceWarningText: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  deviceSelectionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  deviceOptionChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  deviceOptionText: {
    fontSize: 11,
    fontWeight: '600',
  },
  deviceOfflineNotice: {
    fontSize: 11,
    fontWeight: '400',
    fontStyle: 'italic',
  },
});
