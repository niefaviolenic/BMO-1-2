import { Image } from 'expo-image';
import { RefreshCw } from 'lucide-react-native';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { useTheme } from '@/hooks/use-theme';
import { QRCodeDisplayBoxTokens as Tokens } from '@/constants/theme';
import {
  DEFAULT_WHATSAPP_QR_TTL_SECONDS,
  classifyQrPayload,
} from '@/features/plugins/domain/whatsapp';
export type QRCodeDisplayBoxProps = {
  /** Remaining seconds until the QR expires. Renders as "EXPIRES IN MM:SS". */
  expiresInSeconds?: number;
  /** Explicitly marks the QR as expired when countdown reaches zero. */
  isExpired?: boolean;
  /** Live QR payload from the backend. Placeholder graphic is used when empty. */
  qrValue?: string | null;
  waitingLabel?: string;
  /** Callback to reload/regenerate a fresh QR code session. */
  onRefresh?: () => void;
  /** Indicates active refresh/connect request is in progress. */
  isRefreshing?: boolean;
  /** Optional robot screen mirror state. */
  robotSync?: { online: boolean; name: string } | null;
  /** Custom style overrides for the card container. */
  style?: StyleProp<ViewStyle>;
  /** Optional testID for automated testing. */
  testID?: string;
};

const DEFAULT_EXPIRES_IN_SECONDS = DEFAULT_WHATSAPP_QR_TTL_SECONDS; // 00:25

/**
 * Formats raw seconds into "MM:SS" string.
 */
