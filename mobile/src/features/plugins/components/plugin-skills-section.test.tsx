/* eslint-disable import/first */
// @ts-nocheck
/* eslint-disable import/no-unresolved */
import { describe, expect, it, vi } from 'vitest';

type MockComponentProps = Record<string, unknown> & {
  children?: React.ReactNode;
  testID?: string;
};

type MockTreeNode = {
  type: string | React.ComponentType<unknown>;
  props: MockComponentProps;
  children?: MockTreeNode[];
};

vi.mock('lucide-react-native', () => ({
  ChevronRight: (props: MockComponentProps) => ({ type: 'ChevronRight', props }),
  Layers: (props: MockComponentProps) => ({ type: 'Layers', props }),
}));

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    background: '#000000',
    backgroundElement: '#F2F4F7',
    cardBackground: '#1C1C1E',
    cardPressed: '#2C2C2E',
    text: '#FFFFFF',
    textTitle: '#FFFFFF',
    textMuted: '#8E8E93',
    textSecondary: '#8E8E93',
    divider: '#38383A',
  }),
}));

vi.mock('react-native', () => {
  const mockComponent = (name: string) => {
    const Component = (props: MockComponentProps) => ({
      type: name,
      props,
      children:
        typeof props.children === 'function'
          ? React.Children.toArray(props.children({ pressed: false }))
          : React.Children.toArray(props.children),
    });
    Component.displayName = name;
    return Component;
  };
  return {
    Platform: {
      OS: 'android',
      select: (dict: Record<string, unknown>) => dict.android ?? dict.default,
    },
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    View: mockComponent('View'),
    Text: mockComponent('Text'),
    Pressable: mockComponent('Pressable'),
  };
});

import { PluginSkillsSection, type SkillItem } from './plugin-skills-section';

function getNodeType(node: MockTreeNode | null): string | undefined {
  if (!node) return undefined;
  if (typeof node.type === 'string') return node.type;
  if (typeof node.type === 'function') {
    if ('displayName' in node.type && typeof node.type.displayName === 'string') {
      return node.type.displayName;
    }
    if ('name' in node.type && typeof node.type.name === 'string') {
      return node.type.name;
    }
  }
  return undefined;
}
function findByTestId(node: unknown, testId: string): MockTreeNode | null {
  if (!node || typeof node !== 'object') {
    return null;
  }

  const candidate = node as MockTreeNode;
  if (candidate.props && candidate.props.testID === testId) {
    return candidate;
  }

  const children = Array.isArray(candidate.children)
    ? candidate.children
    : candidate.props && Array.isArray(candidate.props.children)
      ? (candidate.props.children as MockTreeNode[])
      : [];

  for (const child of children) {
    const found = findByTestId(child, testId);
    if (found) {
      return found;
    }
  }

  return null;
}

describe('PluginSkillsSection', () => {
  const mockSkills: SkillItem[] = [
    { id: 'spotify-play', name: 'spotify-play' },
    { id: 'spotify-pause', name: 'spotify-pause' },
  ];

  it('renders pills as non-interactive View when onSkillPress is not provided', () => {
    const tree = PluginSkillsSection({
      skills: mockSkills,
      variant: 'pills',
      testID: 'test-skills',
    });

    const itemNode = findByTestId(tree, 'test-skills-item-spotify-play');
    expect(itemNode).not.toBeNull();
    expect(getNodeType(itemNode)).toBe('View');
    expect(itemNode?.props.accessibilityRole).toBeUndefined();
    expect(itemNode?.props.onPress).toBeUndefined();
  });

  it('renders pills as Pressable when onSkillPress is provided', () => {
    const onSkillPress = vi.fn();
    const tree = PluginSkillsSection({
      skills: mockSkills,
      variant: 'pills',
      onSkillPress,
      testID: 'test-skills',
    });

    const itemNode = findByTestId(tree, 'test-skills-item-spotify-play');
    expect(itemNode).not.toBeNull();
    expect(getNodeType(itemNode)).toBe('Pressable');
    expect(itemNode?.props.accessibilityRole).toBe('button');

    const onPress = itemNode?.props.onPress as (() => void) | undefined;
    onPress?.();
    expect(onSkillPress).toHaveBeenCalledWith('spotify-play');
  });

  it('renders card rows as non-interactive View when onSkillPress is not provided', () => {
    const tree = PluginSkillsSection({
      skills: mockSkills,
      variant: 'card',
      testID: 'test-skills',
    });

    const itemNode = findByTestId(tree, 'test-skills-item-spotify-play');
    expect(itemNode).not.toBeNull();
    expect(getNodeType(itemNode)).toBe('View');
    expect(itemNode?.props.accessibilityRole).toBeUndefined();
    expect(itemNode?.props.onPress).toBeUndefined();

    const chevronNode = findByTestId(tree, 'test-skills-item-spotify-play-chevron');
    expect(chevronNode).toBeNull();
  });

  it('renders card rows as Pressable with chevron when onSkillPress is provided', () => {
    const onSkillPress = vi.fn();
    const tree = PluginSkillsSection({
      skills: mockSkills,
      variant: 'card',
      onSkillPress,
      testID: 'test-skills',
    });

    const itemNode = findByTestId(tree, 'test-skills-item-spotify-play');
    expect(itemNode).not.toBeNull();
    expect(getNodeType(itemNode)).toBe('Pressable');
    expect(itemNode?.props.accessibilityRole).toBe('button');

    const chevronNode = findByTestId(tree, 'test-skills-item-spotify-play-chevron');
    expect(chevronNode).not.toBeNull();

    const onPress = itemNode?.props.onPress as (() => void) | undefined;
    onPress?.();
    expect(onSkillPress).toHaveBeenCalledWith('spotify-play');
  });
});
