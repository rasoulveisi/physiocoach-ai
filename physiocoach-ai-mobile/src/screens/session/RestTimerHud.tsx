import React from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Timer } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { fontSize, fontWeight } from '../../theme/typography';
import { formatCountdown } from './useRestTimer';
import type { TimerPhase } from './sessionTypes';

export interface RestTimerHudProps {
  phase: TimerPhase;
  remaining: number;
  duration: number;
  onAddSeconds: (seconds: number) => void;
  onSubtractSeconds: (seconds: number) => void;
  onSkip: () => void;
  onDismiss: () => void;
}

/**
 * Floating bottom HUD overlay for the active rest period.
 * Countdown + quick adjustments (+30s / −15s / Skip).
 */
export function RestTimerHud({
  phase,
  remaining,
  duration,
  onAddSeconds,
  onSubtractSeconds,
  onSkip,
  onDismiss,
}: RestTimerHudProps) {
  // Pulse animation while the timer runs; solid volt when done.
  const pulse = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (phase !== 'running') {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [phase, pulse]);

  if (phase === 'idle') return null;

  const done = phase === 'done';
  const progress = duration > 0 ? 1 - remaining / duration : 0;

  const borderColor = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(16, 231, 96, 0.35)', 'rgba(16, 231, 96, 0.9)'],
  });

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Animated.View style={[styles.hud, { borderColor }]}>
        <View style={styles.left}>
          <Timer size={18} color={done ? colors.accentVolt : colors.accentCyan} strokeWidth={2.2} />
          <View style={styles.leftText}>
            <Text style={styles.countdown}>{done ? 'GO!' : formatCountdown(remaining)}</Text>
            <Text style={styles.phaseLabel}>{done ? 'REST COMPLETE' : 'RESTING'}</Text>
          </View>
        </View>

        {/* Quick adjustments */}
        <View style={styles.controls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add 30 seconds"
            style={styles.chip}
            disabled={done}
            onPress={() => onAddSeconds(30)}
          >
            <Text style={[styles.chipText, done && styles.chipTextDisabled]}>+30s</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Subtract 15 seconds"
            style={styles.chip}
            disabled={done}
            onPress={() => onSubtractSeconds(15)}
          >
            <Text style={[styles.chipText, done && styles.chipTextDisabled]}>−15s</Text>
          </Pressable>
          {done ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss rest complete banner"
              style={[styles.chip, styles.chipGo]}
              onPress={onDismiss}
            >
              <Text style={[styles.chipText, styles.chipTextGo]}>Next set</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip rest"
              style={styles.chip}
              onPress={onSkip}
            >
              <Text style={styles.chipText}>Skip</Text>
            </Pressable>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgElevated,
    borderRadius: 16,
    borderWidth: 2,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  leftText: {
    gap: 1,
  },
  countdown: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.heavy,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  phaseLabel: {
    fontSize: fontSize.xs,
    letterSpacing: 1,
    color: colors.textMuted,
  },
  controls: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipGo: {
    backgroundColor: colors.accentVolt,
    borderColor: colors.accentVolt,
  },
  chipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  chipTextDisabled: {
    opacity: 0.4,
  },
  chipTextGo: {
    color: colors.bgPrimary,
  },
});

export default RestTimerHud;
