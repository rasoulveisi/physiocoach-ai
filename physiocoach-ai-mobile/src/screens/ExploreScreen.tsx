import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Compass } from 'lucide-react-native';
import { ScreenContainer, Header, Card, Badge, Button } from '../components/ui';
import { colors } from '../theme/colors';
import { fontSize, fontWeight } from '../theme/typography';

const TOOLS = [
  { title: '1RM Calculator', tag: 'Strength', variant: 'volt' as const },
  { title: 'RPE / RIR Guide', tag: 'Effort', variant: 'amber' as const },
  { title: 'Tempo & TUT', tag: 'Telemetry', variant: 'cyan' as const },
];

export default function ExploreScreen() {
  return (
    <ScreenContainer scrollable>
      <Header
        title="Explore"
        subtitle="Tools & training library"
        rightAction={<Compass size={22} color={colors.accentCyan} />}
      />

      <Card>
        <Text style={styles.cardLabel}>TOOLS</Text>
        <View style={styles.toolList}>
          {TOOLS.map((tool) => (
            <View key={tool.title} style={styles.toolRow}>
              <View style={styles.flex}>
                <Text style={styles.toolTitle}>{tool.title}</Text>
              </View>
              <Badge label={tool.tag} variant={tool.variant} />
            </View>
          ))}
        </View>
      </Card>

      <Card elevated style={styles.gapTop}>
        <Text style={styles.cardLabel}>LEARNING</Text>
        <Text style={styles.learnTitle}>Progressive Overload, Explained</Text>
        <Text style={styles.learnBody}>
          A 4-minute primer on scaling load, volume, and density across a block.
        </Text>
        <View style={styles.gapTop}>
          <Button label="Open Library" variant="outline" />
        </View>
      </Card>
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
  toolList: {
    gap: 12,
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flex: { flex: 1 },
  toolTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  learnTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  learnBody: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  gapTop: { marginTop: 16 },
});

export { ExploreScreen };
