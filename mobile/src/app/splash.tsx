import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  SplashScreen,
  type SplashSection,
} from '@/features/splash/presentation/splash-screen/splash-screen';
const sections = new Set<SplashSection>(['expression', 'signature', 'full']);

export default function SplashPreviewRoute() {
  const colorScheme = useColorScheme();
  const { section } = useLocalSearchParams<{ section?: string | string[] }>();
  const requestedSection = Array.isArray(section) ? section[0] : section;
  const resolvedSection = sections.has(requestedSection as SplashSection)
    ? (requestedSection as SplashSection)
    : 'full';

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <SplashScreen exposeTestMetrics section={resolvedSection} />
    </>
  );
}
