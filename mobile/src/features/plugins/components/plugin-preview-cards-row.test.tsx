/* eslint-disable import/first */
// @ts-nocheck
/* eslint-disable import/no-unresolved */
import Module from 'module';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

type NodeModuleWithRequire = {
  require: (this: unknown, ...args: unknown[]) => unknown;
};

const moduleProto = Module.prototype as unknown as NodeModuleWithRequire;
const originalRequire = moduleProto.require;
moduleProto.require = function (this: unknown, ...args: unknown[]): unknown {
  const id = args[0];
  if (typeof id === 'string' && (id.includes('.png') || id.includes('.svg') || id.includes('@/assets'))) {
    return 'mocked-asset';
  }
  return originalRequire.apply(this, args);
};

type MockComponentProps = Record<string, unknown> & {
  children?: React.ReactNode;
  testID?: string;
};

type MockTreeNode = {
  type: string;
  props?: MockComponentProps;
  children?: unknown;
};

vi.mock('expo-image', () => ({
  Image: (props: MockComponentProps) => ({ type: 'Image', props }),
}));

vi.mock('lucide-react-native', () => ({
  Check: (props: MockComponentProps) => ({ type: 'Check', props }),
  CheckCheck: (props: MockComponentProps) => ({ type: 'CheckCheck', props }),
  Headphones: (props: MockComponentProps) => ({ type: 'Headphones', props }),
  Mic: (props: MockComponentProps) => ({ type: 'Mic', props }),
  Music: (props: MockComponentProps) => ({ type: 'Music', props }),
  Play: (props: MockComponentProps) => ({ type: 'Play', props }),
  Radio: (props: MockComponentProps) => ({ type: 'Radio', props }),
  ShieldCheck: (props: MockComponentProps) => ({ type: 'ShieldCheck', props }),
  SkipBack: (props: MockComponentProps) => ({ type: 'SkipBack', props }),
  SkipForward: (props: MockComponentProps) => ({ type: 'SkipForward', props }),
  Sparkles: (props: MockComponentProps) => ({ type: 'Sparkles', props }),
  Volume2: (props: MockComponentProps) => ({ type: 'Volume2', props }),
}));

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    background: '#FFFFFF',
    backgroundElement: '#F5F5F7',
    border: '#E5E5EB',
    textTitle: '#000000',
    textSecondary: '#66666E',
    textMuted: '#8C8C94',
    icon: '#111111',
  }),
}));

vi.mock('@/features/plugins/components/plugin-brand-logo', () => ({
  PluginBrandLogo: (props: MockComponentProps) => ({ type: 'PluginBrandLogo', props }),
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
    ScrollView: mockComponent('ScrollView'),
    StyleSheet: {
      create: <T extends Record<string, unknown>>(styles: T) => styles,
    },
  };
});

import { PluginPreviewCardsRow } from './plugin-preview-cards-row';
import {
  WhatsAppPreviewCardChat,
  WhatsAppPreviewCardVoice,
  WhatsAppPreviewCardPrivacy,
} from './preview-cards/whatsapp-preview-cards';
import {
  SpotifyPreviewCardPlayer,
  SpotifyPreviewCardDJ,
  SpotifyPreviewCardDevices,
} from './preview-cards/spotify-preview-cards';

function findByTestId(node: unknown, testId: string): MockTreeNode | null {
  if (!node || typeof node !== 'object') return null;
  const typedNode = node as MockTreeNode;
  if (typedNode.props?.testID === testId) return typedNode;

  const children = typedNode.props?.children || typedNode.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const match = findByTestId(child, testId);
      if (match) return match;
    }
  } else if (children && typeof children === 'object') {
    return findByTestId(children, testId);
  }
  return null;
}

describe('PluginPreviewCardsRow', () => {
  it('renders default placeholder cards when no pluginId is passed', () => {
    const tree = PluginPreviewCardsRow({});
    const card0 = findByTestId(tree, 'plugin-preview-cards-row-card-0');
    const placeholder0 = findByTestId(tree, 'plugin-preview-cards-row-placeholder-0');
    expect(card0).toBeTruthy();
    expect(placeholder0).toBeTruthy();
  });

  it('renders WhatsApp preview cards when pluginId is whatsapp', () => {
    const tree = PluginPreviewCardsRow({ pluginId: 'whatsapp' });
    const waCard0 = findByTestId(tree, 'plugin-preview-cards-row-wa-card-0');
    const waCard1 = findByTestId(tree, 'plugin-preview-cards-row-wa-card-1');
    const waCard2 = findByTestId(tree, 'plugin-preview-cards-row-wa-card-2');
    expect(waCard0).toBeTruthy();
    expect(waCard1).toBeTruthy();
    expect(waCard2).toBeTruthy();
  });

  it('renders Spotify preview cards when pluginId is spotify', () => {
    const tree = PluginPreviewCardsRow({ pluginId: 'spotify' });
    const spCard0 = findByTestId(tree, 'plugin-preview-cards-row-sp-card-0');
    const spCard1 = findByTestId(tree, 'plugin-preview-cards-row-sp-card-1');
    const spCard2 = findByTestId(tree, 'plugin-preview-cards-row-sp-card-2');
    expect(spCard0).toBeTruthy();
    expect(spCard1).toBeTruthy();
    expect(spCard2).toBeTruthy();
  });

  it('renders custom image cards when images prop is supplied', () => {
    const images = ['https://example.com/1.png', 'https://example.com/2.png'];
    const tree = PluginPreviewCardsRow({ images });
    const card0 = findByTestId(tree, 'plugin-preview-cards-row-card-0');
    const card1 = findByTestId(tree, 'plugin-preview-cards-row-card-1');
    expect(card0).toBeTruthy();
    expect(card1).toBeTruthy();
  });

  it('renders individual WhatsApp preview subcomponents correctly', () => {
    const chatTree = WhatsAppPreviewCardChat({});
    const voiceTree = WhatsAppPreviewCardVoice({});
    const privacyTree = WhatsAppPreviewCardPrivacy({});
    expect(findByTestId(chatTree, 'whatsapp-preview-card-chat')).toBeTruthy();
    expect(findByTestId(voiceTree, 'whatsapp-preview-card-voice')).toBeTruthy();
    expect(findByTestId(privacyTree, 'whatsapp-preview-card-privacy')).toBeTruthy();
  });

  it('renders individual Spotify preview subcomponents correctly', () => {
    const playerTree = SpotifyPreviewCardPlayer({});
    const djTree = SpotifyPreviewCardDJ({});
    const devicesTree = SpotifyPreviewCardDevices({});
    expect(findByTestId(playerTree, 'spotify-preview-card-player')).toBeTruthy();
    expect(findByTestId(djTree, 'spotify-preview-card-dj')).toBeTruthy();
    expect(findByTestId(devicesTree, 'spotify-preview-card-devices')).toBeTruthy();
  });
});
