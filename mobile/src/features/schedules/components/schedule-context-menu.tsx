import { CirclePause, CirclePlay, Pencil, Trash2 } from 'lucide-react-native';
import { type StyleProp, type ViewStyle } from 'react-native';

import { DropdownMenu, type DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { DropdownMenuTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ScheduleContextMenuVariant = 'active' | 'paused' | 'completed';

export type ScheduleContextMenuProps = {
  variant?: ScheduleContextMenuVariant;
  onEdit?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onDelete?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function ScheduleContextMenu({
  variant = 'active',
  onEdit,
  onPause,
  onResume,
  onDelete,
  style,
  testID = 'schedule-context-menu',
}: ScheduleContextMenuProps) {
  const theme = useTheme();
  const labelColor = theme.text;
  const destructiveColor = DropdownMenuTokens.destructiveColor;

  const items: DropdownMenuItem[] = [
    {
      id: 'edit',
      label: 'Edit',
      icon: <Pencil size={20} color={labelColor} strokeWidth={1.75} />,
      onPress: () => onEdit?.(),
    },
  ];

  if (variant === 'active') {
    items.push({
      id: 'pause',
      label: 'Pause',
      icon: <CirclePause size={20} color={labelColor} strokeWidth={1.75} />,
      showDivider: true,
      onPress: () => onPause?.(),
    });
  } else if (variant === 'paused') {
    items.push({
      id: 'resume',
      label: 'Resume',
      icon: <CirclePlay size={20} color={labelColor} strokeWidth={1.75} />,
      showDivider: true,
      onPress: () => onResume?.(),
    });
  }

  items.push({
    id: 'delete',
    label: 'Delete',
    icon: <Trash2 size={20} color={destructiveColor} strokeWidth={1.75} />,
    isDestructive: true,
    showDivider: true,
    onPress: () => onDelete?.(),
  });

  return <DropdownMenu items={items} style={style} testID={testID} />;
}
