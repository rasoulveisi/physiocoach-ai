/**
 * PhysioCoach AI — Precision Dark Theme
 * Core color palette. Deep black canvas with volt-green accent.
 */

export const colors = {
  // Backgrounds
  bgPrimary: '#090D15', // Deep Black Canvas — app background
  bgSurface: '#121722', // Card / Surface
  bgElevated: '#182030', // Modal / Dropdown / Floating HUD

  // Borders
  borderSubtle: 'rgba(255, 255, 255, 0.08)',

  // Accents
  accentVolt: '#10E760', // Primary Action & Completed States
  accentAmber: '#F59E0B', // Warning / Moderate Effort
  accentCyan: '#06B6D4', // Telemetry & Stats
  accentRed: '#EF4444', // Pain Alert / Deload Indicator

  // Text
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
} as const;

export type ColorToken = keyof typeof colors;

/** Semantic aliases for common use-cases. */
export const semantic = {
  background: colors.bgPrimary,
  surface: colors.bgSurface,
  elevated: colors.bgElevated,
  border: colors.borderSubtle,
  primary: colors.accentVolt,
  warning: colors.accentAmber,
  info: colors.accentCyan,
  danger: colors.accentRed,
  text: colors.textPrimary,
  textSubtle: colors.textSecondary,
  textFaint: colors.textMuted,
} as const;

export default colors;
