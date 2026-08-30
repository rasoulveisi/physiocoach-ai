import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CalendarDays } from 'lucide-react-native';
import { ScreenContainer, Header, Card, Badge, Button } from '../components/ui';
import { colors } from '../theme/colors';
import { fontSize, fontWeight } from '../theme/typography';

const WEEK = [
  { day: 'Mon', label: 'Push', variant: 'volt' as const },
  { day: 'Tue', label: 'Mobility', variant: 'cyan' as const },
  { day: 'Wed', label: 'Pull', variant: 'volt' as const },
  { day: 'Thu', label: 'Rest', variant: 'zinc' as const },
  { day: 'Fri', label: 'Legs', variant: 'amber' as const },
  { day: 'Sat', label: 'Conditioning', variant: 'cyan' as const },
  { day: 'Sun', label: 'Rest', variant: 'zinc' as const },
];

export default function MyPlanScreen() {
  return (
    <ScreenContainer scrollable>
      <Header
        title="My Plan"
        subtitle="Your weekly training block"
        rightAction={<CalendarDays size={22} color={colors.accentVolt} />}
      />

      <Card>
        <Text style={styles.cardLabel}>THIS WEEK</Text>
        <View style={styles.grid}>
          {WEEK.map((d) => (
            <View key={d.day} style={styles.dayCell}>
              <Text style={styles.dayName}>{d.day}</Text>
              <Badge label={d.label} variant={d.variant} />
            </View>
          ))}
        </View>
      </Card>

      <Card elevated style={styles.gapTop}>
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <Text style={styles.cardLabel}>BLOCK PROGRESS</Text>
            <Text style={styles.blockTitle}>Hypertrophy — Week 3 of 6</Text>
          </View>
          <Badge label="On Track" variant="volt" />
        </View>
      </Card>

      <View style={styles.gapTop}>
        <Button label="Adjust Plan" variant="outline" fullWidth />
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
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  dayCell: {
    width: '30%',
    flexDirection: 'column',
    gap: 6,
  },
  dayName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  blockTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flex: { flex: 1 },
  gapTop: { marginTop: 16 },
});

export { MyPlanScreen };
