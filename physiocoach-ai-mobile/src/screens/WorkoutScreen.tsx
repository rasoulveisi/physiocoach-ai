import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Dumbbell } from 'lucide-react-native';
import { ScreenContainer, Header, Card, Badge, Button } from '../components/ui';
import { colors } from '../theme/colors';
import { fontSize, fontWeight } from '../theme/typography';

export default function WorkoutScreen() {
  return (
    <ScreenContainer scrollable>
      <Header
        title="Workout"
        subtitle="Active session controls"
        rightAction={<Dumbbell size={22} color={colors.accentVolt} />}
      />

      <Card elevated>
        <Text style={styles.cardLabel}>CURRENT SESSION</Text>
        <Text style={styles.sessionTitle}>Lower Body — Strength</Text>
        <View style={styles.badgeRow}>
          <Badge label="Set 2 of 5" variant="volt" />
          <Badge label="Back Squat" variant="cyan" />
        </View>
      </Card>

      <Card style={styles.gapTop}>
        <Text style={styles.cardLabel}>LIVE TELEMETRY</Text>
        <View style={styles.metricRow}>
          <View style={styles.metric}>
            <Text style={[styles.metricValue, { color: colors.accentVolt }]}>120kg</Text>
            <Text style={styles.metricLabel}>Target</Text>
          </View>
          <View style={styles.metric}>
            <Text style={[styles.metricValue, { color: colors.accentCyan }]}>0:45</Text>
            <Text style={styles.metricLabel}>Rest</Text>
          </View>
          <View style={styles.metric}>
            <Text style={[styles.metricValue, { color: colors.accentAmber }]}>RPE 8</Text>
            <Text style={styles.metricLabel}>Effort</Text>
          </View>
        </View>
      </Card>

      <View style={[styles.gapTop, styles.buttonRow]}>
        <View style={styles.buttonFlex}>
          <Button label="Log Set" variant="volt" fullWidth />
        </View>
        <View style={styles.buttonFlex}>
          <Button label="Skip" variant="secondary" fullWidth />
        </View>
      </View>
      <View style={styles.gapTop}>
        <Button label="End Session" variant="danger" fullWidth />
      </View>
      <View style={styles.gapTop}>
        <Button label="Demo: Loading…" variant="ghost" loading disabled fullWidth />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  cardLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 8,
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
  metricRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metric: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 12,
  },
  metricValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  metricLabel: {
    marginTop: 4,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  buttonFlex: { flex: 1 },
  gapTop: { marginTop: 16 },
});

export { WorkoutScreen };
