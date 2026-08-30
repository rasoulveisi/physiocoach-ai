import React from 'react';
import { StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { fontSize, fontWeight } from '../../theme/typography';

export type BadgeVariant = 'volt' | 'amber' | 'cyan' | 'zinc';

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const VARIANTS: Record<BadgeVariant, { bg: string; text: string }> = {
  volt: { bg: 'rgba(16, 231, 96, 0.15)', text: colors.accentVolt },
  amber: { bg: 'rgba(245, 158, 11, 0.15)', text: colors.accentAmber },
  cyan: { bg: 'rgba(6, 182, 212, 0.15)', text: colors.accentCyan },
  zinc: { bg: 'rgba(148, 163, 184, 0.12)', text: colors.textSecondary },
};

export function Badge({ label, variant = 'volt' }: BadgeProps) {
  const v = VARIANTS[variant];
  return (
    <View style={[styles.pill, { backgroundColor: v.bg }]}>
      <Text style={[styles.text, { color: v.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  } as ViewStyle,
  text: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  } as TextStyle,
});

export default Badge;
