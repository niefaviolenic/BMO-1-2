import { CheckPhoneContent } from '@/features/auth/presentation/auth-screen/components/check-phone-sheet';
import {
  BugReportTextareaCard,
  BugReportTogglesCard,
  PersonalizationPickerDropdown,
  PersonalizationSheet,
  ProfileHeaderBlock,
  ProfileHeroStatsHeader,
  ScreenshotUploadContainer,
  SettingsChatGPTSection,
} from "@/features/settings/components";
import { MemorySheet } from "@/features/settings/presentation/memory-sheet/memory-sheet";
import { RobotDeviceStatusCard } from "@/features/robot/components";
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Global UI Components
import { ChatComposer } from '@/components/ui/chat-composer';
import { HeaderActionsButton } from '@/components/ui/header-actions-button';
import { LiquidGlassBackButton } from '@/components/ui/liquid-glass-back-button';
import { UnreadBadge } from '@/components/ui/unread-badge';
import { HeaderBar } from '@/components/ui/header-bar';
import { QuestionCardSheet } from '@/components/ui/question-card-sheet';
import { SearchInput } from '@/components/ui/search-input';
import { CameraViewfinderBox } from '@/components/ui/camera-viewfinder-box';
import { DropdownMenu } from '@/components/ui/dropdown-menu';

// Chat Feature Components
import { TemporaryChatDeclaration } from '@/features/chat/components/temporary-chat-declaration';
import { UserMessageBubble } from '@/features/chat/components/user-message-bubble';
import { HeroPmoCard } from '@/features/chat/components/hero-pmo-card';
import { WeeklyActivityStrip, SegmentedFilterPills, HistoryScreenShell } from '@/features/history';
import { ScheduleEditPill } from '@/features/chat/components/schedule-edit-pill';
import { MessageActionBar } from '@/features/chat/components/message-action-bar';

// Plugins Feature Components
import { InstalledPluginsRow } from '@/features/plugins/components/installed-plugins-row';
import { PluginItemRow } from '@/features/plugins/components/plugin-item-row';
import { PluginConnectLogosRow } from '@/features/plugins/components/plugin-connect-logos-row';
import { PluginPolicyContainer } from '@/features/plugins/components/plugin-policy-container';
import { PluginDetailHero } from '@/features/plugins/components/plugin-detail-hero';
import { PluginPreviewCardsRow } from '@/features/plugins/components/plugin-preview-cards-row';
import { PluginAppSection } from '@/features/plugins/components/plugin-app-section';
import { PluginLegalDisclaimer } from '@/features/plugins/components/plugin-legal-disclaimer';
import { PluginConnectedAccountCard } from '@/features/plugins/components/plugin-connected-account-card';
import { PluginSkillsSection } from '@/features/plugins/components/plugin-skills-section';
import { PluginReadActionsSection } from '@/features/plugins/components/plugin-read-actions-section';
import { PluginPermissionsCard } from '@/features/plugins/components/plugin-permissions-card';
import { PluginUninstallModal } from '@/features/plugins/components/plugin-uninstall-modal';
import {
  PluginNotificationSettingsSheet,
  type NotificationContact,
} from '@/features/plugins/components/plugin-notification-settings-sheet';
import { SpotifyNowPlayingCard, SpotifySearchResults } from '@/features/plugins/presentation/spotify-player';
// Local Screen Components: WhatsApp Pairing Flow
import {
  PhoneNumberInputCard,
  PairingInstructionsCard,
  PairingCodeHero,
  PairingCodeDisplayBox,
  QRPairingHero,
  QRCodeDisplayBox,
  PairingSuccessHero,
  ActiveJoyCapabilitiesCard,
} from '@/features/plugins/presentation/whatsapp-pairing/components';

// Local Screen Components: Joy Robot Notification Settings
import {
  EnableIntegrationCard,
  NotificationModeCard,
  AllowedContactRow,
  AddAllowedContactRow,
  DeviceContactPickerSheet,
  DeviceContactItemRow,
  ContactPickerSearchBar,
} from '@/features/plugins/presentation/notification-settings/components';


// New Global & Schedule Feature Components (15 Figma Links)
import { FilterIconButton, CheckmarkButton } from "@/components/ui";
import {
  ScheduleHydrationCard,
  ScheduleMorningCard,
  ScheduleMonitoringCard,
  ScheduleWeeklyCard,
  SchedulePausedCard,
  ScheduleCompletedCard,
  ScheduleFilterDropdown,
  ScheduleContextMenu,
  SchedulePromptField,
  ScheduleRepeatField,
  ScheduleTimeField,
  ScheduleFrequencyField,
  ScheduleDaysSelectionField,
  ScheduleDateField,
} from "@/features/schedules/components";

