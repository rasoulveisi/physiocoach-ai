import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Dumbbell } from 'lucide-react-native';
import { ScreenContainer, Header, Card, Badge, Button } from '../components/ui';
import { colors } from '../theme/colors';
import { fontSize, fontWeight } from '../theme/typography';
import { getCurrentPlan } from '../api/plans';
import type { WorkoutPlan } from '../api/plans';
import type { RootStackParamList } from '../navigation/types';

type WorkoutNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function WorkoutScreen() {
  const navigation = useNavigation<WorkoutNavigationProp>();
  const [plan, setPlan] = React.useState<WorkoutPlan | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    getCurrentPlan()
      .then((result) => {
        if (!cancelled) setPlan(result.plan);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const todayDay =
    plan?.days?.find((day) => day.dayIndex === plan.currentDayIndex) ?? plan?.days?.[0] ?? null;

  const startSession = React.useCallback(() => {
    navigation.navigate('LiveSession', {
      plan,
      dayIndex: todayDay?.dayIndex,
      dayName: todayDay?.name,
    });
  }, [navigation, plan, todayDay]);

  return (
    <ScreenContainer scrollable>
      <Header
        title="Workout"
        subtitle="Active session controls"
        rightAction={<Dumbbell size={22} color={colors.accentVolt} />}
      />

      <Card elevated>
        <Text style={styles.cardLabel}>CURRENT SESSION</Text>
        <Text style={styles.sessionTitle}>
          {todayDay ? `${todayDay.name} — ${plan?.title ?? 'Active Plan'}` : 'Freestyle Session'}
        </Text>
        <View style={styles.badgeRow}>
          <Badge label={todayDay ? `Day ${todayDay.dayIndex}` : 'Open'} variant="volt" />
          <Badge label={`${todayDay?.exercises?.length ?? 0} exercises`} variant="cyan" />
        </View>
      </Card>

      <View style={[styles.gapTop, styles.buttonRow]}>
        <View style={styles.buttonFlex}>
          <Button label="Start Live Session" variant="volt" fullWidth onPress={startSession} />
        </View>
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
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  buttonFlex: { flex: 1 },
  gapTop: { marginTop: 16 },
});

export { WorkoutScreen };
