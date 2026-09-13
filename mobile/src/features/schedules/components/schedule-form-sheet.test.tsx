/* eslint-disable import/no-unresolved */
// @ts-ignore
import React from 'react';
// @ts-ignore
import { describe, expect, it, vi } from 'vitest';

vi.mock('react', async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: actual,
    useRef: vi.fn((initial?: unknown) => ({ current: initial })),
    useCallback: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
    useMemo: vi.fn((factory: () => unknown) => factory()),
    useState: vi.fn((initial: unknown) => [
      typeof initial === 'function' ? (initial as () => unknown)() : initial,
      vi.fn(),
    ]),
    useEffect: vi.fn((effect: () => void | (() => void)) => {
      effect();
    }),
  };
});

import type { Schedule } from '../domain/schedule';
import { ScheduleFormSheet } from './schedule-form-sheet';

type MockComponentProps = {
  children?: React.ReactNode;
  testID?: string;
  [key: string]: unknown;
};

vi.mock('react-native', () => ({
  ActivityIndicator: (props: MockComponentProps) => ({ type: 'ActivityIndicator', props }),
  Alert: { alert: vi.fn() },
  KeyboardAvoidingView: (props: MockComponentProps) => ({ type: 'KeyboardAvoidingView', props }),
  Platform: { OS: 'ios' },
  Pressable: (props: MockComponentProps) => ({ type: 'Pressable', props }),
  ScrollView: (props: MockComponentProps) => ({ type: 'ScrollView', props }),
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T) => styles,
    hairlineWidth: 1,
  },
  Text: (props: MockComponentProps) => ({ type: 'Text', props }),
  TextInput: (props: MockComponentProps) => ({ type: 'TextInput', props }),
  View: (props: MockComponentProps) => ({ type: 'View', props }),
}));

vi.mock('@/components/ui/modal-bottom-sheet', () => ({
  ModalBottomSheet: (props: MockComponentProps) => ({ type: 'ModalBottomSheet', props }),
}));

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    text: '#000000',
    textSecondary: '#666666',
    textMuted: '#999999',
    background: '#FFFFFF',
    backgroundElement: '#F0F0F0',
    cardBackground: '#FAFAFA',
    border: '#E0E0E0',
  }),
}));

vi.mock('./schedule-prompt-field', () => ({
  SchedulePromptField: (props: MockComponentProps) => ({ type: 'SchedulePromptField', props }),
}));

vi.mock('./schedule-days-selection-field', () => ({
  ScheduleDaysSelectionField: (props: MockComponentProps) => ({ type: 'ScheduleDaysSelectionField', props }),
}));

vi.mock('@/lib/api', () => ({
  isApiError: vi.fn().mockReturnValue(false),
}));

function findElement(
  node: unknown,
  predicate: (el: { type?: unknown; props?: Record<string, unknown> }) => boolean,
): { type?: unknown; props?: Record<string, unknown> } | null {
  if (!node || typeof node !== 'object') return null;
  const el = node as { type?: unknown; props?: Record<string, unknown> & { children?: unknown } };
  if (predicate(el)) return el;
  const children = Array.isArray(el.props?.children)
    ? el.props.children
    : el.props?.children
      ? [el.props.children]
      : [];
  for (const child of children) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
  return null;
}

const mockExistingSchedule: Schedule = {
  id: 'sch-existing',
  status: 'ACTIVE',
  statusLabel: 'MONITORING',
  version: 1,
  payload: {
    prompt: 'Workout at the gym',
    deliveryTargets: ['MOBILE'],
  },
  recurrence: {
    frequency: 'Daily',
    every: 1,
    timeOfDay: 'Morning',
    exactTime: '07:30',
  },
  nextRunAt: '2026-09-14T00:30:00.000Z',
  timezone: 'Asia/Jakarta',
};

describe('ScheduleFormSheet Component', () => {
  it('renders in create mode with New Schedule title and prompt input', () => {
    const element = ScheduleFormSheet({
      isVisible: true,
      mode: 'create',
      onClose: vi.fn(),
      onSubmit: vi.fn(),
      testID: 'form-sheet',
    });

    expect(element.props.isVisible).toBe(true);

    const title = findElement(element, (el) => el.props?.testID === 'form-sheet-title');
    expect(title?.props?.children).toBe('New Schedule');

    const submitBtn = findElement(element, (el) => el.props?.testID === 'form-sheet-submit-button');
    expect(submitBtn).toBeDefined();

    const hourInput = findElement(element, (el) => el.props?.testID === 'form-sheet-hour-input');
    expect(hourInput).toBeDefined();

    const minuteInput = findElement(element, (el) => el.props?.testID === 'form-sheet-minute-input');
    expect(minuteInput).toBeDefined();
  });

  it('renders in edit mode with Edit Schedule title and pre-filled values', () => {
    const element = ScheduleFormSheet({
      isVisible: true,
      mode: 'edit',
      schedule: mockExistingSchedule,
      onClose: vi.fn(),
      onSubmit: vi.fn(),
      testID: 'form-sheet',
    });

    const title = findElement(element, (el) => el.props?.testID === 'form-sheet-title');
    expect(title?.props?.children).toBe('Edit Schedule');

    const promptField = findElement(element, (el) => el.props?.testID === 'form-sheet-prompt-field');
    expect(promptField?.props?.value).toBe('Workout at the gym');

    const hourInput = findElement(element, (el) => el.props?.testID === 'form-sheet-hour-input');
    expect(hourInput?.props?.value).toBe('07');

    const minuteInput = findElement(element, (el) => el.props?.testID === 'form-sheet-minute-input');
    expect(minuteInput?.props?.value).toBe('30');
  });

  it('submits valid exact time when submit button is pressed', async () => {
    const onSubmitMock = vi.fn().mockResolvedValue(undefined);
    const onCloseMock = vi.fn();

    const element = ScheduleFormSheet({
      isVisible: true,
      mode: 'edit',
      schedule: mockExistingSchedule,
      onClose: onCloseMock,
      onSubmit: onSubmitMock,
      testID: 'form-sheet',
    });

    const submitBtn = findElement(element, (el) => el.props?.testID === 'form-sheet-submit-button');
    await submitBtn?.props?.onPress();

    expect(onSubmitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Workout at the gym',
        exactTime: '07:30',
        frequency: 'Daily',
      }),
    );
    expect(onCloseMock).toHaveBeenCalled();
  });
});
