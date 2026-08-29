import { createContext, useContext } from 'react';

export type SidebarRouteId = 'robot' | 'scheduled' | 'plugins' | 'chat';

export type SidebarShellActions = {
  onNewChat?: () => void;
  onSettingsPress?: () => void;
};

export type SidebarShellContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  navigate: (routeId: string) => void;
  openSettings: () => void;
  registerActions: (
    actions: SidebarShellActions,
    routeId: SidebarRouteId
  ) => () => void;
};

export const SidebarShellContext = createContext<SidebarShellContextValue | null>(
  null
);

export function useSidebarShell(): SidebarShellContextValue {
  const value = useContext(SidebarShellContext);
  if (!value) {
    throw new Error('useSidebarShell must be used within SidebarShell');
  }
  return value;
}
