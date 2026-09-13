import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AnimatedDropdownOverlay } from '@/components/ui/animated-dropdown-overlay';
import { BottomWhiteFadeOverlay } from '@/components/ui/bottom-white-fade-overlay';
import { ChatComposer } from '@/components/ui/chat-composer';
import { FilterIconButton } from '@/components/ui/filter-icon-button';
import { LiquidGlassIconButton } from '@/components/ui/liquid-glass-icon-button';
import { ScheduleTokens, SidebarTokens } from '@/constants/theme';
import { useSidebarShell } from '@/features/chat/presentation/sidebar-shell';
import {
  DEFAULT_HYDRATION_PROMPT,
  DEFAULT_MORNING_PROMPT,
  EditScheduleSheet,
  ScheduleCompletedCard,
  ScheduleContextMenu,
  ScheduleFilterDropdown,
  type ScheduleFilterOption,
  ScheduleHydrationCard,
  ScheduleMonitoringCard,
  ScheduleMorningCard,
  SchedulePausedCard,
  ScheduleWeeklyCard,
} from '@/features/schedules/components';
import { useSchedules } from '@/features/schedules/data/use-schedules';
import {
  mapScheduleApiError,
  type ScheduleCardItem,
  type ScheduleTimeOfDay,
} from '@/features/schedules/domain/schedule';

const HEADER_BAR_HEIGHT = 44;
const FILTER_DROPDOWN_GAP = 8;
const SCREEN_HORIZONTAL_PADDING = 24;