export default function ShowcaseRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [composerText, setComposerText] = useState('');
  const [streakDays, setStreakDays] = useState(7);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('812 3456 7890');
  const [isQuestionSheetVisible, setIsQuestionSheetVisible] = useState(false);
  const [isUninstallModalVisible, setIsUninstallModalVisible] = useState(false);
  const [enableRobotNotif, setEnableRobotNotif] = useState(true);
  const [notifMode, setNotifMode] = useState<'selected' | 'all'>('selected');
  const [selectedFilter, setSelectedFilter] = useState<"Active" | "Paused" | "Completed">("Active");
  const [selectedDays, setSelectedDays] = useState<any[]>(["Thursday"]);
  const [isPersonalizationSheetVisible, setIsPersonalizationSheetVisible] = useState(false);
  const [isMemorySheetVisible, setIsMemorySheetVisible] = useState(false);
  const [isContactPickerVisible, setIsContactPickerVisible] = useState(false);
  const [isNotificationSheetVisible, setIsNotificationSheetVisible] = useState(false);
  const [showcaseContacts, setShowcaseContacts] = useState<NotificationContact[]>([
    {
      id: '1',
      name: 'Cenna Wijaya',
      phoneNumber: '+62 812-3456-7890',
      avatarColor: '#33B280',
      notifyVoiceEnabled: true,
    },
    {
      id: '2',
      name: 'Mama',
      phoneNumber: '+62 811-9876-5432',
      avatarColor: '#E56666',
      notifyVoiceEnabled: true,
    },
    {
      id: '3',
      name: 'Bos Kantor',
      phoneNumber: '+62 813-1122-3344',
      avatarColor: '#4D99E5',
      notifyVoiceEnabled: false,
    },
  ]);
  const [showcaseTone, setShowcaseTone] = useState('default');

  const handleAction = useCallback((actionMessage: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${actionMessage}`;
    setLastAction(logEntry);
  }, []);
  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [router]);

  const paddingTop = Math.max(insets.top + 12, 44);
  const paddingBottom = Math.max(insets.bottom + 24, 34);

  return (
    <View style={styles.screen} testID="showcase-screen">
      <StatusBar style="dark" />

      {/* Top Header Bar */}
      <View style={[styles.headerBar, { paddingTop }]}>
        <View style={styles.headerLeft}>
          <LiquidGlassBackButton onPress={handleBack} testID="showcase-back-button" />
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Component Showcase</Text>
          <Text style={styles.headerSubtitle}>41 Sliced UI Components</Text>
        </View>
        <View style={styles.headerRight}>
          {lastAction ? (
            <Pressable
              onPress={() => setLastAction(null)}
              style={({ pressed }) => [
                styles.clearButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.clearButtonText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Interaction Log Banner */}
        <View style={styles.logCard}>
          <Text style={styles.logCardTitle}>Interaction Feedback</Text>
          <Text style={styles.logCardDescription}>
            {lastAction
              ? lastAction
              : 'Tap any component below to test interactions across all 26 components.'}
          </Text>
        </View>

        {/* SECTION 1: GLOBAL UI COMPONENTS */}
        <View style={styles.section}>
          {/* RobotDeviceStatusCard */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>RobotDeviceStatusCard</Text>
              <Text style={styles.componentPath}>src/features/robot/components/robot-device-status-card.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <RobotDeviceStatusCard
                name="Joy Robot"
                status="Paired & Ready"
              />
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>1. Global UI Components</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Global Scope</Text>
            </View>
          </View>


          {/* CameraViewfinderBox */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>CameraViewfinderBox</Text>
              <Text style={styles.componentPath}>src/components/ui/camera-viewfinder-box.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <CameraViewfinderBox
                onPressFlashlight={() => handleAction("CameraViewfinderBox: Flashlight toggled")}
              />
            </View>
          </View>

          {/* SearchInput */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>SearchInput</Text>
              <Text style={styles.componentPath}>src/components/ui/search-input.tsx</Text>
            </View>
            <SearchInput
              value={searchText}
              onChangeText={(text) => {
                setSearchText(text);
                handleAction(`SearchInput: "${text}"`);
              }}
              placeholder="Search plugins..."
            />
          </View>

          {/* DropdownMenu */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>DropdownMenu</Text>
              <Text style={styles.componentPath}>src/components/ui/dropdown-menu.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <DropdownMenu
                items={[
                  { id: '1', label: 'Reconnect', iconName: 'refresh-cw', onPress: () => handleAction('Dropdown: Reconnect') },
                  { id: '2', label: 'Joy Robot Notifications', iconName: 'bell', onPress: () => handleAction('Dropdown: Notifications') },
                  { id: '3', label: 'Uninstall', iconName: 'circle-minus', isDestructive: true, showDivider: true, onPress: () => setIsUninstallModalVisible(true) },
                ]}
              />
            </View>
          </View>

          {/* HeaderBar */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>HeaderBar</Text>
              <Text style={styles.componentPath}>src/components/ui/header-bar.tsx</Text>
            </View>
            <HeaderBar
              title="Plugins & Integrations"
              onBackPress={() => handleAction('HeaderBar: Back')}
              onMorePress={() => handleAction('HeaderBar: More')}
            />
          </View>

          {/* ChatComposer */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>ChatComposer</Text>
              <Text style={styles.componentPath}>src/components/ui/chat-composer.tsx</Text>
            </View>
            <ChatComposer
              value={composerText}
              onChangeText={setComposerText}
              onSubmit={() => handleAction(`Composer submit: "${composerText}"`)}
              placeholder="Ask Joy anything..."
            />
          </View>

          {/* WeeklyActivityStrip & History Screen Shell */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>WeeklyActivityStrip & History Shell</Text>
              <Text style={styles.componentPath}>src/features/history/components/weekly-activity-strip.tsx</Text>
            </View>
            <View style={{ gap: 12 }}>
              <WeeklyActivityStrip />
              <SegmentedFilterPills />
            </View>
          </View>

          {/* HeroPmoCard - 11 Gen Alpha Brainrot Badge Tiers */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>HeroPmoCard (11 Gen Alpha Tiers)</Text>
              <Text style={styles.componentPath}>src/features/chat/components/hero-pmo-card.tsx</Text>
            </View>
            <View style={{ gap: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#475569", marginTop: 4 }}>Mode: Recovery Hero (Figma 154:3934)</Text>
              <HeroPmoCard mode="recovery-hero" daysStreak={14} bestStreak={21} winRatePercentage={85} />
              
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#475569", marginTop: 8 }}>Mode: Milestone Badge (Dynamic Tier)</Text>
              <HeroPmoCard mode="milestone-badge" daysStreak={streakDays} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                {[
                  { days: 0, label: '0d 🤡' },
                  { days: 1, label: '1d 🌾' },
                  { days: 3, label: '3d 🧏' },
                  { days: 7, label: '7d 🗿' },
                  { days: 15, label: '15d ✨' },
                  { days: 30, label: '30d 💪' },
                  { days: 60, label: '60d 🔮' },
                  { days: 90, label: '90d 🪐' },
                  { days: 180, label: '180d 🐺' },
                  { days: 270, label: '270d 🌌' },
                  { days: 365, label: '365d 🐐' },
                ].map((item) => (
                  <Pressable
                    key={item.days}
                    onPress={() => setStreakDays(item.days)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 100,
                      backgroundColor: streakDays === item.days ? '#0F172A' : '#F1F5F9',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: streakDays === item.days ? '#FFFFFF' : '#475569',
                      }}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* UnreadBadge & HeaderActions */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>UnreadBadge & HeaderActionsButton</Text>
              <Text style={styles.componentPath}>src/components/ui/</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <UnreadBadge count={1} />
                <UnreadBadge count={99} />
              </View>
              <HeaderActionsButton
                onPressEdit={() => handleAction('HeaderActions: Edit')}
                onPressMore={() => handleAction('HeaderActions: More')}
              />
            </View>
          </View>
        </View>

        {/* SECTION 2: PLUGINS CATALOG & FEATURE COMPONENTS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>2. Plugins Catalog Components</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Feature Scope</Text>
            </View>
          </View>

          {/* InstalledPluginsRow */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>InstalledPluginsRow</Text>
              <Text style={styles.componentPath}>src/features/plugins/components/installed-plugins-row.tsx</Text>
            </View>
            <InstalledPluginsRow
              items={[
                { id: 'whatsapp', name: 'WhatsApp' },
                { id: 'spotify', name: 'Spotify' },
              ]}
              onPluginPress={(id) => handleAction(`Installed plugin pressed: ${id}`)}
            />
          </View>

          {/* PluginItemRow */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>PluginItemRow</Text>
              <Text style={styles.componentPath}>src/features/plugins/components/plugin-item-row.tsx</Text>
            </View>
            <View style={{ gap: 8 }}>
              <PluginItemRow
                title="Adobe (formerly Photoshop)"
                description="Design, combine, and edit"
                iconBgColor="#D91F26"
                actionType="add"
                onPress={() => handleAction('PluginItemRow: Row pressed')}
                onActionPress={() => handleAction('PluginItemRow: Add pressed')}
              />
              <PluginItemRow
                title="WhatsApp"
                description="Messaging, voice notes, and media"
                iconBgColor="#25D366"
                actionType="trash"
                onPress={() => handleAction('PluginItemRow: WhatsApp pressed')}
                onActionPress={() => handleAction('PluginItemRow: Trash pressed')}
              />
              <PluginItemRow
                title="Spotify"
                description="Play music and control playback"
                iconBgColor="#1DB954"
                actionType="more"
                onPress={() => handleAction('PluginItemRow: Spotify pressed')}
                onActionPress={() => handleAction('PluginItemRow: More pressed')}
              />
              <PluginItemRow
                title="Google Docs"
                description="Create and edit documents"
                iconBgColor="#4285F4"
                actionType="chevron"
                onPress={() => handleAction('PluginItemRow: Google Docs pressed')}
              />
            </View>
          </View>

          {/* PluginConnectLogosRow */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>PluginConnectLogosRow</Text>
              <Text style={styles.componentPath}>src/features/plugins/components/plugin-connect-logos-row.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <PluginConnectLogosRow />
            </View>
          </View>

          {/* PluginPolicyContainer */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>PluginPolicyContainer</Text>
              <Text style={styles.componentPath}>src/features/plugins/components/plugin-policy-container.tsx</Text>
            </View>
            <PluginPolicyContainer />
          </View>
        </View>

        {/* SECTION 3: PLUGIN DETAIL COMPONENTS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>3. Plugin Detail Components</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Feature Scope</Text>
            </View>
          </View>

          {/* PluginDetailHero */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>PluginDetailHero</Text>
              <Text style={styles.componentPath}>src/features/plugins/components/plugin-detail-hero.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <PluginDetailHero title="WhatsApp" subtitle="Messaging, voice notes, and media" />
            </View>
          </View>

          {/* PluginPreviewCardsRow */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>PluginPreviewCardsRow</Text>
              <Text style={styles.componentPath}>src/features/plugins/components/plugin-preview-cards-row.tsx</Text>
            </View>
            <PluginPreviewCardsRow />
          </View>

          {/* PluginAppSection */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>PluginAppSection</Text>
              <Text style={styles.componentPath}>src/features/plugins/components/plugin-app-section.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <PluginAppSection appName="WhatsApp" />
            </View>
          </View>

          {/* PluginLegalDisclaimer */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>PluginLegalDisclaimer</Text>
              <Text style={styles.componentPath}>src/features/plugins/components/plugin-legal-disclaimer.tsx</Text>
            </View>
            <PluginLegalDisclaimer onLearnMorePress={() => handleAction('LegalDisclaimer: Learn more')} />
          </View>

          {/* SpotifyNowPlayingCard */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>SpotifyNowPlayingCard</Text>
              <Text style={styles.componentPath}>src/features/plugins/presentation/spotify-player/spotify-now-playing-card.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <SpotifyNowPlayingCard
                playback={{
                  isPlaying: true,
                  track: {
                    uri: 'spotify:track:teh-hijau',
                    title: 'Teh Hijau',
                    artist: 'Tulus',
                    album: 'Monokrom',
                    imageUrl: null,
                  },
                  deviceId: 'dev-1',
                  deviceName: 'Living Room Speaker',
                }}
                onPlayPause={() => handleAction('Spotify: Play/Pause')}
                onNext={() => handleAction('Spotify: Next')}
                onPrevious={() => handleAction('Spotify: Previous')}
              />
            </View>
          </View>

          {/* SpotifySearchResults with Playing Indicator */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>SpotifySearchResults (With Playing Indicator)</Text>
              <Text style={styles.componentPath}>src/features/plugins/presentation/spotify-player/spotify-search-results.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <SpotifySearchResults
                results={[
                  { uri: 'spotify:track:teh-hijau', title: 'Teh Hijau', artist: 'Tulus', imageUrl: null },
                  { uri: 'spotify:track:jatuh-suka', title: 'Jatuh Suka', artist: 'Tulus', imageUrl: null },
                  { uri: 'spotify:track:hati-hati', title: 'Hati-Hati di Jalan', artist: 'Tulus', imageUrl: null },
                ]}
                currentTrackUri="spotify:track:teh-hijau"
                isPlaying={true}
                onSelect={(uri) => handleAction(`Spotify: Selected track ${uri}`)}
              />
            </View>
          </View>
        </View>

        {/* SECTION 4: PLUGIN SETTINGS & ACCOUNT COMPONENTS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>4. Plugin Settings & Permissions</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Feature Scope</Text>
            </View>
          </View>

          {/* PluginConnectedAccountCard */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>PluginConnectedAccountCard</Text>
              <Text style={styles.componentPath}>src/features/plugins/components/plugin-connected-account-card.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <PluginConnectedAccountCard title="WhatsApp" subtitle="Connected to +62 812-3456-7890" />
            </View>
          </View>

          {/* PluginSkillsSection */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>PluginSkillsSection</Text>
              <Text style={styles.componentPath}>src/features/plugins/components/plugin-skills-section.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <PluginSkillsSection onSkillPress={(id) => handleAction(`Skill pressed: ${id}`)} />
            </View>
          </View>

          {/* PluginReadActionsSection */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>PluginReadActionsSection</Text>
              <Text style={styles.componentPath}>src/features/plugins/components/plugin-read-actions-section.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <PluginReadActionsSection onActionPress={(id) => handleAction(`ReadAction pressed: ${id}`)} />
            </View>
          </View>

          {/* PluginPermissionsCard */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>PluginPermissionsCard</Text>
              <Text style={styles.componentPath}>src/features/plugins/components/plugin-permissions-card.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <PluginPermissionsCard onPress={() => handleAction('PermissionsCard pressed')} />
            </View>
          </View>

          {/* PluginUninstallModal Trigger */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>PluginUninstallModal</Text>
              <Text style={styles.componentPath}>src/features/plugins/components/plugin-uninstall-modal.tsx</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.clearButton, { padding: 10 }, pressed && styles.pressed]}
              onPress={() => setIsUninstallModalVisible(true)}
            >
              <Text style={{ color: '#DB2626', fontWeight: '600', textAlign: 'center' }}>Open Uninstall Pop-up Modal</Text>
            </Pressable>
          </View>
        </View>

        {/* SECTION 5: WHATSAPP PAIRING FLOW COMPONENTS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>5. WhatsApp Pairing Flow</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Local Screen Scope</Text>
            </View>
          </View>

          
          {/* CheckPhoneContent */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>CheckPhoneContent</Text>
              <Text style={styles.componentPath}>src/features/auth/presentation/auth-screen/components/check-phone-sheet.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <CheckPhoneContent
                phoneNumber="+62 812-3456-7890"
                onSubmitCode={(code) => handleAction(`CheckPhone: Code ${code} submitted`)}
                onResendCode={() => handleAction("CheckPhone: Resend code clicked")}
              />
            </View>
          </View>

          {/* PhoneNumberInputCard */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>PhoneNumberInputCard</Text>
              <Text style={styles.componentPath}>.../whatsapp-pairing/components/phone-number-input-card.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <PhoneNumberInputCard phoneNumber={phoneNumber} onChangePhoneNumber={setPhoneNumber} />
            </View>
          </View>

          {/* PairingInstructionsCard */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>PairingInstructionsCard</Text>
              <Text style={styles.componentPath}>.../whatsapp-pairing/components/pairing-instructions-card.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <PairingInstructionsCard />
            </View>
          </View>

          {/* PairingCodeHero & PairingCodeDisplayBox */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>PairingCodeHero & DisplayBox</Text>
              <Text style={styles.componentPath}>.../whatsapp-pairing/components/</Text>
            </View>
            <View style={[styles.previewBoxCentered, { gap: 12 }]}>
              <PairingCodeHero />
              <PairingCodeDisplayBox onCopy={() => handleAction('Copied pairing code!')} />
            </View>
          </View>

          {/* QRPairingHero & QRCodeDisplayBox */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>QRPairingHero & DisplayBox</Text>
              <Text style={styles.componentPath}>.../whatsapp-pairing/components/</Text>
            </View>
            <View style={[styles.previewBoxCentered, { gap: 12 }]}>
              <QRPairingHero />
              <QRCodeDisplayBox />
            </View>
          </View>

          {/* PairingSuccessHero */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>PairingSuccessHero</Text>
              <Text style={styles.componentPath}>.../whatsapp-pairing/components/pairing-success-hero.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <PairingSuccessHero />
            </View>
          </View>

          {/* ActiveJoyCapabilitiesCard */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>ActiveJoyCapabilitiesCard</Text>
              <Text style={styles.componentPath}>.../whatsapp-pairing/components/active-joy-capabilities-card.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <ActiveJoyCapabilitiesCard />
            </View>
          </View>
        </View>

        {/* SECTION 6: JOY ROBOT NOTIFICATION SETTINGS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>6. Joy Robot Notification Settings</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Local Screen Scope</Text>
            </View>
          </View>

          {/* EnableIntegrationCard */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>EnableIntegrationCard</Text>
              <Text style={styles.componentPath}>.../notification-settings/components/enable-integration-card.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <EnableIntegrationCard
                enabled={enableRobotNotif}
                onToggle={(val) => {
                  setEnableRobotNotif(val);
                  handleAction(`Enable robot notifications: ${val}`);
                }}
              />
            </View>
          </View>

          {/* NotificationModeCard */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>NotificationModeCard</Text>
              <Text style={styles.componentPath}>.../notification-settings/components/notification-mode-card.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <NotificationModeCard
                selectedMode={notifMode}
                onSelectMode={(mode) => {
                  setNotifMode(mode);
                  handleAction(`Notification mode selected: ${mode}`);
                }}
              />
            </View>
          </View>

          {/* AllowedContactRow & AddAllowedContactRow */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>AllowedContactRow & AddAllowedContactRow</Text>
              <Text style={styles.componentPath}>.../notification-settings/components/</Text>
            </View>
            <View style={[styles.previewBoxCentered, { gap: 4, paddingVertical: 8 }]}>
              <AllowedContactRow
                name="Cenna Wijaya"
                phoneNumber="+62 812-3456-7890"
                accentColor="#25D366"
                notifyVoiceEnabled={true}
                onToggleNotifyVoice={(enabled) => handleAction(`Toggled Cenna voice alert: ${enabled}`)}
                onDelete={() => handleAction('Deleted contact Cenna')}
              />
              <AllowedContactRow
                name="Bos Kantor"
                phoneNumber="+62 813-1122-3344"
                notifyVoiceEnabled={false}
                onToggleNotifyVoice={(enabled) => handleAction(`Toggled Bos voice alert: ${enabled}`)}
                onDelete={() => handleAction('Deleted contact Bos')}
              />
              <AddAllowedContactRow onPress={() => handleAction('Add Contact pressed')} />
              <Pressable
                style={({ pressed }) => [styles.backToHomeButton, { marginTop: 12, width: '100%' }, pressed && styles.pressed]}
                onPress={() => setIsNotificationSheetVisible(true)}
                testID="open-notification-sheet-button"
              >
                <Text style={styles.backToHomeText}>Open Full WhatsApp Notification Sheet</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>ContactPickerSearchBar & DeviceContactItemRow</Text>
              <Text style={styles.componentPath}>.../notification-settings/components/</Text>
            </View>
            <View style={[styles.previewBoxCentered, { gap: 8, paddingVertical: 8 }]}>
              <ContactPickerSearchBar
                value=""
                onChangeText={(text) => handleAction(`Search typed: ${text}`)}
                style={{ width: '100%' }}
              />
              <View style={{ width: '100%', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#E3E8F0' }}>
                <DeviceContactItemRow
                  contact={{
                    id: '1',
                    name: 'Budi Santoso',
                    phoneNumber: '0812-3456-7890',
                    normalizedPhoneNumber: '+6281234567890',
                    phoneNumbers: [{ number: '0812-3456-7890', normalizedNumber: '+6281234567890' }],
                    avatarColor: '#E56666',
                  }}
                  onPress={(contact) => handleAction(`Selected contact: ${contact.name}`)}
                />
              </View>
            </View>
          </View>

          {/* DeviceContactPickerSheet */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>DeviceContactPickerSheet</Text>
              <Text style={styles.componentPath}>.../notification-settings/components/</Text>
            </View>
            <View style={[styles.previewBoxCentered, { paddingVertical: 8 }]}>
              <Pressable
                style={styles.openSheetButton}
                onPress={() => setIsContactPickerVisible(true)}
              >
                <Text style={styles.openSheetButtonText}>Open Device Contact Picker Sheet</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* SECTION 7: CHAT & OTHER FEATURE COMPONENTS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>7. Chat & Other Feature Components</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Chat Scope</Text>
            </View>
          </View>

          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>TemporaryChatDeclaration</Text>
              <Text style={styles.componentPath}>src/features/chat/components/temporary-chat-declaration.tsx</Text>
            </View>
            <TemporaryChatDeclaration />
          </View>

          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>UserMessageBubble & ScheduleEditPill</Text>
              <Text style={styles.componentPath}>src/features/chat/components/</Text>
            </View>
            <View style={{ gap: 8 }}>
              <UserMessageBubble message="Show me WhatsApp integration options" />
              <ScheduleEditPill scheduleText="Everyday" titleText="Notification Filter" onPress={() => handleAction('SchedulePill')} />
            </View>
          </View>

          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>MessageActionBar</Text>
              <Text style={styles.componentPath}>src/features/chat/components/message-action-bar.tsx</Text>
            </View>
            <MessageActionBar
              onCopy={() => handleAction('ActionBar: Copy')}
              onSpeak={() => handleAction('ActionBar: Speak')}
              onThumbsDown={() => handleAction('ActionBar: ThumbsDown')}
              onShare={() => handleAction('ActionBar: Share')}
            />
          </View>
        </View>

        
        {/* SECTION 8: SCHEDULE & CONFIG COMPONENTS (15 NEW SLICED COMPONENTS) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>8. Schedule & Config Components</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>15 Sliced Figma Components</Text>
            </View>
          </View>

          {/* 1. ScheduleHydrationCard */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>ScheduleHydrationCard</Text>
              <Text style={styles.componentPath}>src/features/schedules/components/schedule-hydration-card.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <ScheduleHydrationCard
                onPress={() => handleAction("ScheduleHydrationCard pressed")}
                onActionPress={() => handleAction("ScheduleHydrationCard + pressed")}
              />
            </View>
          </View>

          {/* 1b. ScheduleMorningCard */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>ScheduleMorningCard</Text>
              <Text style={styles.componentPath}>src/features/schedules/components/schedule-morning-card.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <ScheduleMorningCard
                onPress={() => handleAction("ScheduleMorningCard pressed")}
                onActionPress={() => handleAction("ScheduleMorningCard + pressed")}
              />
            </View>
          </View>
          {/* 2. ScheduleMonitoringCard */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>ScheduleMonitoringCard</Text>
              <Text style={styles.componentPath}>src/features/schedules/components/schedule-monitoring-card.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <ScheduleMonitoringCard onPress={() => handleAction("ScheduleMonitoringCard pressed")} />
            </View>
          </View>

          {/* 3. ScheduleWeeklyCard */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>ScheduleWeeklyCard</Text>
              <Text style={styles.componentPath}>src/features/schedules/components/schedule-weekly-card.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <ScheduleWeeklyCard onPress={() => handleAction("ScheduleWeeklyCard pressed")} />
            </View>
          </View>

          {/* 4. SchedulePausedCard */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>SchedulePausedCard</Text>
              <Text style={styles.componentPath}>src/features/schedules/components/schedule-paused-card.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <SchedulePausedCard
                onPress={() => handleAction("SchedulePausedCard pressed")}
                onActionPress={() => handleAction("SchedulePausedCard Resume pressed")}
              />
            </View>
          </View>

          {/* 5. ScheduleCompletedCard */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>ScheduleCompletedCard</Text>
              <Text style={styles.componentPath}>src/features/schedules/components/schedule-completed-card.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <ScheduleCompletedCard onPress={() => handleAction("ScheduleCompletedCard pressed")} />
            </View>
          </View>

          {/* 6. FilterIconButton */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>FilterIconButton</Text>
              <Text style={styles.componentPath}>src/components/ui/filter-icon-button.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <FilterIconButton onPress={() => handleAction("FilterIconButton pressed")} />
            </View>
          </View>

          {/* 7. CheckmarkButton */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>CheckmarkButton</Text>
              <Text style={styles.componentPath}>src/components/ui/checkmark-button.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <CheckmarkButton onPress={() => handleAction("CheckmarkButton pressed")} />
            </View>
          </View>

          {/* 8. ScheduleFilterDropdown */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>ScheduleFilterDropdown</Text>
              <Text style={styles.componentPath}>src/features/schedules/components/schedule-filter-dropdown.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <ScheduleFilterDropdown
                selectedOption={selectedFilter}
                onSelectOption={(opt) => {
                  setSelectedFilter(opt);
                  handleAction("ScheduleFilterDropdown selected: " + opt);
                }}
              />
            </View>
          </View>

          {/* 9. ScheduleContextMenu */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>ScheduleContextMenu</Text>
              <Text style={styles.componentPath}>src/features/schedules/components/schedule-context-menu.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <ScheduleContextMenu
                onEdit={() => handleAction("ContextMenu: Edit")}
                onPause={() => handleAction("ContextMenu: Pause")}
                onDelete={() => handleAction("ContextMenu: Delete")}
              />
            </View>
          </View>

          {/* 10. SchedulePromptField */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>SchedulePromptField</Text>
              <Text style={styles.componentPath}>src/features/schedules/components/schedule-prompt-field.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <SchedulePromptField onChangeText={(t) => handleAction("PromptField changed: " + t)} />
            </View>
          </View>

          {/* 11. ScheduleRepeatField */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>ScheduleRepeatField</Text>
              <Text style={styles.componentPath}>src/features/schedules/components/schedule-repeat-field.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <ScheduleRepeatField
                onPressFrequency={() => handleAction("RepeatField: Frequency pressed")}
                onPressDay={() => handleAction("RepeatField: Day pressed")}
              />
            </View>
          </View>

          {/* 12. ScheduleTimeField */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>ScheduleTimeField</Text>
              <Text style={styles.componentPath}>src/features/schedules/components/schedule-time-field.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <ScheduleTimeField onPressTime={() => handleAction("TimeField pressed")} />
            </View>
          </View>

          {/* 13. ScheduleFrequencyField */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>ScheduleFrequencyField</Text>
              <Text style={styles.componentPath}>src/features/schedules/components/schedule-frequency-field.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <ScheduleFrequencyField
                onPressFrequency={() => handleAction("FrequencyField: Frequency pressed")}
                onPressEvery={() => handleAction("FrequencyField: Every pressed")}
              />
            </View>
          </View>

          {/* 14. ScheduleDaysSelectionField */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>ScheduleDaysSelectionField</Text>
              <Text style={styles.componentPath}>src/features/schedules/components/schedule-days-selection-field.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <ScheduleDaysSelectionField
                selectedDays={selectedDays}
                onToggleDay={(day) => {
                  const updated = selectedDays.includes(day)
                    ? selectedDays.filter((d) => d !== day)
                    : [...selectedDays, day];
                  setSelectedDays(updated);
                  handleAction("Toggled day: " + day);
                }}
              />
            </View>
          </View>

          {/* 15. ScheduleDateField */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>ScheduleDateField</Text>
              <Text style={styles.componentPath}>src/features/schedules/components/schedule-date-field.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <ScheduleDateField onPressDate={() => handleAction("DateField pressed")} />
            </View>
          </View>
        </View>

        
        {/* SECTION 9: SETTINGS COMPONENTS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>9. Settings Components</Text>

          {/* ProfileHeroStatsHeader */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>ProfileHeroStatsHeader (Figma 242:2706 & 296:5677)</Text>
              <Text style={styles.componentPath}>src/features/settings/components/profile-hero-stats-header.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <ProfileHeroStatsHeader
                onProfilePress={() => handleAction("ProfileHeroStatsHeader: Profile pressed")}
              />
            </View>
          </View>

          {/* ProfileHeaderBlock */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>ProfileHeaderBlock</Text>
              <Text style={styles.componentPath}>src/features/settings/components/profile-header-block.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <ProfileHeaderBlock
                name="Rangga Hadi Putra"
                onEditPress={() => handleAction("ProfileHeaderBlock: Edit pressed")}
              />
            </View>
          </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Feature Scope</Text>
            </View>
          </View>

          
          {/* ScreenshotUploadContainer */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>ScreenshotUploadContainer</Text>
              <Text style={styles.componentPath}>src/features/settings/components/screenshot-upload-container.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <ScreenshotUploadContainer
                screenshots={[""]}
                onAddScreenshot={() => handleAction("ScreenshotUploadContainer: Add screenshot")}
                onRemoveScreenshot={(idx) => handleAction("ScreenshotUploadContainer: Remove screenshot " + idx)}
              />
            </View>
          </View>

          {/* BugReportTogglesCard */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>BugReportTogglesCard</Text>
              <Text style={styles.componentPath}>src/features/settings/components/bug-report-toggles-card.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <BugReportTogglesCard
                onAddScreenshot={() => handleAction("BugReportTogglesCard: Add screenshot")}
                onIncludeScreenshotChange={(val) => handleAction("BugReportTogglesCard toggle: " + val)}
              />
            </View>
          </View>

          {/* BugReportTextareaCard */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>BugReportTextareaCard</Text>
              <Text style={styles.componentPath}>src/features/settings/components/bug-report-textarea-card.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <BugReportTextareaCard
                onChangeText={(text) => handleAction("BugReportTextareaCard text: " + text)}
              />
            </View>
          </View>

          {/* SettingsChatGPTSection */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>SettingsChatGPTSection</Text>
              <Text style={styles.componentPath}>src/features/settings/components/settings-chatgpt-section.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <SettingsChatGPTSection
                onItemPress={(id) => handleAction("Settings item pressed: " + id)}
              />
            </View>
          </View>

          {/* PersonalizationPickerDropdown */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>PersonalizationPickerDropdown</Text>
              <Text style={styles.componentPath}>src/features/settings/components/personalization-picker-dropdown.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <PersonalizationPickerDropdown
                options={['default', 'casual', 'cynical']}
                selectedOption={showcaseTone}
                onSelectOption={(opt) => {
                  setShowcaseTone(opt);
                  handleAction(`Selected tone: ${opt}`);
                }}
                testID="showcase-tone-dropdown"
              />
            </View>
          </View>

          {/* PersonalizationSheet trigger */}
          <View style={styles.componentCard}>
            <View style={styles.componentMeta}>
              <Text style={styles.componentName}>PersonalizationSheet</Text>
              <Text style={styles.componentPath}>src/features/settings/presentation/personalization-sheet/personalization-sheet.tsx</Text>
            </View>
            <View style={styles.previewBoxCentered}>
              <Pressable
                style={({ pressed }) => [styles.backToHomeButton, pressed && styles.pressed]}
                onPress={() => setIsPersonalizationSheetVisible(true)}
                testID="open-personalization-sheet-button"
              >
                <Text style={styles.backToHomeText}>Open Personalization Sheet</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.backToHomeButton, { marginTop: 8 }, pressed && styles.pressed]}
                onPress={() => setIsMemorySheetVisible(true)}
                testID="open-memory-sheet-button"
              >
                <Text style={styles.backToHomeText}>Open Memory Sheet</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Footer Navigation Button */}
        <View style={styles.footerSection}>
          <Pressable
            style={({ pressed }) => [styles.backToHomeButton, pressed && styles.pressed]}
            onPress={handleBack}
          >
            <Text style={styles.backToHomeText}>Back to Main Screen</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Interactive Modals */}
      <QuestionCardSheet
        isVisible={isQuestionSheetVisible}
        onClose={() => setIsQuestionSheetVisible(false)}
        question="What area should I search around each week?"
        options={[
          { id: '1', label: 'My current location' },
          { id: '2', label: 'Home' },
          { id: '3', label: 'Work' },
        ]}
        onSelectOption={(id) => handleAction(`Selected option ${id}`)}
        onSkip={() => setIsQuestionSheetVisible(false)}
      />
      <PersonalizationSheet
        isVisible={isPersonalizationSheetVisible}
        onClose={() => setIsPersonalizationSheetVisible(false)}
        onSave={(vals) => {
          handleAction('Personalization saved: ' + JSON.stringify(vals));
          setIsPersonalizationSheetVisible(false);
        }}
        testID="showcase-personalization-sheet"
      />
      <MemorySheet
        isVisible={isMemorySheetVisible}
        onClose={() => setIsMemorySheetVisible(false)}
        onSave={(vals) => {
          handleAction('Memory saved: ' + JSON.stringify(vals));
          setIsMemorySheetVisible(false);
        }}
        testID="showcase-memory-sheet"
      />

      <PluginUninstallModal
        visible={isUninstallModalVisible}
        onConfirm={() => {
          handleAction('Plugin uninstalled');
          setIsUninstallModalVisible(false);
        }}
        onCancel={() => setIsUninstallModalVisible(false)}
      />

      <DeviceContactPickerSheet
        isVisible={isContactPickerVisible}
        onClose={() => setIsContactPickerVisible(false)}
        onSelectContact={(contact) => {
          handleAction(`Selected contact: ${contact.name} (${contact.phoneNumber})`);
          setIsContactPickerVisible(false);
        }}
      />
      <PluginNotificationSettingsSheet
        isVisible={isNotificationSheetVisible}
        onClose={() => setIsNotificationSheetVisible(false)}
        initialContacts={showcaseContacts}
        onAddContactPress={() => setIsContactPickerVisible(true)}
        onToggleContactNotification={(id, notifyVoiceEnabled) => {
          handleAction(`Toggled contact ${id} voice: ${notifyVoiceEnabled}`);
          setShowcaseContacts((prev) =>
            prev.map((c) => (c.id === id ? { ...c, notifyVoiceEnabled } : c)),
          );
        }}
        onDeleteContact={(id) => {
          handleAction(`Deleted contact ${id}`);
          setShowcaseContacts((prev) => prev.filter((c) => c.id !== id));
        }}
        testID="showcase-whatsapp-notification-sheet"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  headerBar: {
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EBECEF',
  },
  headerLeft: {
    width: 48,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0D0D0D',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: '#66666E',
    marginTop: 2,
  },
  headerRight: {
    width: 48,
    alignItems: 'flex-end',
  },
  clearButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F0F0F3',
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#60646C',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 24,
  },
  logCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E4E9',
    gap: 6,
  },
  logCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#60646C',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  logCardDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0D0D0D',
    lineHeight: 20,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0D0D0D',
  },
  badge: {
    backgroundColor: '#EAECEF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4D4D4D',
  },
  componentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EBECEF',
    gap: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  componentMeta: {
    gap: 2,
  },
  componentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0D0D0D',
  },
  componentPath: {
    fontSize: 12,
    fontWeight: '400',
    color: '#8C8C94',
  },
  previewBoxCentered: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  footerSection: {
    alignItems: 'center',
    paddingTop: 8,
  },
  backToHomeButton: {
    backgroundColor: '#0D0D0D',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 999,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  backToHomeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  openSheetButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openSheetButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
