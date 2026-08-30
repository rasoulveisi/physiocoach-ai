import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { colors } from '../../theme/colors';
import { fontSize, fontWeight } from '../../theme/typography';

export type ButtonVariant = 'volt' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}

interface VariantStyle {
  container: ViewStyle;
  textColor: string;
  spinnerColor: string;
}

const CONTAINER: Record<ButtonSize, ViewStyle> = {
  sm: { height: 38, paddingHorizontal: 14, borderRadius: 10 },
  md: { height: 48, paddingHorizontal: 20, borderRadius: 12 },
  lg: { height: 56, paddingHorizontal: 24, borderRadius: 14 },
};

const LABEL_SIZE: Record<ButtonSize, TextStyle> = {
  sm: { fontSize: fontSize.sm },
  md: { fontSize: fontSize.base },
  lg: { fontSize: fontSize.lg },
};

function variantStyle(variant: ButtonVariant): VariantStyle {
  switch (variant) {
    case 'volt':
      return {
        container: { backgroundColor: colors.accentVolt },
        textColor: colors.bgPrimary,
        spinnerColor: colors.bgPrimary,
      };
    case 'secondary':
      return {
        container: { backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.borderSubtle },
        textColor: colors.textPrimary,
        spinnerColor: colors.textPrimary,
      };
    case 'outline':
      return {
        container: {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: colors.accentVolt,
        },
        textColor: colors.accentVolt,
        spinnerColor: colors.accentVolt,
      };
    case 'ghost':
      return {
        container: { backgroundColor: 'transparent' },
        textColor: colors.textSecondary,
        spinnerColor: colors.textSecondary,
      };
    case 'danger':
      return {
        container: { backgroundColor: colors.accentRed },
        textColor: '#FFFFFF',
        spinnerColor: '#FFFFFF',
      };
  }
}

export function Button({
  label,
  onPress,
  variant = 'volt',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const style = variantStyle(variant);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={label}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        CONTAINER[size],
        style.container,
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={style.spinnerColor} />
      ) : (
        <View style={styles.row}>
          <Text style={[styles.label, LABEL_SIZE[size], { color: style.textColor }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.3,
  },
});

export default Button;
