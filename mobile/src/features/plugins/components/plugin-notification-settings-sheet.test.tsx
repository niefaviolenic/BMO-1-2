/* eslint-disable import/first */
// @ts-nocheck
/* eslint-disable import/no-unresolved */
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

vi.mock('expo-contacts/legacy', () => ({
  requestPermissionsAsync: vi.fn().mockResolvedValue({ status: 'granted' }),
  getPermissionsAsync: vi.fn().mockResolvedValue({ status: 'granted' }),
  getContactsAsync: vi.fn().mockResolvedValue({ data: [] }),
}));

vi.mock('expo-contacts', () => ({
  requestPermissionsAsync: vi.fn().mockResolvedValue({ status: 'granted' }),
  getPermissionsAsync: vi.fn().mockResolvedValue({ status: 'granted' }),
  getContactsAsync: vi.fn().mockResolvedValue({ data: [] }),
}));

vi.mock('lucide-react-native', () => ({
  Ellipsis: (props: MockComponentProps) => ({ type: 'Ellipsis', props }),
  Sparkles: (props: MockComponentProps) => ({ type: 'Sparkles', props }),
  Bell: (props: MockComponentProps) => ({ type: 'Bell', props }),
  BellOff: (props: MockComponentProps) => ({ type: 'BellOff', props }),
  Trash2: (props: MockComponentProps) => ({ type: 'Trash2', props }),
  Plus: (props: MockComponentProps) => ({ type: 'Plus', props }),
}));

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    cardBackground: '#FFFFFF',
    text: '#0F1729',
    textSecondary: '#80808C',
    textTitle: '#0F1729',
    icon: '#80808C',
    border: '#E3E8F0',
    divider: '#E5E5EB',
    linkPrimary: '#007AFF',
  }),
}));

vi.mock('@/components/ui/liquid-glass-back-button', () => ({
  LiquidGlassBackButton: (props: MockComponentProps) => ({ type: 'LiquidGlassBackButton', props }),
}));

vi.mock('@/components/ui/liquid-glass-icon-button', () => ({
  LiquidGlassIconButton: (props: MockComponentProps) => ({ type: 'LiquidGlassIconButton', props }),
}));

vi.mock('@/components/ui/modal-bottom-sheet', () => ({
  ModalBottomSheet: (props: MockComponentProps) => ({ type: 'ModalBottomSheet', props, children: props.children }),
}));

vi.mock('@/components/ui/search-input', () => ({
  SearchInput: (props: MockComponentProps) => ({ type: 'SearchInput', props }),
}));

vi.mock('react-native', () => {
  const mockComponent = (name: string) => {
    const Component = (props: MockComponentProps) => ({ type: name, props, children: props.children });
    Component.displayName = name;
    return Component;
  };

  return {
    Platform: {
      OS: 'android',
      select: (dict: Record<string, unknown>) => dict.android ?? dict.default,
    },
    View: mockComponent('View'),
    Text: mockComponent('Text'),
    Pressable: mockComponent('Pressable'),
    StyleSheet: {
      create: <T extends Record<string, unknown>>(styles: T) => styles,
    },
  };
});

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
    children.push(...candidate.children.flat(Infinity));
  } else if (candidate.children) {
    children.push(candidate.children);
  }
  if (candidate.props) {
    if (Array.isArray(candidate.props.children)) {
      children.push(...candidate.props.children.flat(Infinity));
    } else if (candidate.props.children) {
      children.push(candidate.props.children);
    }
  }

  for (const child of children) {
    const found = findByTestId(child, testId);
    if (found) {
      return found;
    }
  }

  return null;
}

import { PluginNotificationSettingsSheet } from './plugin-notification-settings-sheet';

