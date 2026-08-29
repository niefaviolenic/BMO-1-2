import { usePathname, useRouter } from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  Pressable,
  View,
} from 'react-native';

import { SidebarTokens } from '@/constants/theme';
import { useSchemeColors } from '@/hooks/use-scheme-colors';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { useChatSession } from '@/features/chat/data/use-chat-session';
import { SidebarDrawer } from '@/features/chat/presentation/main-chat-screen/components/sidebar-drawer';
import { SearchModal } from '@/features/chat/presentation/search-screen';
import { SettingsSheet } from '@/features/settings/components';
import { AboutSheet } from '@/features/settings/presentation/about-sheet';
import { ConnectedMemorySheet } from '@/features/settings/presentation/memory-sheet';
import { ConnectedMemorySummarySheet } from '@/features/settings/presentation/memory-summary-sheet';
import { ConnectedPersonalizationSheet } from '@/features/settings/presentation/personalization-sheet';
import { ConnectedReportAppIssueSheet } from '@/features/settings/presentation/report-app-issue-sheet';
import { UpgradeSheet } from '@/features/settings/presentation/upgrade-sheet';
import {
  SidebarShellContext,
  type SidebarRouteId,
  type SidebarShellActions,
  type SidebarShellContextValue,
} from './sidebar-shell-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
export const DRAWER_WIDTH = Math.min(SidebarTokens.width, SCREEN_WIDTH * 0.75);

const ROUTE_HREF = {
  robot: '/robot',
  scheduled: '/schedule',
  plugins: '/plugins',
  chat: '/chat',
} as const;

type SidebarHref = (typeof ROUTE_HREF)[SidebarRouteId];

function pathnameToRouteId(pathname: string): SidebarRouteId | null {
  if (pathname === '/robot' || pathname.endsWith('/robot')) return 'robot';
  if (pathname === '/schedule' || pathname.endsWith('/schedule')) return 'scheduled';
  if (pathname === '/plugins' || pathname.endsWith('/plugins')) return 'plugins';
  if (pathname === '/chat' || pathname.endsWith('/chat')) return 'chat';
  return null;
}

function isKnownRoute(routeId: string): routeId is SidebarRouteId {
  return routeId in ROUTE_HREF;
}

export type SidebarShellProps = {
  children: ReactNode;
};