export type SchedulesScreenProps = {
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function SchedulesScreen({ style, testID = 'schedules-screen' }: SchedulesScreenProps) {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { open, navigate, registerActions, isOpen } = useSidebarShell();

  const [inputValue, setInputValue] = useState('');
  const [filter, setFilter] = useState<ScheduleFilterOption>('Active');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [contextMenuItemId, setContextMenuItemId] = useState<string | null>(null);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const inputValueRef = useRef(inputValue);
  inputValueRef.current = inputValue;

  const {
    cards: visibleItems,
    hasSchedules,
    isMutating,
    load,
    createFromPrompt,
    pause,
    resume,
    remove,
    update,
    rawScheduleById,
    cardById,
    getContextMenuVariant,
  } = useSchedules(filter);

  useEffect(() => {
    void load().catch((error) => {
      Alert.alert('Unable to load schedules', mapScheduleApiError(error));
    });
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load().catch((error) => {
        Alert.alert('Unable to load schedules', mapScheduleApiError(error));
      });
    }, [load])
  );

  useFocusEffect(
    useCallback(() => {
      return registerActions(
        {
          onNewChat: () => navigate('chat'),
        },
        'scheduled'
      );
    }, [registerActions, navigate])
  );

  const paddingTop = Math.max(insets.top, 20);
  const paddingBottom = Math.max(insets.bottom, 12);
  const composerHeight = 68 + paddingBottom;
  const isFilterActive = filter === 'Paused' || filter === 'Completed';

  const contextMenuItem = useMemo(
    () => cardById(contextMenuItemId),
    [cardById, contextMenuItemId]
  );

  const editingSchedule = useMemo(
    () => rawScheduleById(editingScheduleId),
    [editingScheduleId, rawScheduleById]
  );

  const handleSaveEdit = useCallback(
    async (id: string, patch: { prompt?: string; timeOfDay?: ScheduleTimeOfDay }) => {
      await update(id, patch);
      setEditingScheduleId(null);
    },
    [update]
  );

  const handleSuggestionPress = useCallback((label: string) => {
    setInputValue(label);
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = inputValueRef.current.trim();
    if (!trimmed || isMutating) return;
    setInputValue('');
    setFilter('Active');
    setIsFilterOpen(false);
    setContextMenuItemId(null);
    void createFromPrompt(trimmed).catch((error) => {
      setInputValue(trimmed);
      Alert.alert('Unable to create schedule', mapScheduleApiError(error));
    });
  }, [isMutating, createFromPrompt]);

  const handleFilterSelect = useCallback((option: ScheduleFilterOption) => {
    setFilter(option);
    setIsFilterOpen(false);
  }, []);

  const handlePauseItem = useCallback(
    async (id: string) => {
      setContextMenuItemId(null);
      try {
        await pause(id);
      } catch (error) {
        Alert.alert('Could not pause schedule', mapScheduleApiError(error));
      }
    },
    [pause]
  );

  const handleResumeItem = useCallback(
    async (id: string) => {
      setContextMenuItemId(null);
      try {
        await resume(id);
      } catch (error) {
        Alert.alert('Could not resume schedule', mapScheduleApiError(error));
      }
    },
    [resume]
  );

  const handleDeleteItem = useCallback(
    async (id: string) => {
      setContextMenuItemId(null);
      try {
        await remove(id);
      } catch (error) {
        Alert.alert('Could not delete schedule', mapScheduleApiError(error));
      }
    },
    [remove]
  );

  const renderScheduleCard = useCallback(
    (item: ScheduleCardItem, isElevated = false) => {
      const cardStyle = isElevated ? styles.elevatedCard : undefined;
      const onLongPress = isElevated ? undefined : () => setContextMenuItemId(item.id);

      switch (item.status) {
        case 'PAUSED':
          return (
            <SchedulePausedCard
              key={item.id}
              title={item.title}
              description={item.description}
              footerText={item.footerText}
              onActionPress={() => handleResumeItem(item.id)}
              onLongPress={onLongPress}
              style={cardStyle}
              testID={`schedule-card-${item.id}`}
            />
          );
        case 'COMPLETED':
          return (
            <ScheduleCompletedCard
              key={item.id}
              title={item.title}
              description={item.description}
              footerText={item.footerText}
              onLongPress={onLongPress}
              style={cardStyle}
              testID={`schedule-card-${item.id}`}
            />
          );
        case 'WEEKLY':
          return (
            <ScheduleWeeklyCard
              key={item.id}
              title={item.title}
              description={item.description}
              footerText={item.footerText}
              onLongPress={onLongPress}
              style={cardStyle}
              testID={`schedule-card-${item.id}`}
            />
          );
        case 'MONITORING':
        default:
          return (
            <ScheduleMonitoringCard
              key={item.id}
              title={item.title}
              description={item.description}
              footerText={item.footerText}
              onLongPress={onLongPress}
              style={cardStyle}
              testID={`schedule-card-${item.id}`}
            />
          );
      }
    },
    [handleResumeItem]
  );

  return (
    <View
      style={[
        styles.root,
        style,
      ]}
      testID={testID}
    >
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.mainLayout, { paddingTop, paddingBottom }]}>
          <View style={styles.headerBar} testID={`${testID}-header`}>
            <LiquidGlassIconButton
              onPress={open}
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

            <Text style={[styles.titleText, { color: theme.text }]}>Scheduled</Text>

            <FilterIconButton
              isActive={isFilterActive}
              onPress={() => setIsFilterOpen((openFilter) => !openFilter)}
              testID={`${testID}-filter-button`}
            />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              !hasSchedules && styles.scrollContentEmpty,
              { paddingBottom: composerHeight + 24 },
            ]}
            style={styles.scrollView}
            testID={`${testID}-scroll-view`}
          >
            {!hasSchedules ? (
              <View style={styles.suggestions} testID={`${testID}-suggestions`}>
                <ScheduleHydrationCard
                  onPress={() => handleSuggestionPress(DEFAULT_HYDRATION_PROMPT)}
                  onActionPress={() => handleSuggestionPress(DEFAULT_HYDRATION_PROMPT)}
                  testID={`${testID}-suggestion-hydration`}
                />
                <ScheduleMorningCard
                  onPress={() => handleSuggestionPress(DEFAULT_MORNING_PROMPT)}
                  onActionPress={() => handleSuggestionPress(DEFAULT_MORNING_PROMPT)}
                  testID={`${testID}-suggestion-morning`}
                />
              </View>
            ) : (
              <View style={styles.cardsList} testID={`${testID}-cards-list`}>
                {visibleItems.map((item) =>
                  item.id === contextMenuItemId ? (
                    <View
                      key={`placeholder-${item.id}`}
                      style={styles.cardPlaceholder}
                      testID={`${testID}-card-placeholder-${item.id}`}
                    />
                  ) : (
                    renderScheduleCard(item)
                  )
                )}
              </View>
            )}
          </ScrollView>

          <BottomWhiteFadeOverlay
            height={composerHeight}
            color={isOpen && colorScheme === 'dark' ? SidebarTokens.colors.dark.surface : undefined}
            testID={`${testID}-bottom-fade-overlay`}
          />

          <View style={[styles.composerOverlay, { paddingBottom }]} pointerEvents="box-none">
            <ChatComposer
              value={inputValue}
              onChangeText={setInputValue}
              onSubmit={handleSubmit}
              placeholder="Schedule a task"
              disabled={false}
              sendDisabled={isMutating}
              testID={`${testID}-composer`}
            />
          </View>

          <AnimatedDropdownOverlay
            isOpen={isFilterOpen}
            onClose={() => setIsFilterOpen(false)}
            backdropStyle={styles.filterBackdrop}
            containerStyle={[
              styles.filterDropdownWrapper,
              { top: paddingTop + HEADER_BAR_HEIGHT + FILTER_DROPDOWN_GAP },
            ]}
            testID={`${testID}-filter-overlay`}
          >
            <ScheduleFilterDropdown
              selectedOption={filter}
              onSelectOption={handleFilterSelect}
              style={styles.filterDropdown}
              testID={`${testID}-filter-dropdown`}
            />
          </AnimatedDropdownOverlay>

          {contextMenuItem ? (
            <View style={styles.contextOverlay} testID={`${testID}-context-overlay`}>
              <Pressable
                style={styles.contextBackdrop}
                onPress={() => setContextMenuItemId(null)}
                testID={`${testID}-context-backdrop`}
              />
              <View style={styles.contextContent} pointerEvents="box-none">
                {renderScheduleCard(contextMenuItem, true)}
                <ScheduleContextMenu
                  variant={getContextMenuVariant(contextMenuItem.status)}
                  onEdit={() => {
                    setEditingScheduleId(contextMenuItem.id);
                    setContextMenuItemId(null);
                  }}
                  onPause={() => handlePauseItem(contextMenuItem.id)}
                  onResume={() => handleResumeItem(contextMenuItem.id)}
                  onDelete={() => handleDeleteItem(contextMenuItem.id)}
                  style={styles.contextMenu}
                  testID={`${testID}-context-menu`}
                />
              </View>
            </View>
          ) : null}

          <EditScheduleSheet
            isVisible={Boolean(editingScheduleId)}
            onClose={() => setEditingScheduleId(null)}
            schedule={editingSchedule}
            onSave={handleSaveEdit}
            testID={`${testID}-edit-sheet`}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  mainLayout: {
    flex: 1,
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    position: 'relative',
  },
  headerBar: {
    height: HEADER_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  menuIcon: {
    width: 20,
    height: 20,
  },
  titleText: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  scrollContentEmpty: {
    justifyContent: 'center',
  },
  suggestions: {
    gap: 16,
    width: '100%',
  },
  cardsList: {
    gap: 16,
    width: '100%',
  },
  composerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: SCREEN_HORIZONTAL_PADDING,
    right: SCREEN_HORIZONTAL_PADDING,
    zIndex: 10,
    paddingTop: 12,
  },
  filterBackdrop: {
    zIndex: 40,
  },
  filterDropdownWrapper: {
    right: SCREEN_HORIZONTAL_PADDING,
    padding: 0,
    zIndex: 41,
  },
  filterDropdown: {
    width: 220,
    borderRadius: 28,
  },
  contextOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
    justifyContent: 'flex-start',
    paddingTop: 64,
    paddingHorizontal: 0,
  },
  contextBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: ScheduleTokens.colors.overlay,
  },
  contextContent: {
    paddingHorizontal: 0,
    gap: 12,
    alignItems: 'center',
    zIndex: 51,
  },
  cardPlaceholder: {
    width: '100%',
    minHeight: 160,
  },
  elevatedCard: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 12,
    width: '100%',
  },
  contextMenu: {
    width: 254,
    alignSelf: 'center',
  },
});