describe('PluginNotificationSettingsSheet', () => {
  it('renders contacts list and AI context caption', () => {
    const contacts = [
      {
        id: 'c1',
        name: 'Cenna Wijaya',
        phoneNumber: '+62 812-3456-7890',
        notifyVoiceEnabled: true,
      },
    ];

    const tree = PluginNotificationSettingsSheet({
      isVisible: true,
      onClose: vi.fn(),
      initialContacts: contacts,
      testID: 'notification-sheet',
    });

    const contactRow = findByTestId(tree, 'notification-sheet-contact-c1');
    expect(contactRow).not.toBeNull();

    const infoCaption = findByTestId(tree, 'notification-sheet-info-caption');
    expect(infoCaption).not.toBeNull();
  });
  it('propagates accentColor to AllowedContactRow when explicitly provided', () => {
    const contacts = [
      {
        id: 'c1',
        name: 'Cenna Wijaya',
        phoneNumber: '+62 812-3456-7890',
        notifyVoiceEnabled: true,
      },
    ];

    const tree = PluginNotificationSettingsSheet({
      isVisible: true,
      onClose: vi.fn(),
      pluginTitle: 'WhatsApp',
      accentColor: '#A855F7',
      initialContacts: contacts,
      testID: 'notification-sheet',
    });

    const contactRow = findByTestId(tree, 'notification-sheet-contact-c1');
    expect(contactRow).not.toBeNull();
    expect(contactRow?.props?.accentColor).toBe('#A855F7');
  });

  it('falls back to theme accent when accentColor is omitted', () => {
    const contacts = [
      {
        id: 'c1',
        name: 'Cenna Wijaya',
        phoneNumber: '+62 812-3456-7890',
        notifyVoiceEnabled: true,
      },
    ];

    const tree = PluginNotificationSettingsSheet({
      isVisible: true,
      onClose: vi.fn(),
      pluginTitle: 'WhatsApp',
      initialContacts: contacts,
      testID: 'notification-sheet',
    });

    const contactRow = findByTestId(tree, 'notification-sheet-contact-c1');
    expect(contactRow).not.toBeNull();
    expect(contactRow?.props?.accentColor).toBe('#007AFF');
  });
  it('renders empty state when no contacts added', () => {
    const tree = PluginNotificationSettingsSheet({
      isVisible: true,
      onClose: vi.fn(),
      initialContacts: [],
      testID: 'notification-sheet',
    });

    const emptyContainer = findByTestId(tree, 'notification-sheet-empty-contacts');
    expect(emptyContainer).not.toBeNull();
  });

  it('does not render master enable switch section', () => {
    const tree = PluginNotificationSettingsSheet({
      isVisible: true,
      onClose: vi.fn(),
      initialContacts: [],
      testID: 'notification-sheet',
    });

    const enableSection = findByTestId(tree, 'notification-sheet-enable-section');
    expect(enableSection).toBeNull();
  });

  it('renders search input when contacts are present', () => {
    const contacts = [
      {
        id: 'c1',
        name: 'Cenna Wijaya',
        phoneNumber: '+62 812-3456-7890',
        notifyVoiceEnabled: true,
      },
    ];

    const tree = PluginNotificationSettingsSheet({
      isVisible: true,
      onClose: vi.fn(),
      initialContacts: contacts,
      testID: 'notification-sheet',
    });

    const searchInput = findByTestId(tree, 'notification-sheet-search-input');
    expect(searchInput).not.toBeNull();
    expect(searchInput?.props?.placeholder).toBe('Search contacts or groups...');
  });

  it('does not render search input when contacts list is empty and no search query', () => {
    const tree = PluginNotificationSettingsSheet({
      isVisible: true,
      onClose: vi.fn(),
      initialContacts: [],
      testID: 'notification-sheet',
    });

    const searchInput = findByTestId(tree, 'notification-sheet-search-input');
    expect(searchInput).toBeNull();
  });

  it('allows custom search placeholder', () => {
    const contacts = [
      {
        id: 'c1',
        name: 'Cenna Wijaya',
        phoneNumber: '+62 812-3456-7890',
      },
    ];

    const tree = PluginNotificationSettingsSheet({
      isVisible: true,
      onClose: vi.fn(),
      initialContacts: contacts,
      searchPlaceholder: 'Search WhatsApp contacts...',
      testID: 'notification-sheet',
    });

    const searchInput = findByTestId(tree, 'notification-sheet-search-input');
    expect(searchInput).not.toBeNull();
    expect(searchInput?.props?.placeholder).toBe('Search WhatsApp contacts...');
  });

  it('filters contacts list matching search query by name', async () => {
    const contacts = [
      { id: 'c1', name: 'Cenna Wijaya', phoneNumber: '+62 812-3456-7890' },
      { id: 'c2', name: 'SobatDANA', phoneNumber: '+62 899-1111-2222' },
    ];

    const React = await import('react');
    const originalUseState = React.useState;
    let callIndex = 0;
    React.useState = vi.fn((initial: unknown) => {
      callIndex++;
      if (callIndex === 1) return [contacts, vi.fn()];
      if (callIndex === 2) return ['Sobat', vi.fn()];
      return [initial, vi.fn()];
    });

    const tree = PluginNotificationSettingsSheet({
      isVisible: true,
      onClose: vi.fn(),
      initialContacts: contacts,
      testID: 'notification-sheet',
    });

    expect(findByTestId(tree, 'notification-sheet-contact-c2')).not.toBeNull();
    expect(findByTestId(tree, 'notification-sheet-contact-c1')).toBeNull();

    React.useState = originalUseState;
  });

  it('filters contacts list matching search query by phone number', async () => {
    const contacts = [
      { id: 'c1', name: 'Cenna Wijaya', phoneNumber: '+62 812-3456-7890' },
      { id: 'c2', name: 'SobatDANA', phoneNumber: '+62 899-1111-2222' },
    ];

    const React = await import('react');
    const originalUseState = React.useState;
    let callIndex = 0;
    React.useState = vi.fn((initial: unknown) => {
      callIndex++;
      if (callIndex === 1) return [contacts, vi.fn()];
      if (callIndex === 2) return ['899-1111', vi.fn()];
      return [initial, vi.fn()];
    });

    const tree = PluginNotificationSettingsSheet({
      isVisible: true,
      onClose: vi.fn(),
      initialContacts: contacts,
      testID: 'notification-sheet',
    });

    expect(findByTestId(tree, 'notification-sheet-contact-c2')).not.toBeNull();
    expect(findByTestId(tree, 'notification-sheet-contact-c1')).toBeNull();

    React.useState = originalUseState;
  });

  it('renders empty search state when no contacts match query', async () => {
    const contacts = [
      { id: 'c1', name: 'Cenna Wijaya', phoneNumber: '+62 812-3456-7890' },
    ];

    const React = await import('react');
    const originalUseState = React.useState;
    let callIndex = 0;
    React.useState = vi.fn((initial: unknown) => {
      callIndex++;
      if (callIndex === 1) return [contacts, vi.fn()];
      if (callIndex === 2) return ['Nonexistent', vi.fn()];
      return [initial, vi.fn()];
    });

    const tree = PluginNotificationSettingsSheet({
      isVisible: true,
      onClose: vi.fn(),
      initialContacts: contacts,
      testID: 'notification-sheet',
    });

    expect(findByTestId(tree, 'notification-sheet-contact-c1')).toBeNull();
    expect(findByTestId(tree, 'notification-sheet-empty-search')).not.toBeNull();

    React.useState = originalUseState;
  });

  it('renders primary account banner using theme accent color when accentColor is omitted', () => {
    const tree = PluginNotificationSettingsSheet({
      isVisible: true,
      onClose: vi.fn(),
      connectedPhoneNumber: '+62 851-8935-1510',
      testID: 'notification-sheet',
    });

    const accountSection = findByTestId(tree, 'notification-sheet-account-section');
    expect(accountSection).not.toBeNull();
    const accountCard = findByTestId(tree, 'notification-sheet-account-card');
    expect(accountCard).not.toBeNull();
    const accountBadge = findByTestId(tree, 'notification-sheet-account-badge');
    expect(accountBadge).not.toBeNull();
    const accountBadgeText = findByTestId(tree, 'notification-sheet-account-badge-text');
    expect(accountBadgeText).not.toBeNull();
    expect(accountBadgeText.props.style).toContainEqual({ color: '#007AFF' });
  });

  it('renders primary account banner with explicit accentColor', () => {
    const tree = PluginNotificationSettingsSheet({
      isVisible: true,
      onClose: vi.fn(),
      connectedPhoneNumber: '+62 851-8935-1510',
      accentColor: '#9333EA',
      testID: 'notification-sheet',
    });

    const accountBadgeText = findByTestId(tree, 'notification-sheet-account-badge-text');
    expect(accountBadgeText).not.toBeNull();
    expect(accountBadgeText.props.style).toContainEqual({ color: '#9333EA' });
  });
});
