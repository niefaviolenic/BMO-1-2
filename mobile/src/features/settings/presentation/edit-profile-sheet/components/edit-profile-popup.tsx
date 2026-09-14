import { Image } from 'expo-image';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { UserAvatar } from '@/components/ui/user-avatar';
import { EditProfilePopupTokens as Tokens } from '@/constants/theme';


export type EditProfilePopupProps = {
  /** User's profile name value. Defaults to "Rangga Hadi Putra". */
  name?: string;
  /** User's username value. Defaults to "ranggabiner18214". */
  username?: string;
  /** Image URI for the user's avatar. */
  avatarUri?: string;
  errorMessage?: string | null;
  isSaving?: boolean;
  /** Callback fired when name input value changes. */
  onNameChange?: (name: string) => void;
  /** Callback fired when username input value changes. */
  onUsernameChange?: (username: string) => void;
  /** Callback fired when the avatar area or camera badge is pressed. */
  onAvatarPress?: () => void;
  /** Callback fired when the "Save profile" button is pressed. */
  onSave?: () => void;
  /** Callback fired when the "Cancel" button is pressed. */
  onCancel?: () => void;
  /** Custom container style overrides. */
  style?: StyleProp<ViewStyle>;
  /** Optional testID for automated testing. */
  testID?: string;
};

