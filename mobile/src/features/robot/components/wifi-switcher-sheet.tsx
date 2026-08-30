import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Wifi, X, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react-native';
import { useTheme } from '@/hooks/use-theme';
import { RobotTokens } from '@/constants/theme';
import { updateDeviceWifi } from '../data/device-api';
import {
  subscribeMobileWebSocket,
  isWifiConfigurationStatusEvent,
  type WifiConfigurationStatusEvent,
} from '@/lib/api/mobile-websocket';

export interface WifiSwitcherSheetProps {
  visible: boolean;
  deviceId: string;
  currentSsid?: string;
  onClose: () => void;
  onSuccess?: (newSsid: string) => void;
  testID?: string;
}

export type SwitchStatus =
  | 'idle'
  | 'submitting'
  | 'delivered'
  | 'applying'
  | 'connected'
  | 'rolled_back'
  | 'error';

export function WifiSwitcherSheet({
  visible,
  deviceId,
  currentSsid = 'Home-WiFi-5G',
  onClose,
  onSuccess,
  testID = 'wifi-switcher-sheet',
}: WifiSwitcherSheetProps) {
  const theme = useTheme();

  const [newSsid, setNewSsid] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<SwitchStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) {
      setNewSsid('');
      setPassword('');
      setStatus('idle');
      setStatusMessage('');
      setIsSubmitting(false);
      return;
    }

    // Subscribe to live WebSocket wifi status events
    const unsubscribe = subscribeMobileWebSocket((event) => {
      if (isWifiConfigurationStatusEvent(event) && event.deviceId === deviceId) {
        const wsEvent = event as WifiConfigurationStatusEvent;
        switch (wsEvent.status) {
          case 'PENDING':
            setStatus('submitting');
            setStatusMessage('Dispatching Wi-Fi credentials to robot...');
            break;
          case 'DELIVERED':
            setStatus('delivered');
            setStatusMessage('Robot received configuration. Initiating connection...');
            break;
          case 'APPLYING':
            setStatus('applying');
            setStatusMessage('Testing connection to new Wi-Fi network (15s watchdog)...');
            break;
          case 'CONNECTED':
            setStatus('connected');
            setStatusMessage('Successfully connected to new Wi-Fi!');
            setIsSubmitting(false);
            if (onSuccess && newSsid) {
              onSuccess(newSsid);
            }
            break;
          case 'ROLLED_BACK':
            setStatus('rolled_back');
            setStatusMessage(
              `Connection to new Wi-Fi failed. Robot safely restored connection to previous Wi-Fi (${currentSsid}).`
            );
            setIsSubmitting(false);
            break;
          case 'FAILED':
            setStatus('error');
            setStatusMessage('Failed to apply Wi-Fi configuration.');
            setIsSubmitting(false);
            break;
          default:
            break;
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [visible, deviceId, currentSsid, newSsid, onSuccess]);

  const handleSubmit = async () => {
    if (!newSsid.trim()) return;

    setIsSubmitting(true);
    setStatus('submitting');
    setStatusMessage('Sending change request to Cloud...');

    try {
      await updateDeviceWifi(deviceId, {
        ssid: newSsid.trim(),
        password: password.trim() ? password.trim() : undefined,
      });
      setStatus('applying');
      setStatusMessage('Configuration accepted. Awaiting device switch response...');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not request Wi-Fi change';
      setStatus('error');
      setStatusMessage(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconPill, { backgroundColor: theme.cardBackgroundSubtle }]}>
                <Wifi size={18} color={theme.accentPrimary} strokeWidth={2} />
              </View>
              <Text style={[styles.headerTitle, { color: theme.text }]}>Change Wi-Fi Network</Text>
            </View>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close sheet"
            >
              <X size={20} color={theme.textMuted} />
            </Pressable>
          </View>

          {/* Current Active Wi-Fi Info */}
          <View
            style={[
              styles.currentWifiBox,
              { backgroundColor: theme.cardBackgroundSubtle, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.currentWifiLabel, { color: theme.textMuted }]}>
              Current Active Network
            </Text>
            <Text style={[styles.currentWifiValue, { color: theme.text }]}>{currentSsid}</Text>
          </View>

          {/* Live Status Banner */}
          {status !== 'idle' ? (
            <View
              style={[
                styles.statusBanner,
                {
                  backgroundColor:
                    status === 'connected'
                      ? 'rgba(34, 197, 94, 0.12)'
                      : status === 'rolled_back' || status === 'error'
                      ? 'rgba(239, 68, 68, 0.12)'
                      : 'rgba(59, 130, 246, 0.12)',
                  borderColor:
                    status === 'connected'
                      ? 'rgba(34, 197, 94, 0.3)'
                      : status === 'rolled_back' || status === 'error'
                      ? 'rgba(239, 68, 68, 0.3)'
                      : 'rgba(59, 130, 246, 0.3)',
                },
              ]}
              testID={`${testID}-status-banner`}
            >
              {status === 'connected' ? (
                <CheckCircle2 size={20} color="#22C55E" />
              ) : status === 'rolled_back' || status === 'error' ? (
                <AlertTriangle size={20} color="#EF4444" />
              ) : (
                <ActivityIndicator size="small" color={theme.accentPrimary} />
              )}
              <Text
                style={[
                  styles.statusBannerText,
                  {
                    color:
                      status === 'connected'
                        ? '#22C55E'
                        : status === 'rolled_back' || status === 'error'
                        ? '#EF4444'
                        : theme.accentPrimary,
                  },
                ]}
              >
                {statusMessage}
              </Text>
            </View>
          ) : null}

          {/* Form Fields */}
          {status !== 'connected' ? (
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>New Wi-Fi SSID</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.cardBackgroundSubtle,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  placeholder="e.g. Office-Mesh-2.4G"
                  placeholderTextColor={theme.textMuted}
                  value={newSsid}
                  onChangeText={setNewSsid}
                  editable={!isSubmitting}
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID={`${testID}-ssid-input`}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  Password (optional for open networks)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.cardBackgroundSubtle,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  placeholder="Enter Wi-Fi password"
                  placeholderTextColor={theme.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  editable={!isSubmitting}
                  secureTextEntry
                  autoCapitalize="none"
                  testID={`${testID}-password-input`}
                />
              </View>

              {/* Submit Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.submitButton,
                  {
                    backgroundColor: theme.accentPrimary,
                    opacity: !newSsid.trim() || isSubmitting ? 0.6 : pressed ? 0.9 : 1,
                  },
                ]}
                onPress={handleSubmit}
                disabled={!newSsid.trim() || isSubmitting}
                testID={`${testID}-submit-button`}
                accessibilityRole="button"
                accessibilityLabel="Apply new Wi-Fi network"
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Text style={styles.submitButtonText}>Switch Wi-Fi Network</Text>
                    <ArrowRight size={18} color="#FFFFFF" strokeWidth={2} />
                  </>
                )}
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                { backgroundColor: theme.accentPrimary, opacity: pressed ? 0.9 : 1 },
              ]}
              onPress={onClose}
              testID={`${testID}-done-button`}
            >
              <Text style={styles.submitButtonText}>Done</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: RobotTokens.optionCard.padding,
    paddingBottom: 40,
    gap: RobotTokens.optionCard.gap,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconPill: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  pressed: {
    opacity: 0.7,
  },
  currentWifiBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 2,
  },
  currentWifiLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  currentWifiValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  statusBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  submitButton: {
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
