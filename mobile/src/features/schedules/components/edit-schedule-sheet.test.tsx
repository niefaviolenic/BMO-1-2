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
import { EditScheduleSheet } from './edit-schedule-sheet';

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
  View: (props: MockComponentProps) => ({ type: 'View', props }),
}));
vi.mock('@/lib/api', () => ({
  isApiError: vi.fn().mockReturnValue(false),
}));


vi.mock('@/components/ui/modal-bottom-sheet', () => ({
  ModalBottomSheet: (props: MockComponentProps) => ({ type: 'ModalBottomSheet', props }),
}));

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    text: '#000000',
    textSecondary: '#666666',
    background: '#FFFFFF',
    border: '#E0E0E0',
  }),
}));

vi.mock('./schedule-prompt-field', () => ({
  SchedulePromptField: (props: MockComponentProps) => ({ type: 'SchedulePromptField', props }),
}));

vi.mock('./schedule-time-field', () => ({
  ScheduleTimeField: (props: MockComponentProps) => ({ type: 'ScheduleTimeField', props }),
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

const mockSchedule: Schedule = {
  id: 'sch-123',
  status: 'ACTIVE',
  statusLabel: 'MONITORING',
  version: 2,
  payload: {
    prompt: 'Drink 2 glasses of water',
    deliveryTargets: ['MOBILE'],
  },
  recurrence: {
    frequency: 'Daily',
    every: 1,
    timeOfDay: 'Morning',
  },
  nextRunAt: '2026-09-14T02:00:00.000Z',
  timezone: 'Asia/Jakarta',
};

describe('EditScheduleSheet Component', () => {
  it('renders modal bottom sheet when isVisible is true', () => {
    const element = EditScheduleSheet({
      isVisible: true,
      onClose: vi.fn(),
      schedule: mockSchedule,
      onSave: vi.fn(),
      testID: 'edit-sheet',
    });

    expect(element.props.isVisible).toBe(true);

    const title = findElement(element, (el) => el.props?.testID === 'edit-sheet-title');
    expect(title).toBeDefined();

    const promptField = findElement(element, (el) => el.props?.testID === 'edit-sheet-prompt-field');
    expect(promptField).toBeDefined();
    expect(promptField?.props?.value).toBe('Drink 2 glasses of water');

    const timeField = findElement(element, (el) => el.props?.testID === 'edit-sheet-time-field');
    expect(timeField).toBeDefined();
    expect(timeField?.props?.timeValue).toBe('Morning');

    const saveButton = findElement(element, (el) => el.props?.testID === 'edit-sheet-save-button');
    expect(saveButton).toBeDefined();
    expect(saveButton?.props?.disabled).toBe(false);
  });

  it('calls onSave and onClose when Save Changes button is pressed', async () => {
    const onSaveMock = vi.fn().mockResolvedValue(undefined);
    const onCloseMock = vi.fn();

    const element = EditScheduleSheet({
      isVisible: true,
      onClose: onCloseMock,
      schedule: mockSchedule,
      onSave: onSaveMock,
      testID: 'edit-sheet',
    });

    const saveButton = findElement(element, (el) => el.props?.testID === 'edit-sheet-save-button');
    expect(saveButton).toBeDefined();

    await saveButton?.props?.onPress();
    expect(onSaveMock).toHaveBeenCalledWith('sch-123', {
      prompt: 'Drink 2 glasses of water',
      timeOfDay: 'Morning',
    });
    expect(onCloseMock).toHaveBeenCalled();
  });
});