export function EditProfilePopup({
  name: nameProp,
  username: usernameProp,
  avatarUri,
  errorMessage,
  isSaving = false,
  onNameChange,
  onUsernameChange,
  onAvatarPress,
  onSave,
  onCancel,
  style,
  testID = 'edit-profile-popup',
}: EditProfilePopupProps) {
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [internalName, setInternalName] = useState('');
  const [internalUsername, setInternalUsername] = useState('');
  const nameValue = nameProp !== undefined ? nameProp : internalName;
  const usernameValue = usernameProp !== undefined ? usernameProp : internalUsername;

  const containerWidth = useMemo(
    () => Math.min(Tokens.maxWidth, windowWidth - Tokens.horizontalInset * 2),
    [windowWidth],
  );

  const fieldWidth = useMemo(
    () => Math.min(Tokens.fieldWidth, containerWidth - Tokens.paddingHorizontal * 2),
    [containerWidth],
  );

  const handleNameChange = (text: string) => {
    if (nameProp === undefined) {
      setInternalName(text);
    }
    onNameChange?.(text);
  };

  const handleUsernameChange = (text: string) => {
    if (usernameProp === undefined) {
      setInternalUsername(text);
    }
    onUsernameChange?.(text);
  };



  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.modalBackground,
          borderColor: theme.border,
          width: containerWidth,
        },
        style,
      ]}
      testID={testID}
    >
      <View
        style={styles.avatarWrapper}
        testID={`${testID}-avatar-wrapper`}
      >
        <UserAvatar
          name={nameValue}
          size={Tokens.avatarSize}
          radius={Tokens.avatarRadius}
          fontSize={Tokens.initialsFontSize}
          fontWeight={Tokens.initialsFontWeight}
          textColor={Tokens.initialsTextColor}
          testID={`${testID}-avatar`}
          accessibilityLabel={nameValue ? `${nameValue} avatar` : 'User avatar'}
        />
      </View>

      <View
        style={[styles.fieldGroup, { width: fieldWidth }]}
        testID={`${testID}-field-name-group`}
      >
        <Text style={[styles.fieldLabel, { color: theme.textSecondary }]} testID={`${testID}-field-name-label`}>
          Name
        </Text>
        <View
          style={[
            styles.inputBox,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
              width: fieldWidth,
            },
          ]}
          testID={`${testID}-field-name-box`}
        >
          <TextInput
            style={[styles.inputText, { color: theme.text }]}
            value={nameValue}
            onChangeText={handleNameChange}
            placeholder="Enter name"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="words"
            testID={`${testID}-field-name-input`}
          />
        </View>
      </View>



      <Text
        style={[
          styles.helperText,
          { color: theme.textMuted },
          errorMessage ? styles.errorText : null,
        ]}
        testID={errorMessage ? `${testID}-error-text` : `${testID}-helper-text`}
      >
        {errorMessage ?? 'Your name will be used by Joy across chats and voice interactions.'}
      </Text>

      <View style={styles.actionsContainer}>
        <Pressable
          onPress={isSaving ? undefined : onSave}
          disabled={isSaving}
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: theme.buttonPrimaryBackground },
            isSaving && styles.buttonDisabled,
            pressed && !isSaving && styles.buttonPressed,
          ]}
          accessibilityLabel="Save profile"
          accessibilityState={{ disabled: isSaving, busy: isSaving }}
          testID={`${testID}-save-button`}
        >
          {isSaving ? (
            <ActivityIndicator
              color={theme.buttonPrimaryText}
              testID={`${testID}-save-spinner`}
            />
          ) : (
            <Text style={[styles.saveButtonText, { color: theme.buttonPrimaryText }]}>Save profile</Text>
          )}
        </Pressable>

        <Pressable
          onPress={onCancel}
          style={({ pressed }) => [
            styles.cancelButton,
            pressed && styles.buttonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          testID={`${testID}-cancel-button`}
        >
          <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Tokens.borderRadius,
    backgroundColor: Tokens.colors.background,
    borderWidth: Tokens.borderWidth,
    borderColor: Tokens.colors.border,
    overflow: 'hidden',
    paddingTop: Tokens.paddingTop,
    paddingBottom: Tokens.paddingBottom,
    paddingHorizontal: Tokens.paddingHorizontal,
    alignItems: 'center',
    justifyContent: 'flex-start',
    shadowColor: Tokens.shadow.color,
    shadowOffset: Tokens.shadow.offset,
    shadowOpacity: Tokens.shadow.opacity,
    shadowRadius: Tokens.shadow.radius,
    elevation: Tokens.shadow.elevation,
  },
  avatarWrapper: {
    width: Tokens.avatarSize,
    height: Tokens.avatarSize,
    position: 'relative',
    marginBottom: Tokens.avatarMarginBottom,
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: Tokens.cameraBadgeSize,
    height: Tokens.cameraBadgeSize,
    borderRadius: Tokens.cameraBadgeRadius,
    backgroundColor: Tokens.colors.cameraBadgeBackground,
    borderWidth: Tokens.cameraBadgeBorderWidth,
    borderColor: Tokens.colors.cameraBadgeBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIcon: {
    width: Tokens.cameraIconSize,
    height: Tokens.cameraIconSize,
  },
  fieldGroup: {
    height: Tokens.fieldHeight,
    marginBottom: Tokens.fieldMarginBottom,
  },
  fieldLabel: {
    fontSize: Tokens.typography.label.fontSize,
    fontWeight: Tokens.typography.label.fontWeight,
    lineHeight: Tokens.typography.label.lineHeight,
    color: Tokens.colors.label,
    marginLeft: Tokens.labelMarginLeft,
    marginBottom: Tokens.labelMarginBottom,
  },
  inputBox: {
    height: Tokens.inputHeight,
    borderRadius: Tokens.inputRadius,
    borderWidth: Tokens.inputBorderWidth,
    borderColor: Tokens.colors.inputBorder,
    backgroundColor: Tokens.colors.inputBackground,
    paddingHorizontal: Tokens.inputPaddingHorizontal,
    justifyContent: 'center',
  },
  inputText: {
    fontSize: Tokens.typography.input.fontSize,
    fontWeight: Tokens.typography.input.fontWeight,
    lineHeight: Tokens.typography.input.lineHeight,
    color: Tokens.colors.inputText,
    padding: 0,
  },
  helperText: {
    maxWidth: Tokens.helperWidth,
    width: '100%',
    minHeight: 20,
    fontSize: Tokens.typography.helper.fontSize,
    fontWeight: Tokens.typography.helper.fontWeight,
    lineHeight: Tokens.typography.helper.lineHeight,
    color: Tokens.colors.helper,
    textAlign: 'center',
    marginTop: Tokens.helperMarginTop,
    marginBottom: Tokens.helperMarginBottom,
  },
  errorText: {
    color: Tokens.colors.error,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  actionsContainer: {
    alignItems: 'center',
    gap: Tokens.actionsGap,
  },
  saveButton: {
    width: Tokens.saveButtonWidth,
    height: Tokens.saveButtonHeight,
    borderRadius: Tokens.saveButtonRadius,
    backgroundColor: Tokens.colors.saveBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: Tokens.typography.save.fontSize,
    fontWeight: Tokens.typography.save.fontWeight,
    color: Tokens.colors.saveText,
    includeFontPadding: false,
    textAlignVertical: 'center',
    ...Platform.select({
      android: {
        top: -1,
      },
    }),
  },
  cancelButton: {
    width: Tokens.cancelButtonWidth,
    height: Tokens.cancelButtonHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: Tokens.typography.cancel.fontSize,
    fontWeight: Tokens.typography.cancel.fontWeight,
    color: Tokens.colors.cancelText,
    includeFontPadding: false,
    textAlignVertical: 'center',
    ...Platform.select({
      android: {
        top: -1,
      },
    }),
  },
  buttonPressed: {
    opacity: 0.75,
  },
});
