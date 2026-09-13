import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { Colors, Spacing } from '@/constants/theme';
import { useAuthSession } from '@/features/auth/presentation';
import { useColorScheme } from '@/hooks/use-color-scheme';

WebBrowser.maybeCompleteAuthSession();

export default function AuthCallbackRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; error?: string }>();
  const { loginGoogle } = useAuthSession();
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? Colors.dark : Colors.light;

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;

    let isMounted = true;
    let timer: NodeJS.Timeout | number | undefined;

    if (params.error) {
      handledRef.current = true;
      console.error('[AuthCallback] error:', params.error);
      setErrorMsg(params.error);
      timer = setTimeout(() => {
        if (isMounted) {
          router.replace('/auth');
        }
      }, 2500);
    } else if (params.code) {
      handledRef.current = true;
      const code = Array.isArray(params.code) ? params.code[0] : params.code;
      (async () => {
        try {
          await loginGoogle({ exchangeCode: code });
          if (isMounted) {
            router.replace('/chat');
          }
        } catch (err) {
          console.error('[AuthCallback] error:', err);
          if (isMounted) {
            const message = err instanceof Error ? err.message : 'Failed to complete sign in';
            setErrorMsg(message);
            timer = setTimeout(() => {
              if (isMounted) {
                router.replace('/auth');
              }
            }, 2500);
          }
        }
      })();
    } else {
      timer = setTimeout(() => {
        if (isMounted) {
          router.replace('/auth');
        }
      }, 1500);
    }

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [params.code, params.error, loginGoogle, router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {errorMsg ? (
        <>
          <Text style={[styles.errorText, { color: colors.badgeBackground ?? '#EF4444' }]}>
            {errorMsg}
          </Text>
          <Text style={[styles.text, { color: colors.textSecondary }]}>
            Redirecting to sign in...
          </Text>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color={colors.text} />
          <Text style={[styles.text, { color: colors.textSecondary }]}>
            Completing sign in...
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.two,
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
