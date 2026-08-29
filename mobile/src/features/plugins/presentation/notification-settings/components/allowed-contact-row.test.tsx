/* eslint-disable import/first */
// @ts-nocheck
/* eslint-disable import/no-unresolved */
import { describe, expect, it, vi } from 'vitest';

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

vi.mock('lucide-react-native', () => ({
  Bell: (props: MockComponentProps) => ({ type: 'Bell', props }),
  BellOff: (props: MockComponentProps) => ({ type: 'BellOff', props }),
  Trash2: (props: MockComponentProps) => ({ type: 'Trash2', props }),
}));

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    cardBackground: '#FFFFFF',
    text: '#0F1729',
    textSecondary: '#80808C',
    linkPrimary: '#007AFF',
  }),
}));

vi.mock('react-native', () => {
  const mockComponent = (name: string) => {
    const Component = (props: MockComponentProps) => {
      const resolvedChildren =
        typeof props.children === 'function'
          ? (props.children as (state: { pressed: boolean }) => React.ReactNode)({ pressed: false })
          : props.children;
      return { type: name, props, children: resolvedChildren };
    };
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
    ActivityIndicator: mockComponent('ActivityIndicator'),
    StyleSheet: {
      create: <T extends Record<string, unknown>>(styles: T) => styles,
    },
  };
});

import {
  AllowedContactRow,
  AllowedContactRowTokens,
} from './allowed-contact-row';
function findByTestId(node: unknown, testId: string): MockTreeNode | null {
  if (!node || typeof node !== 'object') {
    return null;
  }

  const candidate = node as MockTreeNode;
  if (candidate.props && candidate.props.testID === testId) {
    return candidate;
  }
  const rawChildren = candidate.children ?? candidate.props?.children;
  const children = Array.isArray(rawChildren)
    ? rawChildren
    : rawChildren && typeof rawChildren === 'object'
      ? [rawChildren]
      : [];

  for (const child of children) {
    const found = findByTestId(child, testId);
    if (found) {
      return found;
    }
  }

  return null;
}

describe('AllowedContactRow', () => {
  it('renders contact name and phone number', () => {
    const tree = AllowedContactRow({
      name: 'Cenna Wijaya',
      phoneNumber: '+62 812-3456-7890',
      testID: 'test-row',
    });

    const nameNode = findByTestId(tree, 'test-row-name');
    expect(nameNode).not.toBeNull();
    expect(nameNode?.props?.children).toBe('Cenna Wijaya');

    const phoneNode = findByTestId(tree, 'test-row-phone');
    expect(phoneNode).not.toBeNull();
    expect(phoneNode?.props?.children).toBe('+62 812-3456-7890');
  });

  it('triggers onToggleNotifyVoice when bell button is pressed', () => {
    const onToggle = vi.fn();
    const tree = AllowedContactRow({
      name: 'Cenna Wijaya',
      phoneNumber: '+62 812-3456-7890',
      notifyVoiceEnabled: true,
      onToggleNotifyVoice: onToggle,
      testID: 'test-row',
    });

    const bellButton = findByTestId(tree, 'test-row-bell-button');
    expect(bellButton).not.toBeNull();

    bellButton?.props?.onPress?.();
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('triggers onDelete when trash button is pressed', () => {
    const onDelete = vi.fn();
    const tree = AllowedContactRow({
      name: 'Cenna Wijaya',
      phoneNumber: '+62 812-3456-7890',
      onDelete,
      testID: 'test-row',
    });

    const deleteButton = findByTestId(tree, 'test-row-delete-button');
    expect(deleteButton).not.toBeNull();

    deleteButton?.props?.onPress?.();
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
  it('uses custom accentColor for active bell icon and background', () => {
    const tree = AllowedContactRow({
      name: 'Cenna Wijaya',
      phoneNumber: '+62 812-3456-7890',
      notifyVoiceEnabled: true,
      accentColor: '#25D366',
      testID: 'test-row',
    });

    const bellButton = findByTestId(tree, 'test-row-bell-button');
    expect(bellButton).not.toBeNull();
    const child = (bellButton?.props?.children ?? bellButton?.children) as MockTreeNode | undefined;
    const color = child?.props?.color ?? (typeof child?.type === 'function' ? child.type(child.props)?.props?.color : undefined);
    expect(child?.props?.color ?? color).toBe('#25D366');
  });

  it('renders BellOff icon when notifyVoiceEnabled is false', () => {
    const tree = AllowedContactRow({
      name: 'Cenna Wijaya',
      phoneNumber: '+62 812-3456-7890',
      notifyVoiceEnabled: false,
      accentColor: '#25D366',
      testID: 'test-row',
    });

    const bellButton = findByTestId(tree, 'test-row-bell-button');
    expect(bellButton).not.toBeNull();
    const child = (bellButton?.props?.children ?? bellButton?.children) as MockTreeNode | undefined;
    expect(child).not.toBeNull();
    expect(child?.props?.color).toBe(AllowedContactRowTokens.colors.bellInactive);
  });

  it('defaults to BellOff (disabled) when notifyVoiceEnabled is omitted', () => {
    const tree = AllowedContactRow({
      name: 'Cenna Wijaya',
      phoneNumber: '+62 812-3456-7890',
      testID: 'test-row',
    });

    const bellButton = findByTestId(tree, 'test-row-bell-button');
    expect(bellButton).not.toBeNull();
    const child = (bellButton?.props?.children ?? bellButton?.children) as MockTreeNode | undefined;
    expect(child).not.toBeNull();
    expect(child?.props?.color).toBe(AllowedContactRowTokens.colors.bellInactive);
  });

  it('renders ActivityIndicator for bell button when isTogglingNotifyVoice is true and disables press', () => {
    const onToggle = vi.fn();
    const tree = AllowedContactRow({
      name: 'Cenna Wijaya',
      phoneNumber: '+62 812-3456-7890',
      isTogglingNotifyVoice: true,
      onToggleNotifyVoice: onToggle,
      testID: 'test-row',
    });

    const spinner = findByTestId(tree, 'test-row-bell-spinner');
    expect(spinner).not.toBeNull();
    expect(spinner?.type?.displayName ?? spinner?.type).toBe('ActivityIndicator');

    const bellButton = findByTestId(tree, 'test-row-bell-button');
    expect(bellButton?.props?.disabled).toBe(true);
  });

  it('renders ActivityIndicator for delete button when isDeleting is true and disables press', () => {
    const onDelete = vi.fn();
    const tree = AllowedContactRow({
      name: 'Cenna Wijaya',
      phoneNumber: '+62 812-3456-7890',
      isDeleting: true,
      onDelete,
      testID: 'test-row',
    });

    const spinner = findByTestId(tree, 'test-row-delete-spinner');
    expect(spinner).not.toBeNull();
    expect(spinner?.type?.displayName ?? spinner?.type).toBe('ActivityIndicator');

    const deleteButton = findByTestId(tree, 'test-row-delete-button');
    expect(deleteButton?.props?.disabled).toBe(true);
  });
});
