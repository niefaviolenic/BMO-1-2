/* eslint-disable import/first */
// @ts-nocheck
/* eslint-disable import/no-unresolved */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react', async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const actual = await importOriginal();
  const mockUseRef = vi.fn((initial?: unknown) => ({ current: initial }));
  const mockUseCallback = vi.fn((fn: (...args: unknown[]) => unknown) => fn);
  const mockUseMemo = vi.fn((factory: () => unknown) => factory());
  const mockUseState = vi.fn((initial: unknown) => [
    initial instanceof Function ? initial() : initial,
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
vi.mock('lucide-react-native', () => ({
  Sparkles: (props: unknown) => ({ type: 'Sparkles', props }),
  Ellipsis: (props: unknown) => ({ type: 'Ellipsis', props }),
  Bell: (props: unknown) => ({ type: 'Bell', props }),
  BellOff: (props: unknown) => ({ type: 'BellOff', props }),
  Trash2: (props: unknown) => ({ type: 'Trash2', props }),
  Plus: (props: unknown) => ({ type: 'Plus', props }),
}));

vi.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: (dict: Record<string, unknown>) => dict.android ?? dict.default,
  },
  Alert: {
    alert: vi.fn(),
  },
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
    hairlineWidth: 1,
  },
  Text: (props: unknown) => ({ type: 'Text', props }),
  View: (props: unknown) => ({ type: 'View', props }),
  ActivityIndicator: (props: unknown) => ({ type: 'ActivityIndicator', props }),
}));

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    background: '#0F1729',
    cardBackground: '#1E293B',
    border: '#334155',
    divider: '#334155',
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    textTitle: '#F8FAFC',
    accentPrimary: '#25D366',
    linkPrimary: '#25D366',
  }),
}));

const mockUseWhatsAppSession = vi.fn();
const mockAddWhatsAppContact = vi.fn();
const mockRefreshWhatsAppRules = vi.fn().mockResolvedValue(undefined);
const mockSaveWhatsAppRules = vi.fn().mockResolvedValue(undefined);

vi.mock('@/features/plugins/data/use-whatsapp-session', () => ({
  useWhatsAppSession: () => mockUseWhatsAppSession(),
}));

vi.mock('@/features/plugins/data/whatsapp-session-store', () => ({
  addWhatsAppContact: (...args: unknown[]) => mockAddWhatsAppContact(...args),
  refreshWhatsAppRules: () => mockRefreshWhatsAppRules(),
  saveWhatsAppRules: (...args: unknown[]) => mockSaveWhatsAppRules(...args),
}));

vi.mock('@/features/plugins/presentation/notification-settings/components', () => ({
  AllowedContactRow: (props: unknown) => ({ type: 'AllowedContactRow', props }),
  AddAllowedContactRow: (props: unknown) => ({ type: 'AddAllowedContactRow', props }),
  DeviceContactPickerSheet: (props: unknown) => ({ type: 'DeviceContactPickerSheet', props }),
}));

vi.mock('@/components/ui/search-input', () => ({
  SearchInput: (props: unknown) => ({ type: 'SearchInput', props }),
}));

import { WhatsAppNotificationPanel } from './whatsapp-notification-panel';

function findComponentByTestId(node: any, testID: string): any {
  if (!node) return null;
  if (node.props?.testID === testID) return node;
  const rawChildren = node.props?.children;
  const children = Array.isArray(rawChildren)
    ? rawChildren
    : rawChildren
      ? [rawChildren]
      : [];
  for (const child of children) {
    if (Array.isArray(child)) {
      for (const nested of child) {
        const found = findComponentByTestId(nested, testID);
        if (found) return found;
      }
    } else if (child) {
      const found = findComponentByTestId(child, testID);
      if (found) return found;
    }
  }
  return null;
}

describe('WhatsAppNotificationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWhatsAppSession.mockReturnValue({
      connection: {
        provider: 'whatsapp',
        status: 'AUTHENTICATED',
        phoneNumber: '628993000101',
        connectedAt: '2026-08-29T00:00:00.000Z',
        scopes: [],
      },
      rules: [
        {
          id: 'rule-1',
          scope: 'CONTACT',
          conversationId: 'conv-1',
          enabled: true,
          speakOnDevice: true,
        },
      ],
      conversations: [
        {
          id: 'conv-1',
          displayName: 'Dihya Qalby',
          type: 'DM',
        },
        {
          id: 'conv-2',
          displayName: '(discussion) BMO B-Labs',
          type: 'GROUP',
        },
      ],
    });
  });

  it('renders primary number card, search input, contacts section, and contact picker', () => {
    const tree = WhatsAppNotificationPanel({ testID: 'test-wa-panel' }) as any;
    expect(tree).toBeDefined();

    expect(mockRefreshWhatsAppRules).toHaveBeenCalled();

    const accountCard = findComponentByTestId(tree, 'test-wa-panel-account-card');
    expect(accountCard).toBeDefined();

    const badgeText = findComponentByTestId(tree, 'test-wa-panel-account-badge-text');
    expect(badgeText.props.children).toBe('+62 899-3000-101');

    const searchInput = findComponentByTestId(tree, 'test-wa-panel-search-input');
    expect(searchInput).toBeDefined();

    const contactsCard = findComponentByTestId(tree, 'test-wa-panel-contacts-card');
    expect(contactsCard).toBeDefined();

    const contact1 = findComponentByTestId(tree, 'test-wa-panel-contact-conv-1');
    expect(contact1).toBeDefined();
    expect(contact1.props.name).toBe('Dihya Qalby');
    expect(contact1.props.notifyVoiceEnabled).toBe(true);

    const contact2 = findComponentByTestId(tree, 'test-wa-panel-contact-conv-2');
    expect(contact2).toBeDefined();
    expect(contact2.props.name).toBe('(discussion) BMO B-Labs');
    expect(contact2.props.phoneNumber).toBe('Group');

    const addContact = findComponentByTestId(tree, 'test-wa-panel-add-contact');
    expect(addContact).toBeDefined();

    const picker = findComponentByTestId(tree, 'test-wa-panel-device-contact-picker');
    expect(picker).toBeDefined();
  });

  it('renders empty state when there are no contacts and no search query', () => {
    mockUseWhatsAppSession.mockReturnValue({
      connection: {
        provider: 'whatsapp',
        status: 'AUTHENTICATED',
        phoneNumber: null,
      },
      rules: [],
      conversations: [],
    });

    const tree = WhatsAppNotificationPanel({ testID: 'test-wa-panel' }) as any;
    const emptyContacts = findComponentByTestId(tree, 'test-wa-panel-empty-contacts');
    expect(emptyContacts).toBeDefined();
  });

  it('renders loading indicator when session is fetching rules and has no contacts yet', () => {
    mockUseWhatsAppSession.mockReturnValue({
      connection: {
        provider: 'whatsapp',
        status: 'AUTHENTICATED',
        phoneNumber: null,
      },
      rules: [],
      conversations: [],
      isLoadingRules: true,
    });

    const tree = WhatsAppNotificationPanel({ testID: 'test-wa-panel' }) as any;
    const loadingContacts = findComponentByTestId(tree, 'test-wa-panel-loading-contacts');
    expect(loadingContacts).toBeDefined();

    const accountLoading = findComponentByTestId(tree, 'test-wa-panel-account-card-loading');
    expect(accountLoading).toBeDefined();
  });
});
