import { TextStyle, ViewStyle, StyleSheet } from 'react-native';
import { colors } from './colors';
import { textStyles } from './typography';

/**
 * Aggregated theme object for convenient access in components.
 * Usage: const theme = useTheme();
 */
export const theme = {
  colors,
  typography: textStyles,
} as const;

/** Helper: compose text style variants with an override color. */
export function textStyle(
  variant: keyof typeof textStyles,
  color: string = colors.textPrimary,
): TextStyle {
  return { ...textStyles[variant], color };
}

/** Helper: standard surface card style. */
export function surface(radius: number = 16): ViewStyle {
  return {
    backgroundColor: colors.bgSurface,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  };
}

export const layout = StyleSheet.create({
  screenPadding: { paddingHorizontal: 20 },
  gapSm: { height: 8 },
  gapMd: { height: 12 },
  gapLg: { height: 16 },
  gapXl: { height: 24 },
});

export default theme;
