import { StyleSheet, View } from 'react-native';

import { ChatSearchTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const SKELETON_COUNT = 6;

export type SearchSkeletonListProps = {
  testID?: string;
};

export function SearchSkeletonList({ testID = 'search-skeleton-list' }: SearchSkeletonListProps) {
  const theme = useTheme();

  return (
    <View style={styles.container} testID={testID}>
      {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
        <View key={`skeleton-${index}`} style={styles.row} testID={`${testID}-row-${index}`}>
          <View
            style={[styles.icon, { backgroundColor: theme.backgroundElement }]}
          />
          <View style={styles.textCol}>
            <View
              style={[styles.titleBar, { backgroundColor: theme.backgroundElement }]}
            />
            <View
              style={[styles.snippetBar, { backgroundColor: theme.backgroundElement }]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: ChatSearchTokens.spacing.sectionTop,
    gap: ChatSearchTokens.spacing.listGap,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ChatSearchTokens.spacing.itemGap,
    paddingHorizontal: ChatSearchTokens.spacing.paddingHorizontal,
  },
  icon: {
    width: ChatSearchTokens.sizes.resultIcon,
    height: ChatSearchTokens.sizes.resultIcon,
    borderRadius: ChatSearchTokens.sizes.resultIconRadius,
  },
  textCol: {
    flex: 1,
    gap: 8,
  },
  titleBar: {
    width: ChatSearchTokens.sizes.skeletonTitleWidth,
    height: ChatSearchTokens.sizes.skeletonBarHeight,
    borderRadius: 6,
  },
  snippetBar: {
    width: ChatSearchTokens.sizes.skeletonSnippetWidth,
    height: ChatSearchTokens.sizes.skeletonBarHeight,
    borderRadius: 6,
  },
});
