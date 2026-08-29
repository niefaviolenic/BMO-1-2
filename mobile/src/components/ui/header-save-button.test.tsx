/* eslint-disable import/no-unresolved */
// @ts-ignore
import React from 'react';
// @ts-ignore
import { describe, expect, it, vi } from 'vitest';

import { HeaderTokens } from '@/constants/theme';
import { HeaderSaveButton } from './header-save-button';

type MockComponentProps = {
  children?: React.ReactNode;
  testID?: string;
  onPress?: () => void;
  [key: string]: unknown;
};

vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: (dict: Record<string, unknown>) => dict.ios ?? dict.default,
  },
  ActivityIndicator: (props: MockComponentProps) => ({ type: 'ActivityIndicator', props }),
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T) => styles,
  },
  Text: (props: MockComponentProps) => ({ type: 'Text', props }),
  View: (props: MockComponentProps) => ({ type: 'View', props }),
}));

vi.mock('./liquid-glass-icon-button', () => ({
  LiquidGlassIconButton: (props: MockComponentProps) => ({
    type: 'LiquidGlassIconButton',
    props,
  }),
}));

describe('HeaderSaveButton', () => {
  it('defaults to blue variant with backgroundBlue and textBlue', () => {
    const rendered = HeaderSaveButton({
      label: 'Save',
      testID: 'save-btn',
    }) as unknown as {
      type: string;
      props: {
        backgroundColor: string;
        children: {
          props: {
            testID: string;
            children: string;
            style: unknown[];
          };
        };
      };
    };

    expect(rendered.props.backgroundColor).toBe(HeaderTokens.saveButton.backgroundBlue);
    expect(rendered.props.backgroundColor).toBe('#007AFF');
    expect(rendered.props.children.props.children).toBe('Save');
    expect(rendered.props.children.props.style).toEqual(
      expect.arrayContaining([{ color: HeaderTokens.saveButton.textBlue }])
    );
  });

  it('renders white variant with backgroundWhite and textWhite', () => {
    const rendered = HeaderSaveButton({
      label: 'Save',
      variant: 'white',
      testID: 'save-btn',
    }) as unknown as {
      props: {
        backgroundColor: string;
      };
    };

    expect(rendered.props.backgroundColor).toBe(HeaderTokens.saveButton.backgroundWhite);
  });

  it('renders dark variant with backgroundDark and textDark', () => {
    const rendered = HeaderSaveButton({
      label: 'Save',
      variant: 'dark',
      testID: 'save-btn',
    }) as unknown as {
      props: {
        backgroundColor: string;
      };
    };

    expect(rendered.props.backgroundColor).toBe(HeaderTokens.saveButton.backgroundDark);
  });

  it('renders ActivityIndicator when loading', () => {
    const rendered = HeaderSaveButton({
      label: 'Save',
      loading: true,
      testID: 'save-btn',
    }) as unknown as {
      props: {
        children: {
          type: string;
          props: {
            color: string;
            testID: string;
          };
        };
      };
    };

    expect(rendered.props.children.props.testID).toBe('save-btn-spinner');
    expect(rendered.props.children.props.color).toBe(HeaderTokens.saveButton.textBlue);
  });
});
