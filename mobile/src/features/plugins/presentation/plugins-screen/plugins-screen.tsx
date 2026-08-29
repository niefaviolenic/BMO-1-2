import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  useWindowDimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/hooks/use-theme";
import { LiquidGlassIconButton } from "@/components/ui/liquid-glass-icon-button";
import { SearchInput } from "@/components/ui/search-input";
import { Spacing } from "@/constants/theme";
import { useSidebarShell } from "@/features/chat/presentation/sidebar-shell";
import { beginSpotifyOAuth } from "@/features/plugins/data/begin-spotify-oauth";
import { refreshPluginCatalog } from "@/features/plugins/data/plugin-catalog-store";
import { disconnectSpotifyIntegration } from "@/features/plugins/data/spotify-session-store";
import {
  installPlugin,
  isPluginInstalled,
  uninstallPlugin,
  useInstalledPlugins,
} from "@/features/plugins/data/use-installed-plugins";
import type { InstalledPlugin } from "@/features/plugins/data/installed-plugins-store";
import { disconnectWhatsAppIntegration } from "@/features/plugins/data/whatsapp-session-store";
import { isBackendPluginId, mapPluginApiError } from "@/features/plugins/domain/plugin";
import { InstalledPluginsRow } from "@/features/plugins/components/installed-plugins-row";
import { PluginBrandLogo } from "@/features/plugins/components/plugin-brand-logo";
import { PluginItemRow } from "@/features/plugins/components/plugin-item-row";
import { PluginUninstallModal } from "@/features/plugins/components/plugin-uninstall-modal";
import { PluginConnectSheet } from "@/features/plugins/components/plugin-connect-sheet";

import {
  FEATURED_PLUGINS,
  PRODUCTIVITY_PLUGINS,
  type PluginItemData,
} from "./plugins-data";

