import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { API_V1_BASE_URL } from '../../../lib/api/config';

WebBrowser.maybeCompleteAuthSession();

export const DEFAULT_GOOGLE_WEB_CLIENT_ID =
  '970789221887-q5acoua9prpstiedh4jcrcumlmpidqgv.apps.googleusercontent.com';
export const DEFAULT_GOOGLE_IOS_CLIENT_ID =
  '970789221887-tk7o8ehg91dc47m3t8cpegbni2rg428e.apps.googleusercontent.com';
export const DEFAULT_GOOGLE_ANDROID_CLIENT_ID =
  '970789221887-4burd4pfaqht0ir4b4ed0d7p773seprb.apps.googleusercontent.com';

export type GoogleAuthPayload = {
  exchangeCode?: string;
  idToken?: string;
  accessToken?: string;
};

export function buildGoogleAuthStartUrl(returnUrl: string): string {
  const params = new URLSearchParams({
    returnUrl,
  });
  return `${API_V1_BASE_URL}/auth/google/start?${params.toString()}`;
}

export function parseGoogleAuthCallbackUrl(url: string): { code?: string; error?: string } {
  try {
    const parsed = new URL(url);
    const code = parsed.searchParams.get('code') ?? undefined;
    const error = parsed.searchParams.get('error') ?? undefined;
    return { code, error };
  } catch {
    const queryIndex = url.indexOf('?');
    if (queryIndex === -1) {
      return {};
    }
    const queryString = url.slice(queryIndex + 1);
    const searchParams = new URLSearchParams(queryString);
    const code = searchParams.get('code') ?? undefined;
    const error = searchParams.get('error') ?? undefined;
    return { code, error };
  }
}

/**
 * Web-based OAuth flow using Expo WebBrowser & backend session mediation.
 * Used for Expo Go client and web environments.
 */
export async function promptGoogleAuthWeb(): Promise<GoogleAuthPayload> {
  const returnUrl = AuthSession.makeRedirectUri({
    scheme: 'joymobile',
    path: 'auth/callback',
  });

  const startUrl = buildGoogleAuthStartUrl(returnUrl);
  const result = await WebBrowser.openAuthSessionAsync(startUrl, returnUrl);

  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new Error('Google Sign-In was cancelled.');
  }

  if (result.type === 'success' && result.url) {
    const { code, error } = parseGoogleAuthCallbackUrl(result.url);
    if (error) {
      throw new Error(`Google Sign-In failed: ${error}`);
    }
    if (!code) {
      throw new Error('No authorization code returned from Google login.');
    }
    return { exchangeCode: code };
  }

  throw new Error('Unable to complete Google Sign-In.');
}

/**
 * Native Google Sign-In using @react-native-google-signin/google-signin.
 * Uses native Android Play Services and iOS Google Sign-In SDK.
 */
export async function promptGoogleAuthNative(): Promise<GoogleAuthPayload> {
  // Dynamic import prevents module initialization failure in Expo Go or non-native runtimes
  const { GoogleSignin, isErrorWithCode, statusCodes } = await import(
    '@react-native-google-signin/google-signin'
  );

  const webClientId =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ??
    DEFAULT_GOOGLE_WEB_CLIENT_ID;

  const iosClientId =
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? DEFAULT_GOOGLE_IOS_CLIENT_ID;

  GoogleSignin.configure({
    webClientId,
    iosClientId: Platform.OS === 'ios' ? iosClientId : undefined,
    offlineAccess: false,
  });

  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  try {
    const response = await GoogleSignin.signIn();
    if (response.type === 'cancelled') {
      throw new Error('Google Sign-In was cancelled.');
    }

    const userData = response.data;
    const idToken = userData?.idToken;
    if (!idToken) {
      throw new Error('No ID token returned from Google Sign-In.');
    }

    let accessToken: string | undefined;
    if (userData && 'accessToken' in userData && typeof userData.accessToken === 'string') {
      accessToken = userData.accessToken;
    }

    return {
      idToken,
      accessToken,
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'Google Sign-In was cancelled.') {
      throw error;
    }
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        throw new Error('Google Sign-In was cancelled.');
      }
      if (error.code === statusCodes.IN_PROGRESS) {
        throw new Error('Google Sign-In is already in progress.');
      }
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Google Play Services is not available or outdated.');
      }
    }
    throw error;
  }
}

/**
 * Universal Google Sign-In prompt.
 * Automatically selects Native Google Sign-In for dev/standalone builds,
 * and falls back to WebBrowser flow in Expo Go and test environments.
 */
export async function promptGoogleAuth(): Promise<GoogleAuthPayload> {
  const isExpoGo =
    Constants.appOwnership === 'expo' ||
    Constants.executionEnvironment === 'storeClient';

  if (!isExpoGo) {
    try {
      return await promptGoogleAuthNative();
    } catch (error) {
      if (error instanceof Error && error.message.includes('cancelled')) {
        throw error;
      }
      // Fall back to web auth if native module is unavailable
      return await promptGoogleAuthWeb();
    }
  }

  return promptGoogleAuthWeb();
}
