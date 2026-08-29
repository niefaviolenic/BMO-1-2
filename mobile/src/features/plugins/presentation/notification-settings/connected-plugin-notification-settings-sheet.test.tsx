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

vi.mock('react-native', () => ({
  Alert: {
    alert: vi.fn(),
  },
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

vi.mock('@/features/plugins/components/plugin-notification-settings-sheet', () => ({
  PluginNotificationSettingsSheet: (props: Record<string, unknown>) => ({
    type: 'PluginNotificationSettingsSheet',
    props,
  }),
}));

vi.mock('@/features/plugins/presentation/notification-settings/components', () => ({
  DeviceContactPickerSheet: (props: Record<string, unknown>) => ({
    type: 'DeviceContactPickerSheet',
    props,
  }),
}));

import { ConnectedPluginNotificationSettingsSheet } from './connected-plugin-notification-settings-sheet';

describe('ConnectedPluginNotificationSettingsSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps conversations without existing rules to notifyVoiceEnabled: false by default', () => {
    mockUseWhatsAppSession.mockReturnValue({
      conversations: [
        {
          id: '120363137718038483@g.us',
          displayName: 'Joy Team Group',
          type: 'GROUP',
        },
        {
          id: '628123456789@s.whatsapp.net',
          displayName: 'Budi',
          type: 'DM',
        },
      ],
      rules: [],
    });

    const tree = ConnectedPluginNotificationSettingsSheet({
      isVisible: true,
      onClose: vi.fn(),
    });

    const initialContacts = tree.props.initialContacts;
    expect(initialContacts).toHaveLength(2);
    expect(initialContacts[0].notifyVoiceEnabled).toBe(false);
    expect(initialContacts[1].notifyVoiceEnabled).toBe(false);
  });

  it('maps conversations with existing enabled rules correctly', () => {
    mockUseWhatsAppSession.mockReturnValue({
      conversations: [
        {
          id: '120363137718038483@g.us',
          displayName: 'Joy Team Group',
          type: 'GROUP',
        },
        {
          id: '628123456789@s.whatsapp.net',
          displayName: 'Budi',
          type: 'DM',
        },
      ],
      rules: [
        {
          id: 'r1',
          scope: 'GROUP',
          conversationId: '120363137718038483@g.us',
          enabled: true,
          speakOnDevice: true,
        },
      ],
    });

    const tree = ConnectedPluginNotificationSettingsSheet({
      isVisible: true,
      onClose: vi.fn(),
    });

    const initialContacts = tree.props.initialContacts;
    expect(initialContacts).toHaveLength(2);
    expect(initialContacts[0].notifyVoiceEnabled).toBe(true);
    expect(initialContacts[1].notifyVoiceEnabled).toBe(false);
  });

  it('adds manual device contact with notifyVoiceEnabled: false', async () => {
    mockUseWhatsAppSession.mockReturnValue({
      conversations: [],
      rules: [],
    });

    mockAddWhatsAppContact.mockResolvedValue({
      id: '628999999999@s.whatsapp.net',
      displayName: 'Alice',
      type: 'DM',
    });

    const tree = ConnectedPluginNotificationSettingsSheet({
      isVisible: true,
      onClose: vi.fn(),
    });

    const pickerOverlay = tree.props.overlay;
    await pickerOverlay.props.onSelectContact({
      id: 'dc1',
      name: 'Alice',
      phoneNumber: '+62 899-999-999',
    });

    expect(mockAddWhatsAppContact).toHaveBeenCalledWith('+62 899-999-999', 'Alice');
    expect(mockSaveWhatsAppRules).toHaveBeenCalledWith([
      {
        scope: 'CONTACT',
        conversationId: '628999999999@s.whatsapp.net',
        enabled: true,
        speakOnDevice: false,
      },
    ]);
  });

  it('adds manual phone number with notifyVoiceEnabled: false', async () => {
    mockUseWhatsAppSession.mockReturnValue({
      conversations: [],
      rules: [],
    });

    mockAddWhatsAppContact.mockResolvedValue({
      id: '628111222333@s.whatsapp.net',
      displayName: 'Bob',
      type: 'DM',
    });

    const tree = ConnectedPluginNotificationSettingsSheet({
      isVisible: true,
      onClose: vi.fn(),
    });

    const pickerOverlay = tree.props.overlay;
    await pickerOverlay.props.onAddManualNumber('+62 811-1222-333', 'Bob');

    expect(mockAddWhatsAppContact).toHaveBeenCalledWith('+62 811-1222-333', 'Bob');
    expect(mockSaveWhatsAppRules).toHaveBeenCalledWith([
      {
        scope: 'CONTACT',
        conversationId: '628111222333@s.whatsapp.net',
        enabled: true,
        speakOnDevice: false,
      },
    ]);
  });

  it('persists speakOnDevice: true when contact notification is explicitly toggled on', async () => {
    mockUseWhatsAppSession.mockReturnValue({
      conversations: [
        {
          id: '628123456789@s.whatsapp.net',
          displayName: 'Budi',
          type: 'DM',
        },
      ],
      rules: [],
    });

    const tree = ConnectedPluginNotificationSettingsSheet({
      isVisible: true,
      onClose: vi.fn(),
    });

    await tree.props.onToggleContactNotification('628123456789@s.whatsapp.net', true);

    expect(mockSaveWhatsAppRules).toHaveBeenCalledWith([
      {
        scope: 'CONTACT',
        conversationId: '628123456789@s.whatsapp.net',
        enabled: true,
        speakOnDevice: true,
      },
    ]);
  });

  it('persists speakOnDevice: false when contact notification is explicitly toggled off', async () => {
    mockUseWhatsAppSession.mockReturnValue({
      conversations: [
        {
          id: '628123456789@s.whatsapp.net',
          displayName: 'Budi',
          type: 'DM',
        },
      ],
      rules: [
        {
          id: 'r1',
          scope: 'CONTACT',
          conversationId: '628123456789@s.whatsapp.net',
          enabled: true,
          speakOnDevice: true,
        },
      ],
    });

    const tree = ConnectedPluginNotificationSettingsSheet({
      isVisible: true,
      onClose: vi.fn(),
    });

    await tree.props.onToggleContactNotification('628123456789@s.whatsapp.net', false);

    expect(mockSaveWhatsAppRules).toHaveBeenCalledWith([
      {
        scope: 'CONTACT',
        conversationId: '628123456789@s.whatsapp.net',
        enabled: true,
        speakOnDevice: false,
      },
    ]);
  });

  it('resolves and formats dynamic phone number from session connection', () => {
    mockUseWhatsAppSession.mockReturnValue({
      conversations: [],
      rules: [],
      connection: {
        provider: 'whatsapp',
        status: 'CONNECTED',
        phoneNumber: '+628993000101',
      },
    });

    const tree = ConnectedPluginNotificationSettingsSheet({
      isVisible: true,
      onClose: vi.fn(),
    });

    expect(tree.props.connectedPhoneNumber).toBe('+62 899-3000-101');
  });

  it('uses explicit connectedPhoneNumber prop when provided', () => {
    mockUseWhatsAppSession.mockReturnValue({
      conversations: [],
      rules: [],
      connection: {
        provider: 'whatsapp',
        status: 'CONNECTED',
        phoneNumber: '+628993000101',
      },
    });

    const tree = ConnectedPluginNotificationSettingsSheet({
      isVisible: true,
      onClose: vi.fn(),
      connectedPhoneNumber: '+62 811-2233-4455',
    });

    expect(tree.props.connectedPhoneNumber).toBe('+62 811-2233-4455');
  });

  it('passes null connectedPhoneNumber when session has no phone number', () => {
    mockUseWhatsAppSession.mockReturnValue({
      conversations: [],
      rules: [],
      connection: null,
    });

    const tree = ConnectedPluginNotificationSettingsSheet({
      isVisible: true,
      onClose: vi.fn(),
    });

    expect(tree.props.connectedPhoneNumber).toBeNull();
  });
});
