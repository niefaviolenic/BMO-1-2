/* eslint-disable import/no-unresolved */
// @ts-ignore
import Module from 'module';
// @ts-ignore
import React from 'react';
// @ts-ignore
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { NotificationPluginsSheet } from './notification-plugins-sheet';

type NodeModuleWithRequire = {
  require: (id: string) => unknown;
};

beforeAll(() => {
  const moduleProto = Module.prototype as unknown as NodeModuleWithRequire;
  const originalRequire = moduleProto.require;
  moduleProto.require = function (this: unknown, id: string): unknown {
    if (typeof id === 'string' && (id.includes('.png') || id.includes('.svg'))) {
      return 'mocked-asset';
    }
    return originalRequire.call(this, id);
  };
});

type MockComponentProps = {
  children?: React.ReactNode;
  testID?: string;
  onPress?: () => void;
  [key: string]: unknown;
};

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: vi.fn((initial: unknown) => [
      typeof initial === 'function' ? (initial as () => unknown)() : initial,
      vi.fn(),
    ]),
    useEffect: vi.fn((effect: () => void | (() => void)) => {
      effect();
    }),
  };
});

vi.mock('react-native', () => ({
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T) => styles,
    hairlineWidth: 1,
  },
  Text: (props: MockComponentProps) => ({ type: 'Text', props }),
  View: (props: MockComponentProps) => ({ type: 'View', props }),
  Pressable: (props: MockComponentProps & { style?: unknown }) => ({
    type: 'Pressable',
    props: {
      ...props,
      style: typeof props.style === 'function' ? props.style({ pressed: false }) : props.style,
    },
  }),
}));

vi.mock('expo-image', () => ({
  Image: (props: MockComponentProps) => ({ type: 'Image', props }),
}));

vi.mock('lucide-react-native', () => ({
  ChevronRight: (props: MockComponentProps) => ({ type: 'ChevronRight', props }),
  Ellipsis: (props: MockComponentProps) => ({ type: 'Ellipsis', props }),
  Send: (props: MockComponentProps) => ({ type: 'Send', props }),
}));

vi.mock('@/components/ui/toggle', () => ({
  Toggle: (props: MockComponentProps & { value?: boolean; onValueChange?: (v: boolean) => void }) => ({
    type: 'Toggle',
    props,
  }),
}));

vi.mock('@/constants/theme', () => ({
  Colors: { light: {}, dark: {} },
  NotificationPluginsSheetTokens: {
    colors: {
      sheetBackground: '#F4F4F7',
      headerTitle: '#0F1729',
      sectionTitle: '#737380',
      cardBackground: '#FFFFFF',
      divider: '#E5E5EB',
      rowTitle: '#0F1729',
      rowDescription: '#80808C',
      phoneBadgeBackground: '#E8F5E9',
      phoneBadgeBorder: '#C8E6C9',
      phoneBadgeText: '#1B5E20',
      actionButtonBackground: 'transparent',
      actionButtonBorder: '#0088CC',
      actionButtonText: '#0088CC',
      telegramIconBackground: '#0088CC',
      telegramLogo: '#FFFFFF',
    },
    layout: {
      contentGap: 20,
      sectionGap: 6,
      horizontalPadding: 16,
      paddingTop: 20,
      paddingBottom: 32,
      headerHeight: 40,
      headerSpacer: 4,
      pluginRowHeight: 64,
      pluginListPaddingVertical: 4,
      iconBoxSize: 40,
      iconBoxRadius: 10,
      whatsappIconBoxRadius: 14,
      telegramIconBoxRadius: 14,
      logoSize: 36,
      chevronSize: 16,
      rowGap: 12,
      textGap: 2,
      dividerInsetLeft: 68,
      badgePaddingHorizontal: 8,
      badgePaddingVertical: 2,
      badgeRadius: 6,
      actionButtonHeight: 28,
      actionButtonPaddingHorizontal: 10,
      actionButtonRadius: 14,
    },
    typography: {
      headerTitle: {
        fontSize: 18,
        fontWeight: '600',
      },
      sectionTitle: {
        fontSize: 11,
        fontWeight: '600',
        lineHeight: 14,
      },
      rowTitle: {
        fontSize: 15,
        fontWeight: '600',
        lineHeight: 18,
      },
      rowDescription: {
        fontSize: 12,
        fontWeight: '400',
        lineHeight: 16,
      },
      phoneBadge: {
        fontSize: 11,
        fontWeight: '600',
        lineHeight: 14,
      },
      actionButton: {
        fontSize: 11,
        fontWeight: '600',
        lineHeight: 14,
      },
    },
  },
}));

vi.mock('@/components/ui/modal-bottom-sheet', () => ({
  ModalBottomSheet: ({
    children,
    header,
    testID,
  }: {
    children: React.ReactNode;
    header: React.ReactNode;
    testID?: string;
  }) => ({
    type: 'ModalBottomSheet',
    props: { testID, header, children },
  }),
}));

vi.mock('@/components/ui/animated-dropdown-overlay', () => ({
  AnimatedDropdownOverlay: (props: MockComponentProps) => ({
    type: 'AnimatedDropdownOverlay',
    props,
  }),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: (props: MockComponentProps) => ({
    type: 'DropdownMenu',
    props,
  }),
}));

