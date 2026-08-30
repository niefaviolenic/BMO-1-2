import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import {
  ArrowUpRight,
  Bluetooth,
  Ellipsis,
  ShoppingBag,
} from 'lucide-react-native';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { AnimatedDropdownOverlay } from '@/components/ui/animated-dropdown-overlay';
import { DropdownMenu, type DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { LiquidGlassIconButton } from '@/components/ui/liquid-glass-icon-button';
import { RobotScreenTokens as Tokens } from '@/constants/theme';
import { useSidebarShell } from '@/features/chat/presentation/sidebar-shell';
import {
  hydrateDevices,
  unpairActive,
  useRobotConnection,
} from '@/features/robot/data/use-robot-connection';
import { mapDeviceApiError } from '@/features/robot/domain/robot-connection';
import {
  ConnectedRobotHeroCard,
  RobotDisconnectModal,
  RobotHeroCard,
  RobotOptionCard,
  RobotWifiCard,
  WifiSwitcherSheet,
} from '@/features/robot/components';
import { getDeviceWifi, type DeviceWifi } from '@/features/robot/data/device-api';
import { RobotPairSheet } from '@/features/robot/presentation/robot-pair-sheet';

export type RobotScreenProps = {
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function RobotScreen({
  style,
  testID = 'robot-screen',
}: RobotScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { open, navigate, registerActions } = useSidebarShell();
  const connection = useRobotConnection();
  const isConnected = connection.status === 'connected';

  const sectionWidth = Math.min(
    windowWidth - Tokens.layout.horizontalPadding * 2,
    Tokens.layout.sectionWidth
  );
  const sidePadding = Math.max(
    (windowWidth - sectionWidth) / 2,
    Tokens.layout.horizontalPadding
  );

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [showPairSheet, setShowPairSheet] = useState(false);
  const [showWifiSwitcher, setShowWifiSwitcher] = useState(false);
  const [wifiData, setWifiData] = useState<DeviceWifi | null>(null);
  const pendingMenuActionRef = useRef<'disconnect' | null>(null);

  useFocusEffect(
    useCallback(() => {
      void hydrateDevices();
      return registerActions(
        {
          onNewChat: () => navigate('chat'),
        },
        'robot'
      );
    }, [registerActions, navigate])
  );
  useEffect(() => {
    if (isConnected && connection.device?.id) {
      void getDeviceWifi(connection.device.id)
        .then((wifi) => {
          if (wifi) setWifiData(wifi);
        })
        .catch(() => {});
    }
  }, [isConnected, connection.device?.id]);

  useEffect(() => {
    if (!isConnected) {
      setIsDropdownOpen(false);
      setShowDisconnectModal(false);
      pendingMenuActionRef.current = null;
    }
  }, [isConnected]);

  useEffect(() => {
    if (isDropdownOpen || !pendingMenuActionRef.current) {
      return;
    }
    const action = pendingMenuActionRef.current;
    pendingMenuActionRef.current = null;
    if (action === 'disconnect') {
      setShowDisconnectModal(true);
    }
  }, [isDropdownOpen]);

  const dropdownItems: DropdownMenuItem[] = [
    {
      id: 'disconnect',
      label: 'Disconnect',
      iconName: 'circle-minus',
      isDestructive: true,
      onPress: () => {
        pendingMenuActionRef.current = 'disconnect';
        setIsDropdownOpen(false);
      },
      showDivider: false,
    },
  ];

  return (
    <View style={[styles.root, { paddingTop: insets.top }, style]} testID={testID}>
      {/* Header Bar */}
      <View
        style={[
          styles.header,
          {
            paddingHorizontal: sidePadding,
            height: Tokens.layout.headerHeight,
          },
        ]}
      >
        <LiquidGlassIconButton
          onPress={open}
          size={40}
          accessibilityLabel="Open menu"
          testID={`${testID}-menu-button`}
        >
          <Image
            source={require('@/assets/images/chat/icon-menu.svg')}
            style={styles.menuIcon}
            tintColor={theme.icon}
            contentFit="contain"
            accessibilityLabel="Menu"
          />
        </LiquidGlassIconButton>

        <Text style={[styles.headerTitle, { color: theme.text }]} testID={`${testID}-title`}>
          Joy Robot
        </Text>

        {isConnected ? (
          <LiquidGlassIconButton
            onPress={() => setIsDropdownOpen((prev) => !prev)}
            size={40}
            accessibilityLabel="Robot Options"
            testID={`${testID}-more-button`}
          >
            <Ellipsis size={20} color={theme.icon} />
          </LiquidGlassIconButton>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {/* Main Content Area */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: sidePadding,
            paddingBottom: insets.bottom + 24,
            alignItems: 'center',
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isConnected ? (
          <>
            <ConnectedRobotHeroCard
              title={`${connection.device?.name ?? 'Joy Robot'} Connected!`}
              status="Online"
              batteryLevel={
                connection.device?.batteryPercent !== null && connection.device?.batteryPercent !== undefined
                  ? `${connection.device.batteryPercent}%`
                  : '85%'
              }
              showStatusBadge={false}
              style={{ width: sectionWidth }}
              testID={`${testID}-connected-hero-card`}
            />

            <View style={styles.section} testID={`${testID}-connected-options-section`}>
              <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Network Management</Text>
              <RobotWifiCard
                ssid={wifiData?.ssid ?? 'Home-WiFi-5G'}
                status={wifiData?.status ?? 'CONNECTED'}
                onPress={() => setShowWifiSwitcher(true)}
                style={{ width: sectionWidth }}
                testID={`${testID}-wifi-card`}
              />

              <Text style={[styles.sectionTitle, { color: theme.textMuted, marginTop: 12 }]}>Joy Store</Text>
              <RobotOptionCard
                title="I Don't Have a Joy Robot Yet"
                description="Explore physical Joy models & stock"
                leftIcon={
                  <ShoppingBag
                    size={20}
                    color={theme.icon}
                    strokeWidth={1.75}
                  />
                }
                trailingIcon={
                  <ArrowUpRight
                    size={16}
                    color={theme.textMuted}
                    strokeWidth={1.5}
                  />
                }
                style={{ width: sectionWidth }}
                testID={`${testID}-buy-robot-card`}
              />
            </View>
          </>
        ) : (
          <>
            <RobotHeroCard
              style={{ width: sectionWidth }}
              testID={`${testID}-hero-card`}
            />

            <View style={styles.section} testID={`${testID}-connection-section`}>
              <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Connect Options</Text>
              <RobotOptionCard
                title="I Already Have a Joy Robot"
                description="Pair via Bluetooth BLE"
                leftIcon={
                  <Bluetooth
                    size={20}
                    color={theme.icon}
                    strokeWidth={1.75}
                  />
                }
                onPress={() => setShowPairSheet(true)}
                style={{ width: sectionWidth }}
                testID={`${testID}-have-robot-card`}
              />
              <RobotOptionCard
                title="I Don't Have a Joy Robot Yet"
                description="Explore physical Joy models & stock"
                leftIcon={
                  <ShoppingBag
                    size={20}
                    color={theme.icon}
                    strokeWidth={1.75}
                  />
                }
                trailingIcon={
                  <ArrowUpRight
                    size={16}
                    color={theme.textMuted}
                    strokeWidth={1.5}
                  />
                }
                style={{ width: sectionWidth }}
                testID={`${testID}-buy-robot-card`}
              />
            </View>
          </>
        )}
      </ScrollView>

      {isConnected ? (
        <AnimatedDropdownOverlay
          isOpen={isDropdownOpen}
          onClose={() => setIsDropdownOpen(false)}
          backdropStyle={styles.dropdownBackdrop}
          containerStyle={[
            styles.dropdownWrapper,
            {
              top: insets.top + Tokens.layout.headerHeight + Tokens.layout.dropdownGap,
              paddingHorizontal: sidePadding,
            },
          ]}
          testID={`${testID}-dropdown-overlay`}
        >
          <DropdownMenu items={dropdownItems} testID={`${testID}-dropdown-menu`} />
        </AnimatedDropdownOverlay>
      ) : null}

      <RobotDisconnectModal
        visible={showDisconnectModal}
        onCancel={() => setShowDisconnectModal(false)}
        onConfirm={() => {
          void unpairActive().catch((error) => {
            Alert.alert('Could not disconnect', mapDeviceApiError(error));
          });
          setShowDisconnectModal(false);
        }}
        testID={`${testID}-disconnect-modal`}
      />

      <RobotPairSheet
        isVisible={showPairSheet}
        onClose={() => setShowPairSheet(false)}
        testID={`${testID}-pair-sheet`}
      />
      {connection.device?.id ? (
        <WifiSwitcherSheet
          visible={showWifiSwitcher}
          deviceId={connection.device.id}
          currentSsid={wifiData?.ssid ?? 'Home-WiFi-5G'}
          onClose={() => setShowWifiSwitcher(false)}
          onSuccess={(newSsid) => {
            setWifiData({
              ssid: newSsid,
              status: 'CONNECTED',
            });
          }}
          testID={`${testID}-wifi-switcher-sheet`}
        />
      ) : null}

    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: Tokens.headerTitle.fontSize,
    fontWeight: Tokens.headerTitle.fontWeight,
    lineHeight: Tokens.headerTitle.lineHeight,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  menuIcon: {
    width: 20,
    height: 20,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: Tokens.layout.contentGap,
    paddingTop: 12,
  },
  section: {
    gap: Tokens.layout.sectionGap,
    width: '100%',
  },
  sectionTitle: {
    paddingLeft: Tokens.layout.sectionTitlePaddingLeft,
    fontSize: Tokens.sectionTitle.fontSize,
    fontWeight: Tokens.sectionTitle.fontWeight,
    lineHeight: Tokens.sectionTitle.lineHeight,
  },
  dropdownBackdrop: {
    backgroundColor: 'transparent',
  },
  dropdownWrapper: {
    position: 'absolute',
    right: 0,
    padding: 0,
    zIndex: 1000,
  },
});
