import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Settings, Share2 } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Animated,
  BackHandler,
  Easing,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { LiquidGlassBackButton } from '@/components/ui/liquid-glass-back-button';
import { LiquidGlassIconButton } from '@/components/ui/liquid-glass-icon-button';
import { PluginsTokens } from '@/constants/theme';
import { beginSpotifyOAuth } from '@/features/plugins/data/begin-spotify-oauth';
import { refreshPluginCatalog } from '@/features/plugins/data/plugin-catalog-store';
import {
  hydrateSpotifySession,
  startSpotifyPlaybackPolling,
  stopSpotifyPlaybackPolling,
  disconnectSpotifyIntegration,
} from '@/features/plugins/data/spotify-session-store';
import {
  installPlugin,
  isPluginInstalled,
  uninstallPlugin,
  useIsPluginInstalled,
} from '@/features/plugins/data/use-installed-plugins';
import { useWhatsAppSession } from '@/features/plugins/data/use-whatsapp-session';
import { disconnectWhatsAppIntegration } from '@/features/plugins/data/whatsapp-session-store';
import { isBackendPluginId, mapPluginApiError } from '@/features/plugins/domain/plugin';
import { formatWhatsAppDisplayNumber } from '@/features/plugins/domain/whatsapp';
import { ConnectedPluginNotificationSettingsSheet } from '@/features/plugins/presentation/notification-settings/connected-plugin-notification-settings-sheet';
import { SpotifyPlayerPanel } from '@/features/plugins/presentation/spotify-player';
import { WhatsAppNotificationPanel } from '@/features/plugins/presentation/whatsapp-panel';
import {
  PluginAppSection,
  PluginBrandLogo,
  PluginConnectSheet,
  PluginDetailHero,
  PluginInfoSection,
  PluginLegalDisclaimer,
  PluginPreviewCardsRow,
  PluginSettingsSheet,
  PluginSkillsSection,
  PluginUninstallModal,
} from '@/features/plugins/components';

