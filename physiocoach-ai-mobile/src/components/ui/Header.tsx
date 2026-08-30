import React from 'react';
import { StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { colors } from '../../theme/colors';
import { fontSize, fontWeight } from '../../theme/typography';

export interface HeaderProps {
  title: string;
  subtitle?: string;
  /** Right-side slot: icon button, badge, etc. */
  rightAction?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Header({ title, subtitle, rightAction, style }: HeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.textBlock}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightAction ? <View style={styles.right}>{rightAction}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 16,
  },
  textBlock: {
    flex: 1,
    marginRight: 12,
  },
  right: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: fontSize.xxl,
    lineHeight: 30,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 4,
    fontSize: fontSize.sm,
    lineHeight: 18,
    color: colors.textSecondary,
  },
});

export default Header;