export type PluginsScreenProps = {
  onSettingsPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function PluginsScreen({
  onSettingsPress,
  style,
  testID = "plugins-screen",
}: PluginsScreenProps) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { open, navigate, registerActions } = useSidebarShell();
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingInstallItem, setPendingInstallItem] = useState<PluginItemData | null>(null);
  const [pendingUninstallItem, setPendingUninstallItem] = useState<PluginItemData | null>(null);
  const [operatingPluginId, setOperatingPluginId] = useState<string | null>(null);

  const installedPlugins: InstalledPlugin[] = useInstalledPlugins();
  const isSmallScreen = windowWidth < 360;
  const horizontalPadding = isSmallScreen ? 12 : 16;
  const contentWidth = Math.min(windowWidth - horizontalPadding * 2, 362);

  useFocusEffect(
    useCallback(() => {
      void refreshPluginCatalog();
      return registerActions(
        {
          onNewChat: () => navigate('chat'),
        },
        'plugins'
      );
    }, [registerActions, navigate])
  );

  const installedSet = useMemo(
    () => new Set(installedPlugins.map((plugin) => plugin.id)),
    [installedPlugins]
  );

  const installedPluginsData = useMemo(() => {
    return installedPlugins.map((plugin: InstalledPlugin) => ({
      id: plugin.id,
      name: plugin.name,
      iconComponent: (
        <PluginBrandLogo
          pluginId={plugin.id}
          size={44}
        />
      ),
    }));
  }, [installedPlugins]);
  const handleOpenPluginDetail = useCallback(
    (item: PluginItemData) => {
      router.push({
        pathname: "/plugin-detail",
        params: {
          id: item.id,
          pluginId: item.id,
          title: item.title,
          description: item.description,
          iconBgColor: item.iconBgColor,
          fallbackText: item.fallbackText,
        },
      });
    },
    [router]
  );

  const handlePluginActionPress = useCallback(
    (item: PluginItemData) => {
      if (installedSet.has(item.id) || isPluginInstalled(item.id)) {
        setPendingUninstallItem(item);
      } else {
        setPendingInstallItem(item);
      }
    },
    [installedSet]
  );

  const handleConfirmConnect = useCallback(async () => {
    if (!pendingInstallItem) return;
    const targetItem = pendingInstallItem;
    setPendingInstallItem(null);

    if (targetItem.id === "whatsapp") {
      router.push("/whatsapp-connect");
      return;
    }

    setOperatingPluginId(targetItem.id);
    try {
      if (targetItem.id === "spotify") {
        try {
          const authSuccess = await beginSpotifyOAuth();
          if (!authSuccess) return;
        } catch (error) {
          Alert.alert("Spotify connection failed", mapPluginApiError(error));
          return;
        }
      }

      if (!isBackendPluginId(targetItem.id)) {
        Alert.alert(
          "Superpower unavailable",
          `${targetItem.title} is not supported by the current Joy backend.`
        );
        return;
      }

      try {
        await installPlugin(targetItem.id, targetItem.title);
      } catch (error) {
        Alert.alert("Could not connect superpower", mapPluginApiError(error));
      }
    } finally {
      setOperatingPluginId(null);
    }
  }, [pendingInstallItem, router]);

  const handleConfirmUninstall = useCallback(async () => {
    if (!pendingUninstallItem) return;
    const targetItem = pendingUninstallItem;
    setPendingUninstallItem(null);
    setOperatingPluginId(targetItem.id);

    try {
      if (targetItem.id === "whatsapp") {
        await disconnectWhatsAppIntegration();
      } else if (targetItem.id === "spotify") {
        await disconnectSpotifyIntegration();
      }

      if (isBackendPluginId(targetItem.id)) {
        await uninstallPlugin(targetItem.id);
      }
    } catch (error) {
      Alert.alert("Could not disconnect superpower", mapPluginApiError(error));
    } finally {
      setOperatingPluginId(null);
    }
  }, [pendingUninstallItem]);

  const filterPlugins = useCallback(
    (list: PluginItemData[]) => {
      if (!searchQuery.trim()) return list;
      const lower = searchQuery.toLowerCase();
      return list.filter(
        (p) =>
          p.title.toLowerCase().includes(lower) ||
          p.description.toLowerCase().includes(lower)
      );
    },
    [searchQuery]
  );

  const filteredFeatured = useMemo(
    () => filterPlugins(FEATURED_PLUGINS),
    [filterPlugins]
  );
  const filteredProductivity = useMemo(
    () => filterPlugins(PRODUCTIVITY_PLUGINS),
    [filterPlugins]
  );

  return (
    <View style={[styles.container, style]} testID={testID}>
      <View
        style={[
          styles.screen,
          {
            paddingTop: insets.top,
          },
        ]}
      >
        {/* Header Bar */}
        <View style={[styles.headerBar, { width: contentWidth }]}>
          <LiquidGlassIconButton
            onPress={open}
            size={40}
            accessibilityLabel="Open menu"
            testID={`${testID}-menu-button`}
          >
            <Image
              source={require("@/assets/images/chat/icon-menu.svg")}
              style={styles.menuIcon}
              tintColor={theme.icon}
              contentFit="contain"
              accessibilityLabel="Menu"
            />
          </LiquidGlassIconButton>

          <View style={styles.titleContainer}>
            <Text style={[styles.titleText, { color: theme.text }]} testID={`${testID}-title`}>
              Plugins
            </Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        {/* Search Bar Container */}
        <View style={[styles.searchContainer, { width: contentWidth }]}>
          <SearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search plugins"
            testID={`${testID}-search-input`}
          />
        </View>

        {/* Scrollable Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Installed Plugins Section */}
          {installedPluginsData.length > 0 && !searchQuery.trim() && (
            <View style={styles.installedSection} testID={`${testID}-installed-section`}>
              <View style={[styles.installedSectionHeader, { width: contentWidth }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Installed</Text>
              </View>
              <InstalledPluginsRow
                items={installedPluginsData}
                onPluginPress={(pluginId) => {
                  const matched =
                    FEATURED_PLUGINS.find((p) => p.id === pluginId) ||
                    PRODUCTIVITY_PLUGINS.find((p) => p.id === pluginId) || {
                      id: pluginId,
                      title: pluginId,
                      description: "",
                      category: "featured" as const,
                      iconBgColor: "#D91F26",
                      fallbackText: "PL",
                      actionType: "chevron" as const,
                    };
                  handleOpenPluginDetail(matched);
                }}
                style={{ width: "100%" }}
                contentContainerStyle={{
                  paddingHorizontal: (windowWidth - contentWidth) / 2,
                }}
                testID={`${testID}-installed-row`}
              />
            </View>
          )}

          {/* Featured Section */}
          {filteredFeatured.length > 0 && (
            <View style={[styles.section, { width: contentWidth }]} testID={`${testID}-featured-section`}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Featured</Text>
              </View>
              <View style={styles.pluginList}>
                {filteredFeatured.map((item) => {
                  const installed = installedSet.has(item.id) || isPluginInstalled(item.id);
                  const isLoading = operatingPluginId === item.id;

                  return (
                    <PluginItemRow
                      key={item.id}
                      title={item.title}
                      description={item.description}
                      icon={
                        <PluginBrandLogo
                          pluginId={item.id}
                          size={44}
                        />
                      }
                      actionType={installed ? "trash" : "add"}
                      isLoading={isLoading}
                      onPress={() => handleOpenPluginDetail(item)}
                      onActionPress={() => handlePluginActionPress(item)}
                      testID={`${testID}-item-${item.id}`}
                    />
                  );
                })}
              </View>
            </View>
          )}

          {/* Productivity Section */}
          {filteredProductivity.length > 0 && (
            <View style={[styles.section, { width: contentWidth }]} testID={`${testID}-productivity-section`}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Productivity</Text>
              </View>
              <View style={styles.pluginList}>
                {filteredProductivity.map((item) => {
                  const installed = installedSet.has(item.id) || isPluginInstalled(item.id);
                  const isLoading = operatingPluginId === item.id;

                  return (
                    <PluginItemRow
                      key={item.id}
                      title={item.title}
                      description={item.description}
                      icon={
                        <PluginBrandLogo
                          pluginId={item.id}
                          size={44}
                        />
                      }
                      actionType={installed ? "trash" : "add"}
                      isLoading={isLoading}
                      onPress={() => handleOpenPluginDetail(item)}
                      onActionPress={() => handlePluginActionPress(item)}
                      testID={`${testID}-item-${item.id}`}
                    />
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>
      </View>

      <PluginUninstallModal
        visible={Boolean(pendingUninstallItem)}
        pluginName={pendingUninstallItem?.title ?? "Plugin"}
        onCancel={() => setPendingUninstallItem(null)}
        onConfirm={handleConfirmUninstall}
        testID={`${testID}-uninstall-modal`}
      />

      <PluginConnectSheet
        isVisible={Boolean(pendingInstallItem)}
        onClose={() => setPendingInstallItem(null)}
        pluginTitle={pendingInstallItem?.title ?? "Plugin"}
        pluginLogo={
          pendingInstallItem ? (
            <PluginBrandLogo
              pluginId={pendingInstallItem.id}
              size={56}
            />
          ) : undefined
        }
        onConnect={handleConfirmConnect}
        testID={`${testID}-connect-sheet`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screen: {
    flex: 1,
    alignItems: "center",
  },
  headerBar: {
    width: "100%",
    maxWidth: 362,
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 0,
    marginBottom: 8,
  },
  menuIcon: {
    width: 20,
    height: 20,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  titleText: {
    fontSize: 17,
    fontWeight: "600",
  },
  searchContainer: {
    width: "100%",
    maxWidth: 362,
    marginBottom: Spacing.three,
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
    width: "100%",
  },
  scrollContent: {
    alignItems: "center",
    paddingBottom: 32,
    gap: 22,
  },
  installedSection: {
    width: "100%",
    alignItems: "center",
    gap: 12,
  },
  installedSectionHeader: {
    width: "100%",
    maxWidth: 362,
  },
  section: {
    width: "100%",
    maxWidth: 362,
    gap: 12,
    overflow: "visible",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  pluginList: {
    width: "100%",
    gap: 12,
  },
});
