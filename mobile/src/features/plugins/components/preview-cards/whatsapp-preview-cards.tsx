import { CheckCheck, Check, Mic, ShieldCheck, Sparkles } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PluginBrandLogo } from '@/features/plugins/components/plugin-brand-logo';
import { PluginsTokens } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function WhatsAppPreviewCardChat({ testID = 'whatsapp-preview-card-chat' }: { testID?: string }) {
  const theme = useTheme();

  return (
    <View style={[styles.cardContent, { backgroundColor: theme.backgroundElement }]} testID={testID}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.headerTitleRow}>
          <PluginBrandLogo pluginId="whatsapp" size={18} />
          <Text style={[styles.cardHeaderTitle, { color: theme.textTitle }]}>Direct Chat</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: 'rgba(37, 211, 102, 0.15)' }]}>
          <View style={[styles.statusDot, { backgroundColor: PluginsTokens.colors.iconWhatsApp }]} />
          <Text style={[styles.statusBadgeText, { color: PluginsTokens.colors.iconWhatsApp }]}>Active</Text>
        </View>
      </View>

      {/* Chat Messages */}
      <View style={styles.chatContainer}>
        {/* User Incoming Bubble */}
        <View style={[styles.incomingBubble, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <Text style={[styles.bubbleAuthor, { color: theme.textMuted }]}>You</Text>
          <Text style={[styles.bubbleText, { color: theme.textTitle }]}>
            Hey Joy, send meeting notes to Sarah on WhatsApp.
          </Text>
          <Text style={[styles.bubbleTime, { color: theme.textMuted }]}>10:24 AM</Text>
        </View>

        {/* Joy Outgoing Bubble */}
        <View style={[styles.outgoingBubble, { backgroundColor: 'rgba(37, 211, 102, 0.12)', borderColor: 'rgba(37, 211, 102, 0.3)' }]}>
          <View style={styles.joyAuthorRow}>
            <Text style={[styles.bubbleAuthor, { color: PluginsTokens.colors.iconWhatsApp }]}>Joy Assistant</Text>
            <Sparkles size={11} color={PluginsTokens.colors.iconWhatsApp} />
          </View>
          <Text style={[styles.bubbleText, { color: theme.textTitle }]}>
            Sent! Summary: &apos;Q3 sprint roadmap confirmed & ready for kickoff.&apos;
          </Text>
          <View style={styles.outgoingFooter}>
            <Text style={[styles.bubbleTime, { color: theme.textMuted }]}>10:24 AM</Text>
            <CheckCheck size={13} color={PluginsTokens.colors.iconWhatsApp} />
          </View>
        </View>
      </View>

      {/* Mini Input Mockup */}
      <View style={[styles.inputMockup, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <Text style={[styles.inputPlaceholder, { color: theme.textMuted }]}>Ask Joy / WhatsApp...</Text>
        <View style={[styles.sendBtnSmall, { backgroundColor: PluginsTokens.colors.iconWhatsApp }]}>
          <Mic size={11} color="#FFFFFF" />
        </View>
      </View>
    </View>
  );
}

export function WhatsAppPreviewCardVoice({ testID = 'whatsapp-preview-card-voice' }: { testID?: string }) {
  const theme = useTheme();

  return (
    <View style={[styles.cardContent, { backgroundColor: theme.backgroundElement }]} testID={testID}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.headerTitleRow}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(37, 211, 102, 0.15)' }]}>
            <Mic size={12} color={PluginsTokens.colors.iconWhatsApp} />
          </View>
          <Text style={[styles.cardHeaderTitle, { color: theme.textTitle }]}>Voice Transcribe</Text>
        </View>
      </View>

      {/* Voice Player Mockup */}
      <View style={[styles.voicePlayerBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <View style={styles.voicePlayerTop}>
          <View style={[styles.playBtnSmall, { backgroundColor: PluginsTokens.colors.iconWhatsApp }]}>
            <View style={styles.playTriangle} />
          </View>
          <View style={styles.waveformContainer}>
            {[8, 14, 20, 10, 18, 24, 16, 12, 22, 14, 8, 18, 12].map((height, i) => (
              <View
                key={i}
                style={[
                  styles.waveformBar,
                  {
                    height,
                    backgroundColor: i < 7 ? PluginsTokens.colors.iconWhatsApp : theme.border,
                  },
                ]}
              />
            ))}
          </View>
        </View>
        <View style={styles.voicePlayerFooter}>
          <Text style={[styles.voiceDuration, { color: theme.textMuted }]}>0:18 / 0:42</Text>
          <Text style={[styles.voiceTag, { color: PluginsTokens.colors.iconWhatsApp }]}>Voice Note</Text>
        </View>
      </View>

      {/* Transcription Preview Box */}
      <View style={[styles.transcribeBox, { backgroundColor: 'rgba(37, 211, 102, 0.08)', borderColor: 'rgba(37, 211, 102, 0.25)' }]}>
        <View style={styles.joyAuthorRow}>
          <Sparkles size={11} color={PluginsTokens.colors.iconWhatsApp} />
          <Text style={[styles.transcribeLabel, { color: PluginsTokens.colors.iconWhatsApp }]}>AI Transcription</Text>
        </View>
        <Text style={[styles.transcribeQuote, { color: theme.textTitle }]} numberOfLines={3}>
          &ldquo;Let&apos;s finalize the deployment schedule before 4 PM today.&rdquo;
        </Text>
      </View>
    </View>
  );
}

export function WhatsAppPreviewCardPrivacy({ testID = 'whatsapp-preview-card-privacy' }: { testID?: string }) {
  const theme = useTheme();

  const contacts = [
    { name: 'Sarah Jenkins', role: 'Allowed Contact', initial: 'S', color: '#10B981' },
    { name: 'Engineering Group', role: 'Filtered Notifications', initial: 'E', color: '#3B82F6' },
    { name: 'Alex Rivera', role: 'Allowed Contact', initial: 'A', color: '#8B5CF6' },
  ];

  return (
    <View style={[styles.cardContent, { backgroundColor: theme.backgroundElement }]} testID={testID}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.headerTitleRow}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(37, 211, 102, 0.15)' }]}>
            <ShieldCheck size={12} color={PluginsTokens.colors.iconWhatsApp} />
          </View>
          <Text style={[styles.cardHeaderTitle, { color: theme.textTitle }]}>Privacy & Access</Text>
        </View>
      </View>

      {/* Allowed Contacts List */}
      <View style={styles.contactsList}>
        {contacts.map((contact, index) => (
          <View
            key={index}
            style={[styles.contactRow, { backgroundColor: theme.background, borderColor: theme.border }]}
          >
            <View style={[styles.contactAvatar, { backgroundColor: contact.color }]}>
              <Text style={styles.avatarText}>{contact.initial}</Text>
            </View>
            <View style={styles.contactInfo}>
              <Text style={[styles.contactName, { color: theme.textTitle }]} numberOfLines={1}>
                {contact.name}
              </Text>
              <Text style={[styles.contactRole, { color: theme.textMuted }]} numberOfLines={1}>
                {contact.role}
              </Text>
            </View>
            <View style={[styles.checkCircle, { backgroundColor: 'rgba(37, 211, 102, 0.15)' }]}>
              <Check size={10} color={PluginsTokens.colors.iconWhatsApp} />
            </View>
          </View>
        ))}
      </View>

      {/* Security Badge */}
      <View style={[styles.securityBadge, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <ShieldCheck size={11} color={theme.textSecondary} />
        <Text style={[styles.securityBadgeText, { color: theme.textSecondary }]}>
          Encrypted & Permission Bound
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContent: {
    flex: 1,
    padding: 14,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  iconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatContainer: {
    gap: 8,
    marginVertical: 4,
  },
  incomingBubble: {
    padding: 8,
    borderRadius: 10,
    borderTopLeftRadius: 2,
    borderWidth: 1,
    maxWidth: '92%',
    alignSelf: 'flex-start',
  },
  outgoingBubble: {
    padding: 8,
    borderRadius: 10,
    borderTopRightRadius: 2,
    borderWidth: 1,
    maxWidth: '92%',
    alignSelf: 'flex-end',
  },
  bubbleAuthor: {
    fontSize: 9,
    fontWeight: '600',
    marginBottom: 2,
  },
  joyAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  bubbleText: {
    fontSize: 11,
    lineHeight: 14,
  },
  bubbleTime: {
    fontSize: 8,
    marginTop: 2,
    alignSelf: 'flex-end',
  },
  outgoingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    marginTop: 2,
  },
  inputMockup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  inputPlaceholder: {
    fontSize: 10,
  },
  sendBtnSmall: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voicePlayerBox: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  voicePlayerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playBtnSmall: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderLeftColor: '#FFFFFF',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 2,
  },
  waveformContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 24,
  },
  waveformBar: {
    width: 3,
    borderRadius: 1.5,
  },
  voicePlayerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  voiceDuration: {
    fontSize: 9,
    fontWeight: '500',
  },
  voiceTag: {
    fontSize: 9,
    fontWeight: '600',
  },
  transcribeBox: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  transcribeLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  transcribeQuote: {
    fontSize: 11,
    fontStyle: 'italic',
    lineHeight: 15,
  },
  contactsList: {
    gap: 6,
    marginVertical: 4,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  contactAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 10,
    fontWeight: '600',
  },
  contactRole: {
    fontSize: 8,
  },
  checkCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  securityBadgeText: {
    fontSize: 9,
    fontWeight: '500',
  },
});
