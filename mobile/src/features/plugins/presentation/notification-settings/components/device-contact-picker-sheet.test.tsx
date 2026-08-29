/* eslint-disable import/first */
// @ts-nocheck
/* eslint-disable import/no-unresolved */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react', async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const actual = await importOriginal();
  const mockUseRef = vi.fn((initial?: unknown) => ({ current: initial }));
  const mockUseCallback = vi.fn((fn: (...args: unknown[]) => unknown) => fn);
  const mockUseMemo = vi.fn((factory: () => unknown) => factory());
  const mockUseState = vi.fn((initial: unknown) => [
    typeof initial === 'function' ? (initial as () => unknown)() : initial,
    vi.fn(),
  ]);
  const mockUseEffect = vi.fn((effect: () => void | (() => void)) => {
    effect();
  });
  return {
    ...actual,
    default: {
      ...actual,
      useRef: mockUseRef,
      useCallback: mockUseCallback,
      useMemo: mockUseMemo,
      useState: mockUseState,
      useEffect: mockUseEffect,
    },
    useRef: mockUseRef,
    useCallback: mockUseCallback,
    useMemo: mockUseMemo,
    useState: mockUseState,
    useEffect: mockUseEffect,
  };
});
type MockComponentProps = Record<string, unknown> & {
  children?: React.ReactNode;
  testID?: string;
  onPress?: () => void;
};

type MockTreeNode = {
  type: string | React.ComponentType<unknown>;
  props: MockComponentProps;
  children?: MockTreeNode[];
};

const currentTheme = {
  text: '#ffffff',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textTitle: '#F8FAFC',
  background: '#000000',
  backgroundSecondary: '#121316',
  backgroundElement: '#1E2025',
  cardBackground: '#18191D',
  border: '#2A2D35',
  divider: '#22252C',
  sheetBackground: '#121316',
  modalBackground: '#1A1B20',
  icon: '#F8FAFC',
  iconMuted: '#94A3B8',
  linkPrimary: '#0A84FF',
  accentPrimary: '#0A84FF',
  inputBackground: '#1E2026',
  inputBorder: '#2A2D35',
  inputText: '#FFFFFF',
  inputPlaceholder: '#64748B',
  buttonPrimaryBackground: '#FFFFFF',
  buttonPrimaryText: '#000000',
};

vi.mock('lucide-react-native', () => ({
  Search: (props: MockComponentProps) => ({ type: 'Search', props }),
  X: (props: MockComponentProps) => ({ type: 'X', props }),
  ChevronRight: (props: MockComponentProps) => ({ type: 'ChevronRight', props }),
  Users: (props: MockComponentProps) => ({ type: 'Users', props }),
  UserPlus: (props: MockComponentProps) => ({ type: 'UserPlus', props }),
  Plus: (props: MockComponentProps) => ({ type: 'Plus', props }),
}));

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => currentTheme,
}));

vi.mock('@/components/ui/liquid-glass-back-button', () => ({
  LiquidGlassBackButton: (props: MockComponentProps) => ({
    type: 'LiquidGlassBackButton',
    props,
  }),
}));

vi.mock('@/components/ui/liquid-glass-icon-button', () => ({
  LiquidGlassIconButton: (props: MockComponentProps) => ({
    type: 'LiquidGlassIconButton',
    props,
    children: props.children,
  }),
}));

vi.mock('@/components/ui/modal-bottom-sheet', () => ({
  ModalBottomSheet: (props: MockComponentProps) => ({
    type: 'ModalBottomSheet',
    props,
    children: [props.header, props.children].filter(Boolean),
  }),
}));

const mockLoadContacts = vi.fn().mockResolvedValue(undefined);
const mockRequestPermission = vi.fn().mockResolvedValue(true);
const mockOpenSettings = vi.fn().mockResolvedValue(undefined);
const mockUseDeviceContacts = {
  contacts: [
    {
      id: 'c1',
      name: 'Budi Santoso',
      phoneNumber: '081234567890',
      normalizedPhoneNumber: '+6281234567890',
      phoneNumbers: [{ number: '081234567890', normalizedNumber: '+6281234567890' }],
      avatarColor: '#F59E0B',
    },
    {
      id: 'c2',
      name: 'Cenna Wijaya',
      phoneNumber: '085712345678',
      normalizedPhoneNumber: '+6285712345678',
      phoneNumbers: [{ number: '085712345678', normalizedNumber: '+6285712345678' }],
      avatarColor: '#EF4444',
    },
  ],
  status: 'granted',
  isLoading: false,
  loadContacts: mockLoadContacts,
  requestPermission: mockRequestPermission,
  openSettings: mockOpenSettings,
};

vi.mock('@/features/plugins/data/use-device-contacts', () => ({
  useDeviceContacts: () => mockUseDeviceContacts,
}));

vi.mock('react-native', () => {
  const mockComponent = (name: string) => (props: MockComponentProps) => {
    let resolvedChildren = props.children;
    if (typeof props.children === 'function') {
      resolvedChildren = props.children({ pressed: false });
    }
    return {
      type: name,
      props,
      children: Array.isArray(resolvedChildren)
        ? resolvedChildren
        : resolvedChildren
          ? [resolvedChildren]
          : [],
    };
  };

  return {
    View: mockComponent('View'),
    Text: mockComponent('Text'),
    TextInput: mockComponent('TextInput'),
    Pressable: mockComponent('Pressable'),
    FlatList: (props: MockComponentProps) => {
      const renderedItems = (props.data || []).map((item, index) =>
        props.renderItem ? props.renderItem({ item, index }) : null,
      );
      return {
        type: 'FlatList',
        props,
        children: renderedItems,
      };
    },
    ActivityIndicator: mockComponent('ActivityIndicator'),
    KeyboardAvoidingView: mockComponent('KeyboardAvoidingView'),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
      hairlineWidth: 1,
    },
    Platform: {
      OS: 'android',
      select: (dict: Record<string, unknown>) => dict.android ?? dict.default,
    },
  };
});

