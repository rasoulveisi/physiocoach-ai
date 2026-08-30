import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Activity } from 'lucide-react-native';
import { ScreenContainer, Header, Card, Badge, Button } from '../components/ui';
import { colors } from '../theme/colors';
import { fontSize, fontWeight } from '../theme/typography';

export default function DashboardScreen() {
  return (
    <ScreenContainer scrollable>
      <Header
        title="Dashboard"
        subtitle="Athlete readiness at a glance"
        rightAction={<Activity size={22} color={colors.accentCyan} />}
      />

      <Card>
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <Text style={styles.cardLabel}>TODAY'S READINESS</Text>
            <Text style={styles.bigValue}>82%</Text>
            <Text style={styles.hint}>Recovery is optimal for loading</Text>
          </View>
          <Badge label="Ready" variant="volt" />
        </View>
      </Card>

      <Card elevated style={styles.gapTop}>
        <Text style={styles.cardLabel}>NEXT SESSION</Text>
        <Text style={styles.sessionTitle}>Lower Body — Strength</Text>
        <View style={styles.badgeRow}>
          <Badge label="45 min" variant="cyan" />
          <Badge label="Moderate" variant="amber" />
        </View>
        <View style={styles.gapTop}>
          <Button label="Start Workout" variant="volt" fullWidth />
        </View>
      </Card>

      <View style={styles.gapTop}>
        <Button label="Review Plan" variant="ghost" fullWidth />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  flex: { flex: 1 },
  cardLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 8,
  },
  bigValue: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: fontWeight.heavy,
    color: colors.textPrimary,
  },
  hint: {
    marginTop: 6,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  sessionTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  gapTop: { marginTop: 16 },
});

export { DashboardScreen };
