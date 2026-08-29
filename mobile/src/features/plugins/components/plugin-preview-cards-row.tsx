import { Image } from 'expo-image';
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { PluginsTokens } from '@/constants/theme';
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

export type PluginPreviewCardsRowProps = {
  /** Plugin ID (e.g. 'whatsapp', 'spotify') to display high-fidelity built-in preview cards. */
  pluginId?: string;
  /** Optional array of image URLs or image source strings. */
  images?: string[];
  /** Optional custom React nodes for cards. */
  cards?: React.ReactNode[];
  /** Custom container style override. */
  style?: StyleProp<ViewStyle>;
  /** Custom content container style for inner horizontal ScrollView. */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Optional callback when a preview card is pressed. */
  onCardPress?: (index: number) => void;
  /** Optional testID for automated testing. */
  testID?: string;
};

const DEFAULT_CARD_WIDTHS = [233, 200, 200];

export function PluginPreviewCardsRow({
  pluginId,
  images,
  cards,
  style,
  contentContainerStyle,
  onCardPress,
  testID = 'plugin-preview-cards-row',
}: PluginPreviewCardsRowProps) {
  const theme = useTheme();

  // Resolve which cards to render
  const renderCardContent = (index: number) => {
    if (cards && cards[index]) {
      return cards[index];
    }

    if (images && images.length > 0 && images[index]) {
      return (
        <Image
          source={{ uri: images[index] }}
          style={styles.cardImage}
          contentFit="cover"
          accessibilityLabel={`Screenshot ${index + 1}`}
        />
      );
    }

    if (pluginId === 'whatsapp') {
      if (index === 0) return <WhatsAppPreviewCardChat testID={`${testID}-wa-card-0`} />;
      if (index === 1) return <WhatsAppPreviewCardVoice testID={`${testID}-wa-card-1`} />;
      if (index === 2) return <WhatsAppPreviewCardPrivacy testID={`${testID}-wa-card-2`} />;
    }

    if (pluginId === 'spotify') {
      if (index === 0) return <SpotifyPreviewCardPlayer testID={`${testID}-sp-card-0`} />;
      if (index === 1) return <SpotifyPreviewCardDJ testID={`${testID}-sp-card-1`} />;
      if (index === 2) return <SpotifyPreviewCardDevices testID={`${testID}-sp-card-2`} />;
    }

    // Default fallback placeholder graphic
    return (
      <View style={styles.placeholderGraphic} testID={`${testID}-placeholder-${index}`}>
        <Image
          source={require('@/assets/images/plugins/placeholder-image-icon.svg')}
          style={styles.placeholderIcon}
          contentFit="contain"
        />
      </View>
    );
  };

  const totalCards =
    cards?.length ??
    (images && images.length > 0 ? images.length : DEFAULT_CARD_WIDTHS.length);

  const cardIndices = Array.from({ length: totalCards }, (_, i) => i);

  return (
    <View style={[styles.container, style]} testID={testID}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
        style={styles.scrollView}
      >
        {cardIndices.map((index) => {
          const width = index === 0 ? 233 : 200;

          return (
            <Pressable
              key={`card-${index}`}
              onPress={() => onCardPress?.(index)}
              disabled={!onCardPress}
              accessibilityRole={onCardPress ? 'button' : 'image'}
              accessibilityLabel={`Preview card ${index + 1}`}
              testID={`${testID}-card-${index}`}
              style={({ pressed }) => [
                styles.card,
                {
                  width,
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.border,
                },
                pressed && onCardPress ? styles.pressed : null,
              ]}
            >
              {renderCardContent(index)}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 280,
    width: '100%',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  card: {
    height: 280,
    borderRadius: PluginsTokens.borderRadius.card,
    backgroundColor: '#F0F0F3',
    borderWidth: 1,
    borderColor: '#E0E3EB',
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.8,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  placeholderGraphic: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    width: 32,
    height: 32,
  },
});