import { DeviceContactPickerSheet } from './device-contact-picker-sheet';
import { DeviceContactItemRow } from './device-contact-item-row';
import { ContactPickerSearchBar } from './contact-picker-search-bar';
import { ContactPickerPermissionView } from './contact-picker-permission-view';

function findByTestId(node: unknown, testId: string): MockTreeNode | null {
  if (!node || typeof node !== 'object') {
    return null;
  }

  const candidate = node as MockTreeNode;
  if (candidate.props && candidate.props.testID === testId) {
    return candidate;
  }

  const children: unknown[] = [];
  if (Array.isArray(candidate.children)) {
    children.push(...candidate.children);
  }
  if (typeof candidate.type === 'function') {
    try {
      const rendered = (candidate.type as (props: unknown) => unknown)(candidate.props);
      const match = findByTestId(rendered, testId);
      if (match) {
        return match;
      }
    } catch {
      // ignore functional render errors
    }
  }

  for (const child of children) {
    const match = findByTestId(child, testId);
    if (match) {
      return match;
    }
  }

  return null;
}

describe('Contact Picker Dark Mode / Theme Adaptations', () => {
  it('renders ContactPickerSearchBar with dynamic theme cardBackground and textTitle', () => {
    const tree = ContactPickerSearchBar({
      value: 'test query',
      onChangeText: vi.fn(),
      onClear: vi.fn(),
      testID: 'search-bar',
    });

    const root = findByTestId(tree, 'search-bar');
    expect(root).toBeTruthy();
    expect(root.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: currentTheme.cardBackground,
          borderColor: currentTheme.border,
        }),
      ]),
    );

    const input = findByTestId(tree, 'search-bar-input');
    expect(input.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          color: currentTheme.textTitle,
        }),
      ]),
    );
  });

  it('renders DeviceContactItemRow with dynamic theme colors', () => {
    const contact = {
      id: 'c1',
      name: 'Budi Santoso',
      phoneNumber: '081234567890',
      avatarColor: '#F59E0B',
    };

    const tree = DeviceContactItemRow({
      contact,
      onPress: vi.fn(),
      testID: 'contact-row',
    });

    const root = findByTestId(tree, 'contact-row');
    expect(root).toBeTruthy();

    const nameText = findByTestId(tree, 'contact-row-name');
    expect(nameText.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          color: currentTheme.textTitle,
        }),
      ]),
    );

    const phoneText = findByTestId(tree, 'contact-row-phone');
    expect(phoneText.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          color: currentTheme.textSecondary,
        }),
      ]),
    );
  });

  it('renders ContactPickerPermissionView with dynamic theme colors', () => {
    const tree = ContactPickerPermissionView({
      isDenied: true,
      onRequestPermission: vi.fn(),
      onOpenSettings: vi.fn(),
      onManualInputPress: vi.fn(),
      testID: 'permission-view',
    });

    const title = findByTestId(tree, 'permission-view');
    expect(title).toBeTruthy();
  });

  it('renders DeviceContactPickerSheet with contacts using dark theme background and text', () => {
    const tree = DeviceContactPickerSheet({
      isVisible: true,
      onClose: vi.fn(),
      onSelectContact: vi.fn(),
      testID: 'contact-picker',
    });

    const headerTitle = findByTestId(tree, 'contact-picker-title');
    expect(headerTitle).toBeTruthy();
    expect(headerTitle.props.children).toBe('Select Contact');
    expect(headerTitle.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          color: currentTheme.textTitle,
        }),
      ]),
    );
    const firstContact = findByTestId(tree, 'contact-picker-contact-c1');
    expect(firstContact).toBeTruthy();
  });

  it('renders manual form ("Add Number") with dark mode colors', () => {
    const useStateMock = vi.fn()
      .mockImplementationOnce(() => ['', vi.fn()]) // searchQuery
      .mockImplementationOnce(() => [true, vi.fn()]) // showManualInput = true
      .mockImplementationOnce(() => ['Mama', vi.fn()]) // manualName
      .mockImplementationOnce(() => ['08123456789', vi.fn()]); // manualPhone

    vi.spyOn(React, 'useState').mockImplementation(useStateMock);

    const tree = DeviceContactPickerSheet({
      isVisible: true,
      onClose: vi.fn(),
      onSelectContact: vi.fn(),
      testID: 'contact-picker',
    });

    const headerTitle = findByTestId(tree, 'contact-picker-title');
    expect(headerTitle.props.children).toBe('Add Number');

    const phoneInput = findByTestId(tree, 'contact-picker-manual-phone-input');
    expect(phoneInput).toBeTruthy();
    expect(phoneInput.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: currentTheme.inputBackground,
          borderColor: currentTheme.inputBorder,
          color: currentTheme.inputText,
        }),
      ]),
    );

    const submitButton = findByTestId(tree, 'contact-picker-manual-submit-button');
    expect(submitButton).toBeTruthy();
    const submitButtonStyle = typeof submitButton.props.style === 'function'
      ? submitButton.props.style({ pressed: false })
      : submitButton.props.style;
    expect(submitButtonStyle).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: currentTheme.buttonPrimaryBackground,
        }),
      ]),
    );
  });
});
