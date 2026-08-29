import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { ChatSearchTokens } from '@/constants/theme';
import type { ChatThread } from '@/features/chat/domain/chat-thread';

export type SearchResultItemProps = {
  chat: ChatThread;
  query?: string;
  variant?: 'history' | 'result';
  onPress: (chat: ChatThread) => void;
  testID?: string;
};

function HighlightedText({
  text,
  query,
  baseStyle,
  highlightStyle,
}: {
  text: string;
  query?: string;
  baseStyle: object;
  highlightStyle: object;
}) {
  if (!text) {
    return null;
  }

  const trimmed = query?.trim();
  if (!trimmed) {
    return <Text style={baseStyle}>{text}</Text>;
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = trimmed.toLowerCase();
  const parts: { value: string; match: boolean }[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const matchIdx = lowerText.indexOf(lowerQuery, cursor);
    if (matchIdx === -1) {
      parts.push({ value: text.slice(cursor), match: false });
      break;
    }
    if (matchIdx > cursor) {
      parts.push({ value: text.slice(cursor, matchIdx), match: false });
    }
    parts.push({ value: text.slice(matchIdx, matchIdx + trimmed.length), match: true });
    cursor = matchIdx + trimmed.length;
  }

  return (
    <Text style={baseStyle}>
      {parts.map((p, idx) => (
        <Text key={idx} style={p.match ? highlightStyle : undefined}>
          {p.value}
        </Text>
      ))}
    </Text>
  );
}

export function SearchResultItem({
  chat,
  query,
  variant = 'result',
  onPress,
  testID = 'search-result-item',
}: SearchResultItemProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => onPress(chat)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={chat.title}
      testID={testID}
    >
      <View
        style={[
          styles.iconWrap,
          variant === 'history' && [styles.historyIconWrap, { backgroundColor: theme.cardBackground, borderColor: theme.border }],
          variant === 'result' && [styles.resultIconWrap, { backgroundColor: theme.backgroundElement }],
        ]}
      >
        <Image
          source={require('@/assets/images/ui/icon-message-circle.svg')}
          style={styles.icon}
          tintColor={theme.icon}
          contentFit="contain"
        />
      </View>
      <View style={styles.textCol}>
        <HighlightedText
          text={chat.title}
          query={query}
          baseStyle={[styles.title, { color: theme.text }]}
          highlightStyle={[styles.snippetHighlight, { color: theme.linkPrimary }]}
        />
        {chat.snippet ? (
          <HighlightedText
            text={chat.snippet}
            query={query}
            baseStyle={[styles.snippet, { color: theme.textSecondary }]}
            highlightStyle={[styles.snippetHighlight, { color: theme.linkPrimary }]}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ChatSearchTokens.spacing.itemGap,
    paddingHorizontal: ChatSearchTokens.spacing.paddingHorizontal,
  },
  pressed: {
    opacity: 0.7,
  },
  iconWrap: {
    width: ChatSearchTokens.sizes.iconTile,
    height: ChatSearchTokens.sizes.iconTile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyIconWrap: {
    borderRadius: ChatSearchTokens.sizes.iconTileRadius,
    borderWidth: 1,
  },
  resultIconWrap: {
    borderRadius: ChatSearchTokens.sizes.resultIconRadius,
  },
  icon: {
    width: ChatSearchTokens.sizes.messageIcon,
    height: ChatSearchTokens.sizes.messageIcon,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...ChatSearchTokens.typography.itemTitle,
  },
  snippet: {
    ...ChatSearchTokens.typography.itemSnippet,
  },
  snippetHighlight: {
    ...ChatSearchTokens.typography.itemSnippet,
    fontWeight: '700',
  },
});
