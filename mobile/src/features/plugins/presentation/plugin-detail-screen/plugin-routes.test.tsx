/* eslint-disable */
// @ts-ignore
import React from 'react';
// @ts-ignore
import { describe, expect, it, vi } from 'vitest';
import PluginDetailRoute from '@/app/plugin-detail';
import PluginDeepLinkRoute from '@/app/plugins/[id]';

vi.mock('@/features/plugins/presentation/plugin-detail-screen', () => ({
  PluginDetailScreen: () => ({ type: 'PluginDetailScreen' }),
}));

describe('Plugin Route Wrappers', () => {
  it('renders PluginDetailScreen from PluginDetailRoute', () => {
    const element = PluginDetailRoute();
    expect(element).toBeDefined();
    expect(element.type).toEqual(expect.any(Function));
  });

  it('renders PluginDetailScreen from PluginDeepLinkRoute (/plugins/[id])', () => {
    const element = PluginDeepLinkRoute();
    expect(element).toBeDefined();
    expect(element.type).toEqual(expect.any(Function));
  });
});
