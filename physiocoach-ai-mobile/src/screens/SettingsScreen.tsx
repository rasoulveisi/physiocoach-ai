import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Settings as SettingsIcon } from 'lucide-react-native';
import { ScreenContainer, Header, Card, Badge, Button } from '../components/ui';
import { colors } from '../theme/colors';
import { fontSize, fontWeight } from '../theme/typography';

export default function SettingsScreen() {
  return (
    <ScreenContainer scrollable>
      <Header
        title="Settings"
        subtitle="App preferences & account"
        rightAction={<SettingsIcon size={22} color={colors.textSecondary} />}
      />

      <Card>
        <Text style={styles.cardLabel}>ACCOUNT</Text>
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>Athlete Profile</Text>
            <Text style={styles.rowHint}>Units, goals, and injury flags</Text>
          </View>
          <Badge label="Beta" variant="cyan" />
        </View>
      </Card>

      <Card style={styles.gapTop}>
        <Text style={styles.cardLabel}>DANGER ZONE</Text>
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>Reset Local Data</Text>
            <Text style={styles.rowHint}>Clears cached plans on this device</Text>
          </View>
        </View>
        <View style={styles.gapTop}>
          <Button label="Sign Out" variant="danger" fullWidth />
        </View>
      </Card>

      <View style={styles.gapTop}>
        <Button label="Save Preferences" variant="secondary" fullWidth />
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
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flex: { flex: 1 },
  rowTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  rowHint: {
    marginTop: 4,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  gapTop: { marginTop: 16 },
});

export { SettingsScreen };
