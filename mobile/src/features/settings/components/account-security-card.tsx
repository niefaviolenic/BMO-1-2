import { Image } from 'expo-image';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { SettingsTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type AccountSecurityIconType = 'mail' | 'phone' | 'lock' | 'key';

export type AccountSecurityItem = {
  id: string;
  label: string;
  value?: string;
  icon?: AccountSecurityIconType;
  onPress?: () => void;
  showChevron?: boolean;
};

export type AccountSecurityCardProps = {
  /** Email address displayed in the Email row. */
  email?: string;
  /** Phone number displayed in the Phone number row. */
  phone?: string;
  /** Password text or masked dots (defaults to "••••••••"). */
  password?: string;
  /** Custom list of items to render inside the card container. */
  items?: AccountSecurityItem[];
  /** Callback fired when the Email row is pressed. */
  onEmailPress?: () => void;
  /** Callback fired when the Phone number row is pressed. */
  onPhonePress?: () => void;
  /** Callback fired when the Password row is pressed. */
  onPasswordPress?: () => void;
  /** Callback fired when any row is pressed with its item ID. */
  onItemPress?: (id: string) => void;
  /** Custom container style overrides. */
  style?: StyleProp<ViewStyle>;
  /** Optional testID for automated testing. */
  testID?: string;
};

const MAIL_ICON_URI = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0D0D0D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="2" y="4" width="20" height="16" rx="2"/>
  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
</svg>
`)}`;

const PHONE_ICON_URI = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0D0D0D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
</svg>
`)}`;

const LOCK_ICON_URI = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0D0D0D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
</svg>
`)}`;

const KEY_ICON_URI = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0D0D0D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="7.5" cy="15.5" r="5.5"/>
  <path d="m21 2-9.6 9.6"/>
  <path d="m15.5 7.5 3 3"/>
</svg>
`)}`;

const CHEVRON_RIGHT_URI = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M6 4L10 8L6 12" stroke="#8C8C94" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`)}`;

const ICON_MAP: Record<AccountSecurityIconType, string> = {
  mail: MAIL_ICON_URI,
  phone: PHONE_ICON_URI,
  lock: LOCK_ICON_URI,
  key: KEY_ICON_URI,
};

export function AccountSecurityCard({
  email = 'denisemcguire838@gmail.com',
  phone = '+6285137440310',
  password = '••••••••',
  items,
  onEmailPress,
  onPhonePress,
  onPasswordPress,
  onItemPress,
  style,
  testID = 'account-security-card',
}: AccountSecurityCardProps) {
  const theme = useTheme();
  const defaultItems: AccountSecurityItem[] = [
    {
      id: 'email',
      label: 'Email',
      value: email,
      icon: 'mail',
      onPress: onEmailPress,
      showChevron: true,
    },
    {
      id: 'phone',
      label: 'Phone number',
      value: phone,
      icon: 'phone',
      onPress: onPhonePress,
      showChevron: true,
    },
    {
      id: 'password',
      label: 'Password',
      value: password,
      icon: 'lock',
      onPress: onPasswordPress,
      showChevron: true,
    },
  ];

  const displayItems = items ?? defaultItems;

  const handlePress = (item: AccountSecurityItem) => {
    onItemPress?.(item.id);
    item.onPress?.();
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBackground }, style]} testID={testID}>
      {displayItems.map((item, index) => {
        const isLast = index === displayItems.length - 1;
        const iconUri = item.icon ? ICON_MAP[item.icon] : undefined;
        const hasPressHandler = Boolean(item.onPress || onItemPress);

        return (
          <React.Fragment key={item.id}>
            <Pressable
              onPress={() => handlePress(item)}
              disabled={!hasPressHandler}
              accessibilityRole={hasPressHandler ? 'button' : undefined}
              accessibilityLabel={`${item.label}: ${item.value ?? ''}`}
              testID={`${testID}-row-${item.id}`}
              style={({ pressed }) => [
                styles.row,
                hasPressHandler && pressed && styles.rowPressed,
              ]}
            >
              <View style={styles.leftContent}>
                {iconUri ? (
                  <Image
                    source={{ uri: iconUri }}
                    style={styles.itemIcon}
                    tintColor={theme.icon}
                    contentFit="contain"
                    accessibilityLabel={`${item.label} icon`}
                    testID={`${testID}-row-${item.id}-icon`}
                  />
                ) : null}
                <Text
                  style={[styles.label, { color: theme.text }]}
                  numberOfLines={1}
                  testID={`${testID}-row-${item.id}-label`}
                >
                  {item.label}
                </Text>
              </View>

              <View style={styles.rightContent}>
                {item.value ? (
                  <Text
                    style={[styles.value, { color: theme.textSecondary }]}
                    numberOfLines={1}
                    testID={`${testID}-row-${item.id}-value`}
                  >
                    {item.value}
                  </Text>
                ) : null}

                {item.showChevron !== false ? (
                  <Image
                    source={{ uri: CHEVRON_RIGHT_URI }}
                    style={styles.chevronIcon}
                    tintColor={theme.textSecondary}
                    contentFit="contain"
                    accessibilityLabel="chevron right"
                    testID={`${testID}-row-${item.id}-chevron`}
                  />
                ) : null}
              </View>
            </Pressable>

            {!isLast && (
              <View
                style={[styles.divider, { backgroundColor: theme.divider }]}
                testID={`${testID}-divider-${index}`}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const tokens = SettingsTokens.accountSecurityCard;

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: tokens.width,
    backgroundColor: tokens.cardBackground,
    borderRadius: tokens.cardRadius,
    overflow: 'hidden',
  },
  row: {
    height: tokens.rowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.rowPaddingHorizontal,
  },
  rowPressed: {
    opacity: 0.7,
    backgroundColor: '#F5F5F7',
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.rowGap,
    flexShrink: 0,
  },
  itemIcon: {
    width: tokens.iconSize,
    height: tokens.iconSize,
  },
  label: {
    fontSize: tokens.labelFontSize,
    fontWeight: '400',
    lineHeight: tokens.labelLineHeight,
    color: tokens.labelColor,
  },
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
    paddingLeft: 12,
  },
  value: {
    fontSize: tokens.valueFontSize,
    fontWeight: '400',
    lineHeight: tokens.valueLineHeight,
    color: tokens.valueColor,
    flexShrink: 1,
    textAlign: 'right',
  },
  chevronIcon: {
    width: tokens.chevronSize,
    height: tokens.chevronSize,
  },
  divider: {
    height: 1,
    backgroundColor: tokens.dividerColor,
    marginLeft: tokens.dividerInsetLeft,
  },
});