export type PluginDetailScreenProps = {
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const DEFAULT_WHATSAPP_SKILLS = [
  { id: 'whatsapp-send-messages', name: 'whatsapp-send-messages' },
  { id: 'whatsapp-read-chat', name: 'whatsapp-read-chat' },
  { id: 'whatsapp-voice-notes', name: 'whatsapp-voice-notes' },
  { id: 'whatsapp-send-media', name: 'whatsapp-send-media' },
  { id: 'whatsapp-automated-replies', name: 'whatsapp-automated-replies' },
  { id: 'whatsapp-manage-groups', name: 'whatsapp-manage-groups' },
];

const DEFAULT_SPOTIFY_SKILLS = [
  { id: 'spotify-play', name: 'spotify-play' },
  { id: 'spotify-pause', name: 'spotify-pause' },
  { id: 'spotify-skip', name: 'spotify-skip' },
  { id: 'spotify-search', name: 'spotify-search' },
];

export function PluginDetailScreen({
  style,
  testID = 'plugin-detail-screen',
}: PluginDetailScreenProps) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const sectionWidth = Math.min(windowWidth - 40, 354);
  const sidePadding = Math.max((windowWidth - sectionWidth) / 2, 20);

  const translateX = React.useRef(new Animated.Value(windowWidth)).current;
  const isDismissingRef = React.useRef(false);

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [translateX]);

  const params = useLocalSearchParams<{
    id?: string;
    pluginId?: string;
    title?: string;
    description?: string;
    iconBgColor?: string;
    fallbackText?: string;
    isInstalled?: string;
  }>();

  const pluginId =
    (Array.isArray(params.id) ? params.id[0] : params.id) ??
    (Array.isArray(params.pluginId) ? params.pluginId[0] : params.pluginId) ??
    'whatsapp';
  const title =
    (Array.isArray(params.title) ? params.title[0] : params.title) ??
    (pluginId === 'whatsapp' ? 'WhatsApp' : pluginId === 'spotify' ? 'Spotify' : pluginId);
  const description =
    (Array.isArray(params.description) ? params.description[0] : params.description) ??
    (pluginId === 'whatsapp'
      ? 'Messaging, voice notes, and media'
      : pluginId === 'spotify'
        ? 'Play music and control playback'
        : 'Integrate and power up your agent workflow.');
  const iconBgColor =
    (Array.isArray(params.iconBgColor) ? params.iconBgColor[0] : params.iconBgColor) ??
    (pluginId === 'spotify' ? PluginsTokens.colors.iconSpotify : '#25D366');
  const fallbackText =
    (Array.isArray(params.fallbackText) ? params.fallbackText[0] : params.fallbackText) ??
    (pluginId === 'spotify' ? 'Sp' : 'WA');
  const isSpotify = pluginId === 'spotify';
  const isWhatsApp = pluginId === 'whatsapp';

  const rawIsInstalled = Array.isArray(params.isInstalled) ? params.isInstalled[0] : params.isInstalled;
  const initialInstalled = rawIsInstalled === 'true' || rawIsInstalled === '1';
  const isInstalled = useIsPluginInstalled(pluginId);
  const whatsAppSession = useWhatsAppSession();
  const showSpotifyPlayer = isSpotify && isInstalled;
  const showWhatsAppPanel = isWhatsApp && isInstalled;
  const [showConnectSheet, setShowConnectSheet] = useState(false);
  const [showUninstallModal, setShowUninstallModal] = useState(false);
  const [isUninstalling, setIsUninstalling] = useState(false);
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);
  const [showNotificationSheet, setShowNotificationSheet] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refreshPluginCatalog().catch(() => undefined);
      if (pluginId !== 'spotify') {
        return;
      }
      void hydrateSpotifySession().catch(() => undefined);
      if (!isInstalled) {
        return;
      }
      startSpotifyPlaybackPolling();
      return () => {
        stopSpotifyPlaybackPolling();
      };
    }, [pluginId, isInstalled]),
  );

  useEffect(() => {
    if (isBackendPluginId(pluginId)) {
      return;
    }
    if (initialInstalled && !isPluginInstalled(pluginId)) {
      installPlugin(pluginId, title);
    }
  }, [initialInstalled, pluginId, title]);

  const handleConnectConfirm = async () => {
    setShowConnectSheet(false);
    if (pluginId === 'whatsapp') {
      router.push('/whatsapp-connect');
      return;
    }
    if (pluginId === 'spotify') {
      try {
        await beginSpotifyOAuth();
        await hydrateSpotifySession().catch(() => undefined);
      } catch (error) {
        Alert.alert('Unable to connect Spotify', mapPluginApiError(error));
      }
      return;
    }
    installPlugin(pluginId, title);
  };

  const handleUninstallConfirm = async () => {
    if (isUninstalling) {
      return;
    }
    if (!isBackendPluginId(pluginId)) {
      setShowUninstallModal(false);
      setShowSettingsSheet(false);
      uninstallPlugin(pluginId);
      return;
    }
    setIsUninstalling(true);
    try {
      if (pluginId === 'whatsapp') {
        await disconnectWhatsAppIntegration();
      } else {
        await disconnectSpotifyIntegration();
      }
      setShowUninstallModal(false);
      setShowSettingsSheet(false);
      handleBack();
    } catch (error) {
      Alert.alert(`Unable to disconnect ${title}`, mapPluginApiError(error));
    } finally {
      setIsUninstalling(false);
    }
  };
  const handleBack = useCallback(() => {
    if (isDismissingRef.current) {
      return;
    }
    isDismissingRef.current = true;
    Animated.timing(translateX, {
      toValue: windowWidth,
      duration: 250,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(main)/plugins');
      }
    });
  }, [router, translateX, windowWidth]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => subscription.remove();
  }, [handleBack]);
  const handleSharePlugin = useCallback(async () => {
    try {
      const shareUrl = `https://myjoy.binerlabs.com/plugins/${pluginId}?open_in_app=true`;
      await Share.share({
        title: `${title} Plugin | Joy`,
        message: `Check out ${title} plugin on Joy: ${shareUrl}`,
        url: shareUrl,
      });
    } catch {
      Alert.alert('Unable to share', 'Please try again later.');
    }
  }, [pluginId, title]);


  const handleBottomCta = () => {
    if (isInstalled) {
      router.replace('/chat');
    } else {
      setShowConnectSheet(true);
    }
  };

  const paddingTop = Math.max(insets.top, 16);
  const paddingBottom = Math.max(insets.bottom, 16);

  const renderLogo = () => {
    if (pluginId === 'whatsapp' || pluginId === 'spotify') {
      return <PluginBrandLogo pluginId={pluginId} size={36} />;
    }
    return (
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          backgroundColor: iconBgColor,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#FFFFFF' }}>
          {fallbackText}
        </Text>
      </View>
    );
  };

  const renderAppIcon = () => {
    if (pluginId === 'whatsapp' || pluginId === 'spotify') {
      return <PluginBrandLogo pluginId={pluginId} size={24} />;
    }
    return (
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          backgroundColor: iconBgColor,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFFFFF' }}>
          {fallbackText}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }, style]} testID={testID}>
      <Animated.View
        style={[
          styles.screen,
          {
            backgroundColor: theme.background,
            paddingTop,
            transform: [{ translateX }],
          },
        ]}
      >
        {/* Header Bar */}
        <View style={styles.headerBar} testID={`${testID}-header`}>
          <LiquidGlassBackButton
            onPress={handleBack}
            testID={`${testID}-back-btn`}
          />

          <Text style={[styles.headerTitle, { color: theme.textTitle }]} numberOfLines={1}>
            {title}
          </Text>

          {isInstalled ? (
            <LiquidGlassIconButton
              onPress={() => setShowSettingsSheet(true)}
              accessibilityLabel="Settings"
              testID={`${testID}-settings-btn`}
            >
              <Settings size={20} color={theme.icon} />
            </LiquidGlassIconButton>
          ) : (
            <LiquidGlassIconButton
              onPress={handleSharePlugin}
              accessibilityLabel="Share"
              testID={`${testID}-share-btn`}
            >
              <Share2 size={20} color={theme.icon} />
            </LiquidGlassIconButton>
          )}
        </View>

        {/* Main Scroll Content */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingLeft: sidePadding,
              paddingRight: sidePadding,
              paddingBottom: paddingBottom + 80,
            },
          ]}
          style={styles.scrollView}
          testID={`${testID}-scroll-view`}
        >
          {/* Hero Section */}
          <PluginDetailHero
            title={title}
            subtitle={description}
            logo={renderLogo()}
            testID={`${testID}-hero`}
          />

          {showSpotifyPlayer ? (
            <SpotifyPlayerPanel testID={`${testID}-spotify-player`} />
          ) : showWhatsAppPanel ? (
            <WhatsAppNotificationPanel testID={`${testID}-whatsapp-panel`} />
          ) : (
            <>
              <PluginPreviewCardsRow
                pluginId={pluginId}
                style={{
                  width: windowWidth,
                  marginHorizontal: -sidePadding,
                }}
                contentContainerStyle={{
                  paddingLeft: sidePadding,
                  paddingRight: sidePadding,
                }}
                testID={`${testID}-preview-cards`}
              />

              <Text style={[styles.aboutDescription, { color: theme.textSecondary }]} testID={`${testID}-about-desc`}>
                {pluginId === 'whatsapp'
                  ? 'WhatsApp unlocks seamless communication directly from your conversation. Easily send messages, share media, manage contacts, and initiate voice calls across your chats.'
                  : pluginId === 'spotify'
                    ? 'Connect Spotify so Joy can play, pause, and skip from this screen or from chat.'
                    : `${title} unlocks seamless integration directly from your conversation. Connect and manage your workflows effortlessly.`}
              </Text>

              <PluginAppSection
                appName={title}
                appIcon={renderAppIcon()}
                testID={`${testID}-app-section`}
              />

              <PluginSkillsSection
                skills={
                  pluginId === 'whatsapp'
                    ? DEFAULT_WHATSAPP_SKILLS
                    : pluginId === 'spotify'
                      ? DEFAULT_SPOTIFY_SKILLS
                      : [
                          { id: `${pluginId}-action-1`, name: `${pluginId}-action-1` },
                          { id: `${pluginId}-action-2`, name: `${pluginId}-action-2` },
                        ]
                }
                testID={`${testID}-skills-section`}
              />

              <PluginInfoSection
                developer={
                  pluginId === 'whatsapp'
                    ? 'WhatsApp LLC'
                    : pluginId === 'spotify'
                      ? 'Spotify AB'
                      : `${title} Inc.`
                }
                category={pluginId === 'whatsapp' ? 'Communication' : pluginId === 'spotify' ? 'Music' : 'Productivity'}
                testID={`${testID}-info-section`}
              />

              <PluginLegalDisclaimer
                appName={title}
                testID={`${testID}-legal-disclaimer`}
              />
            </>
          )}
        </ScrollView>

        {/* Floating Action Container */}
        <View
          style={[
            styles.floatingActionContainer,
            {
              backgroundColor: theme.background,
              borderTopColor: theme.border,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
          testID={`${testID}-floating-cta`}
        >
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.text },
              pressed && styles.primaryButtonPressed,
            ]}
            onPress={handleBottomCta}
            accessibilityRole="button"
            accessibilityLabel={isInstalled ? 'Try in chat' : 'Install plugin'}
            testID={`${testID}-cta-button`}
          >
            <Text style={[styles.primaryButtonText, { color: theme.background }]}>
              {isInstalled ? 'Try in chat' : 'Install plugin'}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
      {/* Settings Sheet Modal */}
      <PluginSettingsSheet
        isVisible={showSettingsSheet && !showNotificationSheet}
        onClose={() => setShowSettingsSheet(false)}
        pluginTitle={title}
        pluginSubtitle={
          pluginId === 'whatsapp'
            ? whatsAppSession.connection?.phoneNumber
              ? `Connected to ${formatWhatsAppDisplayNumber(whatsAppSession.connection.phoneNumber)}`
              : 'Connected to WhatsApp'
            : pluginId === 'spotify'
              ? 'Connected to Spotify'
              : 'Connected'
        }
        pluginLogo={renderLogo()}
        skills={isSpotify ? DEFAULT_SPOTIFY_SKILLS : DEFAULT_WHATSAPP_SKILLS}
        readActions={
          isSpotify
            ? [
                { id: 'playback-state', name: 'Get current playback' },
                { id: 'search-catalog', name: 'Search tracks and playlists' },
              ]
            : undefined
        }
        onReadActionPress={(id) => {
          if (id === 'fetch-notifications') {
            setShowSettingsSheet(false);
            setTimeout(() => {
              setShowNotificationSheet(true);
            }, 200);
          }
        }}
        dropdownItems={
          isSpotify
            ? [
                {
                  id: 'reconnect',
                  label: 'Reconnect',
                  iconName: 'refresh-cw',
                  onPress: () => {
                    setShowSettingsSheet(false);
                    void beginSpotifyOAuth().catch((error) => {
                      Alert.alert('Unable to reconnect Spotify', mapPluginApiError(error));
                    });
                  },
                },
                {
                  id: 'uninstall',
                  label: 'Uninstall',
                  iconName: 'circle-minus',
                  isDestructive: true,
                  showDivider: true,
                  onPress: () => {
                    setShowSettingsSheet(false);
                    setShowUninstallModal(true);
                  },
                },
              ]
            : undefined
        }
        onUninstallPress={() => {
          setShowSettingsSheet(false);
          setShowUninstallModal(true);
        }}
        onMorePress={() => {
          setShowSettingsSheet(false);
          setShowUninstallModal(true);
        }}
        testID={`${testID}-settings-sheet`}
      />

      {/* Joy Robot Notification Settings Sheet */}
      <ConnectedPluginNotificationSettingsSheet
        isVisible={showNotificationSheet}
        onClose={() => setShowNotificationSheet(false)}
        pluginTitle={title}
        testID={`${testID}-notification-settings-sheet`}
      />
      {/* Connect Sheet Modal */}
      <PluginConnectSheet
        isVisible={showConnectSheet}
        pluginTitle={title}
        pluginLogo={renderLogo()}
        onClose={() => setShowConnectSheet(false)}
        onConnect={handleConnectConfirm}
        testID={`${testID}-connect-sheet`}
      />

      {/* Uninstall Modal */}
      <PluginUninstallModal
        visible={showUninstallModal}
        pluginName={title}
        isBusy={isUninstalling}
        onConfirm={handleUninstallConfirm}
        onCancel={() => {
          if (!isUninstalling) {
            setShowUninstallModal(false);
          }
        }}
        testID={`${testID}-uninstall-modal`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  screen: {
    flex: 1,
    width: '100%',
    backgroundColor: PluginsTokens.colors.background,
    alignItems: 'center',
  },
  headerBar: {
    width: '100%',
    maxWidth: 362,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0F1729',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    alignItems: 'center',
    gap: 22,
  },
  aboutDescription: {
    width: '100%',
    maxWidth: 354,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    color: PluginsTokens.colors.textSecondary,
  },
  floatingActionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F3',
  },
  primaryButton: {
    width: 354,
    height: 52,
    borderRadius: 999,
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonPressed: {
    opacity: 0.8,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
