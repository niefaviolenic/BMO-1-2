import { Stack } from 'expo-router';

import { SidebarShell } from '@/features/chat/presentation/sidebar-shell';

export default function MainLayout() {
  return (
    <SidebarShell>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'none',
          freezeOnBlur: true,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Stack.Screen name="chat" />
        <Stack.Screen name="robot" />
        <Stack.Screen name="schedule" />
        <Stack.Screen name="plugins" />
      </Stack>
    </SidebarShell>
  );
}