function formatTime(seconds: number): string {
  const m = Math.floor(Math.max(seconds, 0) / 60);
  const s = Math.max(seconds, 0) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

type ModuleSpec = { top: number; left: number };

/** Stylized QR module positions matching Figma 611:134867 (relative to 180 box). */
const QR_MODULES: ModuleSpec[] = [
  { top: 15, left: 67 },
  { top: 15, left: 83 },
  { top: 15, left: 95 },
  { top: 31, left: 67 },
  { top: 39, left: 83 },
  { top: 31, left: 99 },
  { top: 67, left: 15 },
  { top: 67, left: 31 },
  { top: 67, left: 47 },
  { top: 67, left: 67 },
  { top: 67, left: 87 },
  { top: 67, left: 107 },
  { top: 67, left: 127 },
  { top: 67, left: 147 },
  { top: 87, left: 23 },
  { top: 87, left: 39 },
  { top: 87, left: 59 },
  { top: 87, left: 79 },
  { top: 87, left: 99 },
  { top: 87, left: 119 },
  { top: 87, left: 139 },
  { top: 107, left: 67 },
  { top: 107, left: 87 },
  { top: 107, left: 107 },
  { top: 107, left: 127 },
  { top: 107, left: 147 },
  { top: 127, left: 67 },
  { top: 127, left: 83 },
  { top: 127, left: 99 },
  { top: 127, left: 123 },
  { top: 127, left: 139 },
  { top: 147, left: 67 },
  { top: 147, left: 87 },
  { top: 147, left: 107 },
  { top: 147, left: 127 },
  { top: 147, left: 143 },
];

function FinderPattern({ top, left }: { top: number; left: number }) {
  const midOffset =
    (Tokens.qrBox.finderOuterSize - Tokens.qrBox.finderMidSize) / 2;
  const innerOffset =
    (Tokens.qrBox.finderOuterSize - Tokens.qrBox.finderInnerSize) / 2;

  return (
    <View style={[styles.finderOuter, { top, left }]}>
      <View style={[styles.finderMid, { top: midOffset, left: midOffset }]} />
      <View
        style={[styles.finderInner, { top: innerOffset, left: innerOffset }]}
      />
    </View>
  );
}

/**
 * QRCodeDisplayBox
 *
 * Card showing a WhatsApp QR placeholder graphic with a red expiry badge.
 * Dimensions: width 354, minHeight 260 (Figma 611:134862).
 */
export function QRCodeDisplayBox({
  expiresInSeconds = DEFAULT_EXPIRES_IN_SECONDS,
  isExpired = false,
  qrValue = null,
  waitingLabel = 'Waiting for WhatsApp QR…',
  onRefresh,
  isRefreshing = false,
  robotSync = null,
  style,
  testID = 'qr-code-display-box',
}: QRCodeDisplayBoxProps) {
  const theme = useTheme();
  const ttl = expiresInSeconds ?? DEFAULT_EXPIRES_IN_SECONDS;
  const formattedTime = useMemo(() => formatTime(ttl), [ttl]);
  const qrKind = classifyQrPayload(qrValue ?? null);
  const isMirrored = Boolean(robotSync?.online && qrKind !== 'empty' && !isExpired);
  const robotName = robotSync?.name?.trim() || 'Joy Robot';

  const finderInset = Tokens.qrBox.finderInset;
  const farFinder =
    Tokens.layout.qrSize -
    Tokens.qrBox.finderInset -
    Tokens.qrBox.finderOuterSize;

  const showWaiting = isRefreshing || (qrKind === 'empty' && !isExpired);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
        },
        style,
      ]}
      testID={testID}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.headerLabel, { color: theme.textSecondary }]} testID={`${testID}-header-label`}>
          WHATSAPP QR CODE
        </Text>

        <View
          style={[
            styles.timerBadge,
            {
              backgroundColor: isExpired
                ? Tokens.colors.expiredBadgeBackground
                : theme.backgroundElement,
              borderColor: isExpired
                ? Tokens.colors.expiredBadgeBorder
                : theme.border,
            },
          ]}
          testID={`${testID}-timer-badge`}
        >
          <Text
            style={[
              styles.timerText,
              {
                color: isExpired
                  ? Tokens.colors.expiredBadgeText
                  : theme.textSecondary,
              },
            ]}
            testID={`${testID}-timer-text`}
          >
            {isExpired ? 'EXPIRED' : qrKind === 'empty' ? 'WAITING' : `EXPIRES IN ${formattedTime}`}
          </Text>
        </View>
      </View>

      {isMirrored ? (
        <View
          style={styles.mirrorBadge}
          testID={`${testID}-mirror-badge`}
          accessibilityRole="text"
          accessibilityLabel={`QR code is also displayed on your ${robotName} screen`}
        >
          <View style={styles.mirrorDot} testID={`${testID}-mirror-dot`} />
          <Text
            style={styles.mirrorText}
            testID={`${testID}-mirror-text`}
            numberOfLines={1}
          >
            {`MIRRORED TO ${robotName.toUpperCase()}`}
          </Text>
        </View>
      ) : null}

      <View style={styles.qrBox} testID={`${testID}-qr-box`}>
        {qrKind === 'text' && qrValue ? (
          <View style={styles.qrLive}>
            <QRCode value={qrValue} size={Tokens.layout.qrSize - 16} />
          </View>
        ) : null}

        {qrKind === 'image' && qrValue ? (
          <Image
            source={{ uri: qrValue }}
            style={styles.qrImage}
            contentFit="contain"
            accessibilityLabel="WhatsApp QR code"
          />
        ) : null}

        {showWaiting ? (
          <>
            <FinderPattern top={finderInset} left={finderInset} />
            <FinderPattern top={finderInset} left={farFinder} />
            <FinderPattern top={farFinder} left={finderInset} />

            {QR_MODULES.map((module, index) => (
              <View
                key={`qr-module-${index}`}
                style={[
                  styles.qrModule,
                  { top: module.top, left: module.left },
                ]}
              />
            ))}
            <View style={styles.waitingOverlay} pointerEvents="none">
              <ActivityIndicator
                size="small"
                color={Tokens.colors.qrPlaceholderFill}
                style={styles.waitingSpinner}
                testID={`${testID}-waiting-spinner`}
              />
              <Text style={styles.waitingText}>{waitingLabel}</Text>
            </View>
          </>
        ) : null}

        {isExpired && !isRefreshing ? (
          <Pressable
            style={styles.expiredOverlay}
            onPress={onRefresh}
            accessibilityRole="button"
            accessibilityLabel="QR code expired. Tap to reload."
            testID={`${testID}-expired-overlay`}
          >
            <View
              style={[
                styles.reloadBadgeButton,
                { backgroundColor: theme.buttonPrimaryBackground },
              ]}
            >
              <RefreshCw
                size={14}
                color={theme.buttonPrimaryText}
                testID={`${testID}-reload-icon`}
              />
              <Text style={[styles.reloadBadgeText, { color: theme.buttonPrimaryText }]}>Reload QR Code</Text>
            </View>
            <Text style={styles.expiredHintText}>
              QR code expired. Tap to reload.
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: Tokens.layout.width,
    maxWidth: '100%',
    minHeight: Tokens.layout.height,
    backgroundColor: Tokens.colors.cardBackground,
    borderRadius: Tokens.layout.borderRadius,
    borderWidth: 1,
    borderColor: Tokens.colors.cardBorder,
    padding: Tokens.layout.padding,
    gap: Tokens.layout.gap,
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: Tokens.header.rowHeight,
    width: '100%',
  },
  headerLabel: {
    fontSize: Tokens.header.fontSize,
    fontWeight: Tokens.header.fontWeight,
    color: Tokens.colors.headerLabel,
    letterSpacing: Tokens.header.letterSpacing,
  },
  timerBadge: {
    backgroundColor: Tokens.colors.timerBadgeBackground,
    borderRadius: Tokens.timerBadge.borderRadius,
    borderWidth: Tokens.timerBadge.borderWidth,
    borderColor: Tokens.colors.timerBadgeBorder,
    paddingHorizontal: Tokens.timerBadge.paddingHorizontal,
    paddingVertical: Tokens.timerBadge.paddingVertical,
    overflow: 'hidden',
  },
  timerBadgeExpired: {
    backgroundColor: Tokens.colors.expiredBadgeBackground,
    borderColor: Tokens.colors.expiredBadgeBorder,
  },
  timerText: {
    fontSize: Tokens.timerBadge.fontSize,
    fontWeight: Tokens.timerBadge.fontWeight,
    color: Tokens.colors.timerBadgeText,
  },
  timerTextExpired: {
    color: Tokens.colors.expiredBadgeText,
  },
  mirrorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Tokens.colors.mirrorBadgeBackground,
    borderRadius: Tokens.mirrorBadge.borderRadius,
    borderWidth: Tokens.mirrorBadge.borderWidth,
    borderColor: Tokens.colors.mirrorBadgeBorder,
    paddingHorizontal: Tokens.mirrorBadge.paddingHorizontal,
    paddingVertical: Tokens.mirrorBadge.paddingVertical,
    gap: 6,
    alignSelf: 'center',
  },
  mirrorDot: {
    width: Tokens.mirrorBadge.dotSize,
    height: Tokens.mirrorBadge.dotSize,
    borderRadius: Tokens.mirrorBadge.dotSize / 2,
    backgroundColor: Tokens.colors.mirrorDot,
  },
  mirrorText: {
    fontSize: Tokens.mirrorBadge.fontSize,
    fontWeight: Tokens.mirrorBadge.fontWeight,
    color: Tokens.colors.mirrorBadgeText,
    letterSpacing: Tokens.mirrorBadge.letterSpacing,
  },
  qrBox: {
    width: Tokens.layout.qrSize,
    height: Tokens.layout.qrSize,
    backgroundColor: Tokens.colors.qrBoxBackground,
    borderRadius: Tokens.qrBox.borderRadius,
    borderWidth: Tokens.qrBox.borderWidth,
    borderColor: Tokens.colors.qrBoxBorder,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrLive: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrImage: {
    width: Tokens.layout.qrSize,
    height: Tokens.layout.qrSize,
  },
  waitingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    paddingHorizontal: 12,
    gap: 6,
  },
  waitingSpinner: {
    marginBottom: 4,
  },
  waitingText: {
    fontSize: 12,
    fontWeight: '600',
    color: Tokens.colors.headerLabel,
    textAlign: 'center',
  },
  expiredOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Tokens.colors.reloadOverlayBackground,
    paddingHorizontal: 16,
    gap: 8,
  },
  reloadBadgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Tokens.colors.reloadButtonBackground,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  reloadBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Tokens.colors.reloadButtonText,
  },
  expiredHintText: {
    fontSize: 11,
    fontWeight: '500',
    color: Tokens.colors.reloadHintText,
    textAlign: 'center',
  },
  finderOuter: {
    position: 'absolute',
    width: Tokens.qrBox.finderOuterSize,
    height: Tokens.qrBox.finderOuterSize,
    borderRadius: Tokens.qrBox.finderOuterRadius,
    backgroundColor: Tokens.colors.qrPlaceholderFill,
  },
  finderMid: {
    position: 'absolute',
    width: Tokens.qrBox.finderMidSize,
    height: Tokens.qrBox.finderMidSize,
    borderRadius: Tokens.qrBox.finderMidRadius,
    backgroundColor: Tokens.colors.qrPlaceholderInset,
  },
  finderInner: {
    position: 'absolute',
    width: Tokens.qrBox.finderInnerSize,
    height: Tokens.qrBox.finderInnerSize,
    borderRadius: Tokens.qrBox.finderInnerRadius,
    backgroundColor: Tokens.colors.qrPlaceholderFill,
  },
  qrModule: {
    position: 'absolute',
    width: Tokens.qrBox.moduleSize,
    height: Tokens.qrBox.moduleSize,
    borderRadius: Tokens.qrBox.moduleRadius,
    backgroundColor: Tokens.colors.qrPlaceholderFill,
  },
});
