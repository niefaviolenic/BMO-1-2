import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type {
  AboutInfo,
  AboutLegalUrls,
} from '@/features/settings/domain/about/types';

export const ABOUT_LEGAL_URLS: AboutLegalUrls = {
  termsUrl: 'https://joy.ai/terms',
  privacyUrl: 'https://joy.ai/privacy',
};

const FALLBACK_VERSION = '1.0.0';
const FALLBACK_BUILD = '1';

function resolveVersionLabel(): string {
  const version =
    Constants.expoConfig?.version ??
    Constants.nativeApplicationVersion ??
    FALLBACK_VERSION;
  const build =
    Constants.expoConfig?.ios?.buildNumber ??
    Constants.expoConfig?.android?.versionCode?.toString() ??
    Constants.nativeBuildVersion ??
    FALLBACK_BUILD;

  return `${version} (${build})`;
}

export function getDefaultAboutInfo(): AboutInfo {
  const platformLabel =
    Platform.OS === 'ios' ? 'Joy for iOS' : 'Joy for Android';

  return {
    platformLabel,
    versionLabel: resolveVersionLabel(),
  };
}

export const DEFAULT_ABOUT_INFO: AboutInfo = getDefaultAboutInfo();
