/**
 * PhysioCoach AI — Typography scale.
 * System font stack (SF Pro / Roboto). Sizes in dp, line heights matched
 * for a dense, technical "precision instrument" feel.
 */

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 30,
  display: 36,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
} as const;

export const lineHeight = {
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
} as const;

/** Pre-composed text styles for common roles. */
export const textStyles = {
  display: {
    fontSize: fontSize.display,
    fontWeight: fontWeight.heavy,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  h1: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  h2: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  h3: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    lineHeight: 24,
  },
  body: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.regular,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.regular,
    lineHeight: 22,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  caption: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.regular,
    lineHeight: 16,
  },
  overline: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    lineHeight: 16,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
  mono: {
    fontFamily: undefined, // platform monospace resolved at usage site if needed
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
} as const;

export type TextStyleVariant = keyof typeof textStyles;

export default textStyles;