export function SidebarShell({ children }: SidebarShellProps) {
  const colors = useSchemeColors();
  const router = useRouter();
  const pathname = usePathname();
  const {
    sessions,
    openSession,
    startNew,
    deleteSession,
    pinnedSessionIds,
    pinSession,
    unpinSession,
  } = useChatSession();

  const [isOpen, setIsOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);
  const [showMemorySheet, setShowMemorySheet] = useState(false);
  const [showMemorySummarySheet, setShowMemorySummarySheet] = useState(false);
  const [showPersonalizationSheet, setShowPersonalizationSheet] = useState(false);
  const [showAboutSheet, setShowAboutSheet] = useState(false);
  const [showReportAppIssueSheet, setShowReportAppIssueSheet] = useState(false);
  const [showUpgradeSheet, setShowUpgradeSheet] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;
  const borderRadius = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const isOpenRef = useRef(isOpen);
  const isTransitioningRef = useRef(isTransitioning);
  const actionsRef = useRef<SidebarShellActions>({});
  const pathnameRef = useRef(pathname);
  /**
   * Enter slide waits until BOTH:
   * - router pathname matches the target, and
   * - the destination screen has focused (registerActions from useFocusEffect).
   */
  const pendingEnterRef = useRef<{
    routeId: SidebarRouteId;
    pathnameReady: boolean;
    focusReady: boolean;
  } | null>(null);
  const enterFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterStartedRef = useRef(false);
  const interactionHandleRef = useRef<{ cancel: () => void } | null>(null);

  isOpenRef.current = isOpen;
  isTransitioningRef.current = isTransitioning;
  pathnameRef.current = pathname;

  const clearEnterFallback = useCallback(() => {
    if (enterFallbackTimerRef.current != null) {
      clearTimeout(enterFallbackTimerRef.current);
      enterFallbackTimerRef.current = null;
    }
  }, []);

  const cancelPendingInteraction = useCallback(() => {
    interactionHandleRef.current?.cancel();
    interactionHandleRef.current = null;
  }, []);

  const runEnterSlide = useCallback(() => {
    if (enterStartedRef.current) return;
    enterStartedRef.current = true;
    clearEnterFallback();
    pendingEnterRef.current = null;
    cancelPendingInteraction();

    // Stay invisible off-screen until native stack finishes swapping screens
    // (plugins is heavy and can otherwise flash during the enter slide).
    const idleCallbackId = requestIdleCallback(() => {
      interactionHandleRef.current = null;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          contentOpacity.setValue(1);
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: 0,
              duration: 250,
              easing: Easing.out(Easing.quad),
              useNativeDriver: false,
            }),
            Animated.timing(borderRadius, {
              toValue: 0,
              duration: 250,
              easing: Easing.out(Easing.quad),
              useNativeDriver: false,
            }),
          ]).start(({ finished: enterFinished }) => {
            setIsOpen(false);
            setIsTransitioning(false);
            enterStartedRef.current = false;
            if (!enterFinished) {
              translateX.setValue(0);
              borderRadius.setValue(0);
              contentOpacity.setValue(1);
            }
          });
        });
      });
    });
    interactionHandleRef.current = { cancel: () => cancelIdleCallback(idleCallbackId) };
  }, [
    clearEnterFallback,
    cancelPendingInteraction,
    translateX,
    borderRadius,
    contentOpacity,
  ]);

  const tryStartEnterSlide = useCallback(() => {
    const pending = pendingEnterRef.current;
    if (!pending) return;
    if (!pending.pathnameReady || !pending.focusReady) return;
    runEnterSlide();
  }, [runEnterSlide]);

  const tryStartEnterSlideRef = useRef(tryStartEnterSlide);
  tryStartEnterSlideRef.current = tryStartEnterSlide;

  useEffect(() => {
    if (isTransitioning) {
      return;
    }

    if (isOpen) {
      Keyboard.dismiss();
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: DRAWER_WIDTH,
          duration: 250,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(borderRadius, {
          toValue: 44,
          duration: 250,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(translateX, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(borderRadius, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.quad),
        useNativeDriver: false,
      }),
    ]).start();
  }, [isOpen, isTransitioning, translateX, borderRadius]);

  // Mark pathname ready; enter only when focus is also ready.
  useEffect(() => {
    const pending = pendingEnterRef.current;
    if (!pending) return;
    if (pathnameToRouteId(pathname) !== pending.routeId) return;
    pending.pathnameReady = true;
    tryStartEnterSlide();
  }, [pathname, tryStartEnterSlide]);

  useEffect(() => {
    return () => {
      clearEnterFallback();
      cancelPendingInteraction();
    };
  }, [clearEnterFallback, cancelPendingInteraction]);

  const open = useCallback(() => {
    if (isTransitioningRef.current) return;
    Keyboard.dismiss();
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    if (isTransitioningRef.current) return;
    setIsOpen(false);
  }, []);

  const performRouteChange = useCallback(
    (routeId: SidebarRouteId) => {
      const href: SidebarHref = ROUTE_HREF[routeId];
      // Replace keeps main tabs from stacking and avoids previous (e.g. Plugins)
      // content lingering in the native stack during the enter slide.
      router.replace(href);
    },
    [router]
  );

  const navigate = useCallback(
    (routeId: string) => {
      if (isTransitioningRef.current) return;

      if (routeId === 'search') {
        // Keep drawer open under the Modal (same as settings sheet).
        setIsSearchVisible(true);
        return;
      }

      if (!isKnownRoute(routeId)) {
        if (isOpenRef.current) {
          setIsOpen(false);
        }
        return;
      }

      const current = pathnameToRouteId(pathname);
      if (current === routeId) {
        setIsOpen(false);
        return;
      }

      if (!isOpenRef.current) {
        performRouteChange(routeId);
        return;
      }

      setIsTransitioning(true);
      clearEnterFallback();
      cancelPendingInteraction();
      pendingEnterRef.current = null;
      enterStartedRef.current = false;

      Animated.parallel([
        Animated.timing(translateX, {
          toValue: SCREEN_WIDTH,
          duration: 250,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(borderRadius, {
          toValue: 44,
          duration: 250,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
      ]).start(({ finished }) => {
        if (!finished) {
          pendingEnterRef.current = null;
          contentOpacity.setValue(1);
          setIsTransitioning(false);
          return;
        }

        // Hide surface while the stack swaps routes (prevents previous-page flash).
        contentOpacity.setValue(0);

        pendingEnterRef.current = {
          routeId,
          pathnameReady: pathnameToRouteId(pathnameRef.current) === routeId,
          focusReady: false,
        };
        performRouteChange(routeId);

        enterFallbackTimerRef.current = setTimeout(() => {
          if (pendingEnterRef.current?.routeId === routeId) {
            pendingEnterRef.current.pathnameReady = true;
            pendingEnterRef.current.focusReady = true;
            tryStartEnterSlideRef.current();
          }
        }, 900);
      });
    },
    [
      pathname,
      performRouteChange,
      translateX,
      borderRadius,
      contentOpacity,
      clearEnterFallback,
      cancelPendingInteraction,
    ]
  );

  const registerActions = useCallback(
    (actions: SidebarShellActions, routeId: SidebarRouteId) => {
      actionsRef.current = actions;

      // Only the destination route may clear the enter gate.
      const pending = pendingEnterRef.current;
      if (pending && pending.routeId === routeId) {
        pending.focusReady = true;
        if (pathnameToRouteId(pathnameRef.current) === routeId) {
          pending.pathnameReady = true;
        }
        tryStartEnterSlideRef.current();
      }

      return () => {
        if (actionsRef.current === actions) {
          actionsRef.current = {};
        }
      };
    },
    []
  );

  const handleNewChat = useCallback(() => {
    startNew(false);
    const onNewChat = actionsRef.current.onNewChat;
    if (onNewChat) {
      onNewChat();
      return;
    }
    navigate('chat');
  }, [navigate, startNew]);

  const handleSelectPinned = useCallback(
    (sessionId: string) => {
      close();
      navigate('chat');
      void openSession(sessionId);
    },
    [close, navigate, openSession],
  );

  const handleSelectRecent = useCallback(
    (sessionId: string) => {
      close();
      navigate('chat');
      void openSession(sessionId);
    },
    [close, navigate, openSession],
  );

  const handlePinChat = useCallback(
    (sessionId: string) => {
      void pinSession(sessionId);
    },
    [pinSession],
  );

  const handleUnpinChat = useCallback(
    (sessionId: string) => {
      void unpinSession(sessionId);
    },
    [unpinSession],
  );

  const handleDeleteRecent = useCallback(
    (sessionId: string) => {
      void deleteSession(sessionId);
    },
    [deleteSession],
  );

  const pinned = useMemo(() => {
    const sessionMap = new Map(sessions.map((s) => [s.id, s]));
    const list: { id: string; title: string }[] = [];
    for (const id of pinnedSessionIds) {
      const session = sessionMap.get(id);
      if (session) {
        list.push({
          id: session.id,
          title: session.title?.trim() || 'New chat',
        });
      }
    }
    return list;
  }, [sessions, pinnedSessionIds]);

  const recents = useMemo(() => {
    const pinnedSet = new Set(pinnedSessionIds);
    return sessions
      .filter((session) => !pinnedSet.has(session.id))
      .map((session) => ({
        id: session.id,
        title: session.title?.trim() || 'New chat',
      }));
  }, [sessions, pinnedSessionIds]);
  const openSettings = useCallback(() => {
    setShowSettingsSheet(true);
  }, []);

  const handleSettingsPress = useCallback(() => {
    openSettings();
    actionsRef.current.onSettingsPress?.();
  }, [openSettings]);
  const value = useMemo<SidebarShellContextValue>(
    () => ({
      isOpen,
      open,
      close,
      navigate,
      openSettings,
      registerActions,
    }),
    [isOpen, open, close, navigate, openSettings, registerActions]
  );

  const styles = useThemedStyles(colors, (c) => ({
    root: {
      flex: 1,
      backgroundColor: c.sidebar.background,
    },
    mainSurface: {
      flex: 1,
      overflow: 'visible' as const,
      zIndex: SidebarTokens.zIndex.surface,
    },
    mainSurfaceClosed: {
      elevation: 0,
      shadowOpacity: 0,
    },
    mainSurfaceContent: {
      flex: 1,
      overflow: 'hidden' as const,
    },
    overlay: {
      position: 'absolute' as const,
      top: 0,
      bottom: 0,
      left: DRAWER_WIDTH,
      right: 0,
      backgroundColor: 'transparent',
      zIndex: SidebarTokens.zIndex.overlay,
      elevation: SidebarTokens.zIndex.overlay,
    },
  }));

  const animatedCardSurface = useMemo(() => {
    return translateX.interpolate({
      inputRange: [0, DRAWER_WIDTH],
      outputRange: [colors.colors.background, colors.sidebar.surface],
      extrapolate: 'clamp',
    });
  }, [colors.colors.background, colors.sidebar.surface, translateX]);

  return (
    <SidebarShellContext.Provider value={value}>
      <View style={styles.root} testID="sidebar-shell">
        <SidebarDrawer
          isOpen={isOpen}
          onClose={close}
          onSelectNav={navigate}
          onSelectPinned={handleSelectPinned}
          onSelectRecent={handleSelectRecent}
          pinned={pinned}
          recents={recents}
          onPinChat={handlePinChat}
          onUnpinChat={handleUnpinChat}
          onDeleteRecent={handleDeleteRecent}
          onNewChat={handleNewChat}
          onSettingsPress={handleSettingsPress}
          testID="main-chat-screen-sidebar"
        />

        <Animated.View
          style={[
            styles.mainSurface,
            {
              backgroundColor: animatedCardSurface,
              transform: [{ translateX }],
              borderRadius,
              opacity: contentOpacity,
            },
            isOpen ? SidebarTokens.surfaceShadow[colors.scheme] : styles.mainSurfaceClosed,
          ]}
        >
          <Animated.View
            style={[
              styles.mainSurfaceContent,
              {
                backgroundColor: animatedCardSurface,
                borderRadius,
              },
            ]}
          >
            {children}
          </Animated.View>
        </Animated.View>

        {isOpen && !isTransitioning ? (
          <Pressable
            style={styles.overlay}
            onPress={close}
            testID="main-chat-screen-sidebar-overlay"
          />
        ) : null}

        <SearchModal
          isVisible={isSearchVisible}
          onClose={() => setIsSearchVisible(false)}
        />

        <SettingsSheet
          isVisible={showSettingsSheet}
          onClose={() => {
            setShowSettingsSheet(false);
            setShowPersonalizationSheet(false);
            setShowMemorySheet(false);
            setShowMemorySummarySheet(false);
            setShowAboutSheet(false);
            setShowReportAppIssueSheet(false);
            setShowUpgradeSheet(false);
          }}
          onPersonalizationPress={() => setShowPersonalizationSheet(true)}
          onMemoryPress={() => setShowMemorySheet(true)}
          onAboutPress={() => setShowAboutSheet(true)}
          onReportPress={() => setShowReportAppIssueSheet(true)}
          onUpgradePress={() => setShowUpgradeSheet(true)}
          onPluginsPress={() => {
            setShowSettingsSheet(false);
            navigate('plugins');
          }}
          testID="main-chat-screen-settings-sheet"
        />

        <ConnectedPersonalizationSheet
          isVisible={showPersonalizationSheet}
          onClose={() => setShowPersonalizationSheet(false)}
          testID="main-chat-screen-personalization-sheet"
        />

        <ConnectedMemorySheet
          isVisible={showMemorySheet}
          onClose={() => {
            setShowMemorySheet(false);
            setShowMemorySummarySheet(false);
          }}
          onMemorySummaryPress={() => setShowMemorySummarySheet(true)}
          testID="main-chat-screen-memory-sheet"
        />

        <ConnectedMemorySummarySheet
          isVisible={showMemorySummarySheet}
          onClose={() => setShowMemorySummarySheet(false)}
          testID="main-chat-screen-memory-summary-sheet"
        />

        <AboutSheet
          isVisible={showAboutSheet}
          onClose={() => setShowAboutSheet(false)}
          testID="main-chat-screen-about-sheet"
        />

        <ConnectedReportAppIssueSheet
          isVisible={showReportAppIssueSheet}
          onClose={() => setShowReportAppIssueSheet(false)}
          testID="main-chat-screen-report-app-issue-sheet"
        />

        <UpgradeSheet
          isVisible={showUpgradeSheet}
          onClose={() => setShowUpgradeSheet(false)}
          testID="main-chat-screen-upgrade-sheet"
        />
      </View>
    </SidebarShellContext.Provider>
  );
}