vi.mock('@/components/ui/liquid-glass-icon-button', () => ({
  LiquidGlassIconButton: (props: MockComponentProps) => ({
    type: 'LiquidGlassIconButton',
    props,
  }),
}));

vi.mock('@/features/plugins/presentation/notification-settings/components/robot-notifications-section', () => ({
  RobotNotificationsSection: (props: MockComponentProps) => ({
    type: 'RobotNotificationsSection',
    props,
  }),
}));

type MockRenderNode = {
  type?: string;
  props?: {
    children?: unknown;
    testID?: string;
    onPress?: () => void;
    onValueChange?: (val: boolean) => void;
    [key: string]: unknown;
  };
};

function findNodes(
  root: unknown,
  predicate: (node: MockRenderNode) => boolean
): MockRenderNode[] {
  const matches: MockRenderNode[] = [];

  function traverse(node: unknown) {
    if (!node || typeof node !== 'object') return;
    const candidate = node as MockRenderNode;
    if (predicate(candidate)) {
      matches.push(candidate);
    }
    const children = candidate.props?.children;
    if (children) {
      if (Array.isArray(children)) {
        children.forEach(traverse);
      } else {
        traverse(children);
      }
    }
    const header = candidate.props?.header;
    if (header) {
      if (Array.isArray(header)) {
        header.forEach(traverse);
      } else {
        traverse(header);
      }
    }
  }

  traverse(root);
  return matches;
}

describe('NotificationPluginsSheet', () => {
  it('renders supported channels with WhatsApp and Telegram in the list', () => {
    const onPluginPress = vi.fn();
    const onClose = vi.fn();

    const element = NotificationPluginsSheet({
      isVisible: true,
      onClose,
      onPluginPress,
      testID: 'test-sheet',
    });

    const pluginRows = findNodes(
      element,
      (node) =>
        typeof node.props?.testID === 'string' &&
        node.props.testID.startsWith('test-sheet-plugin-')
    );

    expect(pluginRows).toHaveLength(2);
    expect(pluginRows[0].props?.testID).toBe('test-sheet-plugin-whatsapp');
    expect(pluginRows[1].props?.testID).toBe('test-sheet-plugin-telegram');

    const whatsappTextNodes = findNodes(
      pluginRows[0],
      (node) => node.props?.children === 'WhatsApp'
    );
    expect(whatsappTextNodes).toHaveLength(1);

    const telegramTextNodes = findNodes(
      pluginRows[1],
      (node) => node.props?.children === 'Telegram'
    );
    expect(telegramTextNodes).toHaveLength(1);
    const connectTelegramButton = findNodes(
      pluginRows[1],
      (node) => node.props?.testID === 'test-sheet-connect-button-telegram'
    );
    expect(connectTelegramButton).toHaveLength(1);
  });
  it('renders phone badge when connectedPhoneNumber is provided in plugins', () => {
    const element = NotificationPluginsSheet({
      isVisible: true,
      onClose: vi.fn(),
      plugins: [
        {
          id: 'whatsapp',
          title: 'WhatsApp',
          description: 'Receive task updates and daily reminders from Joy via WhatsApp',
          connectedPhoneNumber: '+62 899-3000-101',
          isConnected: true,
          isEnabled: true,
        },
      ],
      testID: 'test-sheet',
    });

    const phoneBadge = findNodes(
      element,
      (node) => node.props?.children === '+62 899-3000-101'
    );
    expect(phoneBadge).toHaveLength(1);
  });

  it('triggers onPluginPress and onTogglePlugin correctly', () => {
    const onPluginPress = vi.fn();
    const onTogglePlugin = vi.fn();
    const onClose = vi.fn();

    const element = NotificationPluginsSheet({
      isVisible: true,
      onClose,
      onPluginPress,
      onTogglePlugin,
      testID: 'test-sheet',
    });

    const whatsappRow = findNodes(
      element,
      (node) => node.props?.testID === 'test-sheet-plugin-whatsapp'
    )[0];

    expect(whatsappRow).toBeDefined();
    whatsappRow.props?.onPress?.();
    expect(onPluginPress).toHaveBeenCalledWith('whatsapp');

    const toggleWhatsApp = findNodes(
      element,
      (node) => node.props?.testID === 'test-sheet-toggle-whatsapp'
    )[0];
    expect(toggleWhatsApp).toBeDefined();
    toggleWhatsApp.props?.onValueChange?.(false);
    expect(onTogglePlugin).toHaveBeenCalledWith('whatsapp', false);
  });
  it('renders header with back button and title without more-options button', () => {
    const onClose = vi.fn();

    const element = NotificationPluginsSheet({
      isVisible: true,
      onClose,
      testID: 'test-sheet',
    });

    const backButton = findNodes(
      element,
      (node) => node.props?.testID === 'test-sheet-back-button'
    )[0];
    expect(backButton).toBeDefined();
    backButton.props?.onPress?.();
    expect(onClose).toHaveBeenCalledTimes(1);

    const moreButtons = findNodes(
      element,
      (node) => node.props?.testID === 'test-sheet-more-button'
    );
    expect(moreButtons).toHaveLength(0);

    const headerPlaceholders = findNodes(
      element,
      (node) => node.props?.testID === 'test-sheet-header-placeholder'
    );
    expect(headerPlaceholders).toHaveLength(1);
  });
});
