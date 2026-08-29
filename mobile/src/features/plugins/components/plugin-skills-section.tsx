import { ChevronRight, Layers } from 'lucide-react-native';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { PluginsTokens } from '@/constants/theme';
export type SkillItem = {
  id: string;
  name: string;
};

export type PluginSkillsSectionProps = {
  /** List of granted or available skills for this plugin. */
  skills?: SkillItem[];
  /** Display variant: 'pills' for horizontal/wrap pills (default) or 'card' for list card. */
  variant?: 'pills' | 'card';
  /** Callback fired when a skill row or pill is pressed. */
  onSkillPress?: (id: string) => void;
  /** Custom style overrides for the section container. */
  style?: StyleProp<ViewStyle>;
  /** Optional testID for automated testing. */
  testID?: string;
};

const DEFAULT_SKILLS: SkillItem[] = [
  { id: 'whatsapp-send-messages', name: 'whatsapp-send-messages' },
  { id: 'whatsapp-read-chat', name: 'whatsapp-read-chat' },
  { id: 'whatsapp-voice-notes', name: 'whatsapp-voice-notes' },
  { id: 'whatsapp-send-media', name: 'whatsapp-send-media' },
  { id: 'whatsapp-automated-replies', name: 'whatsapp-automated-replies' },
  { id: 'whatsapp-manage-groups', name: 'whatsapp-manage-groups' },
];

export function PluginSkillsSection({
  skills = DEFAULT_SKILLS,
  variant = 'pills',
  onSkillPress,
  style,
  testID = 'plugin-skills-section',
}: PluginSkillsSectionProps) {
  const theme = useTheme();

  if (variant === 'card') {
    return (
      <View style={[styles.cardContainer, style]} testID={testID}>
        <Text style={[styles.cardHeaderText, { color: theme.textTitle }]} testID={`${testID}-header`}>
          Skills
        </Text>
        <View style={[styles.card, { backgroundColor: theme.cardBackground }]} testID={`${testID}-card`}>
          {skills.map((skill, index) => {
            const isLast = index === skills.length - 1;

            return (
              <React.Fragment key={skill.id}>
                {onSkillPress ? (
                  <Pressable
                    onPress={() => onSkillPress(skill.id)}
                    accessibilityRole="button"
                    accessibilityLabel={skill.name}
                    testID={`${testID}-item-${skill.id}`}
                    style={({ pressed }) => [
                      styles.cardRow,
                      pressed && [styles.rowPressed, { backgroundColor: theme.cardPressed }],
                    ]}
                  >
                    <View style={styles.leftContent}>
                      <Layers size={14} color={theme.textMuted} testID={`${testID}-item-${skill.id}-icon`} />
                      <Text
                        style={[styles.cardSkillName, { color: theme.text }]}
                        numberOfLines={1}
                        testID={`${testID}-item-${skill.id}-name`}
                      >
                        {skill.name}
                      </Text>
                    </View>

                    <ChevronRight
                      size={16}
                      color={theme.textSecondary}
                      testID={`${testID}-item-${skill.id}-chevron`}
                    />
                  </Pressable>
                ) : (
                  <View
                    testID={`${testID}-item-${skill.id}`}
                    style={styles.cardRow}
                  >
                    <View style={styles.leftContent}>
                      <Layers size={14} color={theme.textMuted} testID={`${testID}-item-${skill.id}-icon`} />
                      <Text
                        style={[styles.cardSkillName, { color: theme.text }]}
                        numberOfLines={1}
                        testID={`${testID}-item-${skill.id}-name`}
                      >
                        {skill.name}
                      </Text>
                    </View>
                  </View>
                )}
                {!isLast && (
                  <View
                    style={[styles.cardDivider, { backgroundColor: theme.divider }]}
                    testID={`${testID}-divider-${index}`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]} testID={testID}>
      <Text style={[styles.headerText, { color: theme.textTitle }]} testID={`${testID}-header`}>
        Skills
      </Text>
      <View style={styles.skillsContainer} testID={`${testID}-list`}>
        {skills.map((skill) => {
          const content = (
            <>
              <Layers size={14} color={theme.textMuted} testID={`${testID}-item-${skill.id}-icon`} />
              <Text
                style={[styles.skillName, { color: theme.text }]}
                numberOfLines={1}
                testID={`${testID}-item-${skill.id}-name`}
              >
                {skill.name}
              </Text>
            </>
          );

          if (onSkillPress) {
            return (
              <Pressable
                key={skill.id}
                onPress={() => onSkillPress(skill.id)}
                accessibilityRole="button"
                accessibilityLabel={skill.name}
                testID={`${testID}-item-${skill.id}`}
                style={({ pressed }) => [
                  styles.pill,
                  { backgroundColor: theme.backgroundElement },
                  pressed && styles.pillPressed,
                ]}
              >
                {content}
              </Pressable>
            );
          }

          return (
            <View
              key={skill.id}
              testID={`${testID}-item-${skill.id}`}
              style={[
                styles.pill,
                { backgroundColor: theme.backgroundElement },
              ]}
            >
              {content}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 354,
    flexDirection: 'column',
    gap: 12,
  },
  headerText: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
    color: PluginsTokens.colors.textPrimary,
  },
  skillsContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 12,
  },
  pill: {
    height: 30,
    borderRadius: 16,
    backgroundColor: '#F2F4F7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
    alignSelf: 'flex-start',
  },
  pillPressed: {
    opacity: 0.8,
    backgroundColor: '#E5E7EB',
  },
  skillName: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 14,
    color: '#334052',
  },
  // Card variant styles
  cardContainer: {
    width: '100%',
    maxWidth: PluginsTokens.skillsSection.width,
    flexDirection: 'column',
    gap: 6,
  },
  cardHeaderText: {
    fontSize: PluginsTokens.skillsSection.headerFontSize,
    fontWeight: '400',
    lineHeight: PluginsTokens.skillsSection.headerLineHeight,
    color: PluginsTokens.colors.textMuted,
  },
  card: {
    backgroundColor: PluginsTokens.colors.cardBackground,
    borderRadius: PluginsTokens.skillsSection.cardRadius,
    overflow: 'hidden',
  },
  cardRow: {
    height: PluginsTokens.skillsSection.rowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PluginsTokens.skillsSection.rowPaddingHorizontal,
  },
  rowPressed: {
    opacity: 0.7,
    backgroundColor: '#F5F5F7',
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  cardSkillName: {
    fontSize: PluginsTokens.skillsSection.rowFontSize,
    fontWeight: '400',
    lineHeight: PluginsTokens.skillsSection.rowLineHeight,
    color: PluginsTokens.colors.textPrimary,
    flex: 1,
    paddingRight: 12,
  },
  cardDivider: {
    height: 1,
    backgroundColor: PluginsTokens.colors.divider,
    marginLeft: PluginsTokens.skillsSection.dividerInsetLeft,
  },
});
