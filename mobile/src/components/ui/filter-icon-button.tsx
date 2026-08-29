import { ListFilter } from 'lucide-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { LiquidGlassIconButton } from '@/components/ui/liquid-glass-icon-button';
import { ScheduleTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type FilterIconButtonProps = {
  onPress?: () => void;
  /** When true, shows blue active filter state (Paused / Completed selected). */
  isActive?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function FilterIconButton({
  onPress,
  isActive = false,
  style,
  testID = 'filter-icon-button',
}: FilterIconButtonProps) {
  const theme = useTheme();

  return (
    <LiquidGlassIconButton
      onPress={onPress}
      size={ScheduleTokens.sizes.filterButton}
      accessibilityLabel="Filter"
      testID={testID}
      style={style}
    >
      {isActive ? (
        <View
          style={[
            styles.activeInner,
            { backgroundColor: theme.accentPrimary ?? theme.linkPrimary },
          ]}
          testID={`${testID}-active`}
        >
          <ListFilter
            size={ScheduleTokens.sizes.filterIcon}
            color={ScheduleTokens.colors.filterIconActive}
            strokeWidth={2}
          />
        </View>
      ) : (
        <ListFilter
          size={ScheduleTokens.sizes.filterIcon}
          color={theme.icon}
          strokeWidth={2}
        />
      )}
    </LiquidGlassIconButton>
  );
}

const styles = StyleSheet.create({
  activeInner: {
    width: ScheduleTokens.sizes.filterActiveInner,
    height: ScheduleTokens.sizes.filterActiveInner,
    borderRadius: ScheduleTokens.borderRadius.circle,
    backgroundColor: ScheduleTokens.colors.blueAccent,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
