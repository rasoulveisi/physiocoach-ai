import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { Card } from '../../components/ui';
import { colors } from '../../theme/colors';
import { fontSize, fontWeight } from '../../theme/typography';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KG_PER_LB = 0.453592;
const BAR_WEIGHT_KG = 20;

const WEIGHT_STEP_KG = 2.5;
const WEIGHT_STEP_LB = 5;

/** Standard plate inventory with collar schematic colors. */
const PLATES_KG: Array<{ value: number; label: string; color: string; border: string }> = [
  { value: 25, label: '25', color: '#DC2626', border: '#B91C1C' }, // red
  { value: 20, label: '20', color: '#2563EB', border: '#1D4ED8' }, // blue
  { value: 15, label: '15', color: '#FACC15', border: '#EAB308' }, // yellow
  { value: 10, label: '10', color: '#16A34A', border: '#15803D' }, // green
  { value: 5, label: '5', color: '#F8FAFC', border: '#CBD5E1' }, // white
  { value: 2.5, label: '2.5', color: '#0F172A', border: '#334155' }, // black
  { value: 1.25, label: '1.25', color: '#CBD5E1', border: '#94A3B8' }, // silver
];

const RPE_OPTIONS: Array<{ label: string; sub: string }> = [
  { label: '6', sub: '4 RIR' },
  { label: '7', sub: '3 RIR' },
  { label: '8', sub: '2 RIR' },
  { label: '9', sub: '1 RIR' },
  { label: '10', sub: 'Max' },
];

// ---------------------------------------------------------------------------
// Math — conservative 1RM estimates (Epley & Brzycki), averaged
// ---------------------------------------------------------------------------

function epley1rm(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}

function brzycki1rm(weightKg: number, reps: number): number {
  return weightKg * (36 / (37 - reps));
}

/** Averaged conservative estimate; Brzycki degrades >12 reps, Epley >10. */
function estimate1rm(weightKg: number, reps: number, rpe: number): number {
  const effectiveReps = reps + (10 - rpe); // RIR-corrected reps-to-failure
  const clamped = Math.min(12, Math.max(1, effectiveReps));
  const epley = epley1rm(weightKg, clamped);
  const brzycki = brzycki1rm(weightKg, clamped);
  // Brzycki is more conservative at higher rep counts — average them.
  return (epley + brzycki) / 2;
}

/** Greedy plate breakdown for one side of the bar. */
function computePlates(perSideKg: number): Array<{ value: number; count: number }> {
  let remaining = Math.floor(perSideKg * 4) / 4; // quantize to 1.25 kg
  const result: Array<{ value: number; count: number }> = [];
  for (const plate of PLATES_KG) {
    if (remaining < plate.value - 1e-9) continue;
    const count = Math.floor(remaining / plate.value + 1e-9);
    if (count > 0) {
      result.push({ value: plate.value, count });
      remaining -= count * plate.value;
    }
  }
  return result;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CalculatorScreen() {
  const [unit, setUnit] = useState<'kg' | 'lbs'>('kg');
  const [weightKg, setWeightKg] = useState(80);
  const [reps, setReps] = useState(5);
  const [rpe, setRpe] = useState(8);

  const step = unit === 'kg' ? WEIGHT_STEP_KG : WEIGHT_STEP_LB;
  const displayWeight = unit === 'kg' ? weightKg : Math.round((weightKg / KG_PER_LB) * 10) / 10;

  const setDisplayWeight = (next: number) => {
    const clamped = Math.max(0, next);
    const kg = unit === 'kg' ? clamped : clamped * KG_PER_LB;
    setWeightKg(Math.round(kg * 100) / 100);
  };

  const oneRm = useMemo(() => estimate1rm(weightKg, reps, rpe), [weightKg, reps, rpe]);

  // Working weights per RPE table
  const targets = useMemo(
    () =>
      [100, 90, 80, 70].map((pct) => ({
        pct,
        rpeLabel: pct === 100 ? 'RPE 10' : `RPE ${pct / 10}`,
        weight: Math.floor(oneRm * (pct / 100) * 2) / 2, // round down to 2.5 kg
      })),
    [oneRm],
  );

  // Plate loading for the 1RM bar
  const perSide = Math.max(0, (oneRm - BAR_WEIGHT_KG) / 2);
  const plates = useMemo(() => computePlates(perSide), [perSide]);
  const tooLight = oneRm <= BAR_WEIGHT_KG;

  const clinical = useMemo(
    () => [
      {
        title: 'Tendon HSR (Heavy Slow Resistance)',
        range: '70–85% 1RM',
        detail: '3s up / 3s down tempo',
        weight: Math.floor(oneRm * 0.7 * 2) / 2,
        weightMax: Math.floor(oneRm * 0.85 * 2) / 2,
        accent: colors.accentCyan as string,
      },
      {
        title: 'Joint Deload / Active Recovery',
        range: '40–50% 1RM',
        detail: 'Pain-free pumping sets',
        weight: Math.floor(oneRm * 0.4 * 2) / 2,
        weightMax: Math.floor(oneRm * 0.5 * 2) / 2,
        accent: colors.accentAmber as string,
      },
    ],
    [oneRm],
  );

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      {/* ---------------------------------------------- Inputs */}
      <Card>
        <View style={styles.cardLabelRow}>
          <Text style={styles.cardLabel}>LIFT INPUTS</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle weight unit"
            onPress={() => setUnit((prev) => (prev === 'kg' ? 'lbs' : 'kg'))}
            style={styles.unitToggle}
          >
            <Text style={styles.unitToggleText}>{`${unit} → ${unit === 'kg' ? 'lbs' : 'kg'}`}</Text>
          </Pressable>
        </View>

        {/* Lift weight stepper */}
        <Text style={styles.fieldLabel}>{`LIFT WEIGHT (${unit.toUpperCase()})`}</Text>
        <View style={styles.stepper}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decrease lift weight"
            onPress={() => setDisplayWeight(displayWeight - step)}
            style={styles.stepBtn}
          >
            <Minus size={18} color={colors.textPrimary} strokeWidth={2.4} />
          </Pressable>
          <Text style={styles.stepValue}>{fmt(displayWeight)}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Increase lift weight"
            onPress={() => setDisplayWeight(displayWeight + step)}
            style={styles.stepBtn}
          >
            <Plus size={18} color={colors.textPrimary} strokeWidth={2.4} />
          </Pressable>
        </View>

        {/* Reps selector 1-12 */}
        <Text style={styles.fieldLabel}>REPS COMPLETED</Text>
        <View style={styles.gridRow}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={`${value} reps`}
              onPress={() => setReps(value)}
              style={[styles.gridCell, reps === value && styles.gridCellActive]}
            >
              <Text style={[styles.gridText, reps === value && styles.gridTextActive]}>{value}</Text>
            </Pressable>
          ))}
        </View>

        {/* RPE selector */}
        <Text style={styles.fieldLabel}>EFFORT (RPE / RIR)</Text>
        <View style={styles.rpeRow}>
          {RPE_OPTIONS.map((option) => {
            const active = rpe === Number(option.label);
            return (
              <Pressable
                key={option.label}
                accessibilityRole="button"
                accessibilityLabel={`Effort RPE ${option.label}`}
                onPress={() => setRpe(Number(option.label))}
                style={[styles.rpeCell, active && styles.rpeCellActive]}
              >
                <Text style={[styles.rpeValue, active && styles.rpeTextActive]}>{option.label}</Text>
                <Text style={[styles.rpeSub, active && styles.rpeSubActive]}>{option.sub}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* ---------------------------------------------- 1RM result */}
      <Card elevated style={styles.gapTop}>
        <Text style={styles.cardLabel}>ESTIMATED 1RM (EPLEY + BRZYCKI)</Text>
        <View style={styles.oneRmRow}>
          <Text style={styles.oneRmValue}>{fmt(oneRm)}</Text>
          <Text style={styles.oneRmUnit}>{unit}</Text>
        </View>
        <Text style={styles.oneRmHint}>
          {`Conservative average from ${fmt(displayWeight)} ${unit} × ${reps} reps @ RPE ${rpe}`}
        </Text>
      </Card>

      {/* ---------------------------------------------- Plate loader */}
      <Card style={styles.gapTop}>
        <View style={styles.cardLabelRow}>
          <Text style={styles.cardLabel}>BARBELL PLATE LOADER</Text>
          <Text style={styles.barLabel}>{`${BAR_WEIGHT_KG} KG BAR`}</Text>
        </View>

        {/* Barbell schematic: mirrored plate stacks + bar + collars */}
        <View style={styles.barbellWrap}>
          {/* Left side (mirrored) */}
          <View style={styles.sideRow}>
            {plates
              .slice()
              .reverse()
              .flatMap((entry, entryIdx) =>
                Array.from({ length: entry.count }, (_, n) => (
                  <View
                    key={`l-${entryIdx}-${n}`}
                    style={[
                      styles.plate,
                      {
                        backgroundColor: PLATES_KG.find((p) => p.value === entry.value)?.color,
                        borderColor: PLATES_KG.find((p) => p.value === entry.value)?.border,
                        width: plateWidth(entry.value),
                      },
                    ]}
                  >
                    <Text style={styles.plateText}>{String(entry.value)}</Text>
                  </View>
                )),
              )}
            {!tooLight ? <View style={styles.collar} /> : null}
          </View>

          {/* Bar shaft */}
          <View style={styles.barShaft}>
            <Text style={styles.barText}>{fmt(Math.round(oneRm * 2) / 2)}</Text>
          </View>

          {/* Right side */}
          <View style={styles.sideRow}>
            {!tooLight ? <View style={styles.collar} /> : null}
            {plates.flatMap((entry, entryIdx) =>
              Array.from({ length: entry.count }, (_, n) => (
                <View
                  key={`r-${entryIdx}-${n}`}
                  style={[
                    styles.plate,
                    {
                      backgroundColor: PLATES_KG.find((p) => p.value === entry.value)?.color,
                      borderColor: PLATES_KG.find((p) => p.value === entry.value)?.border,
                      width: plateWidth(entry.value),
                    },
                  ]}
                >
                  <Text style={styles.plateText}>{String(entry.value)}</Text>
                </View>
              )),
            )}
          </View>
        </View>

        {tooLight ? (
          <Text style={styles.tooLightText}>
            Estimated 1RM is at or below the 20 kg bar — no plates needed.
          </Text>
        ) : (
          <>
            {/* Per-side legend */}
            <View style={styles.legendWrap}>
              {plates.map((entry) => {
                const meta = PLATES_KG.find((p) => p.value === entry.value);
                return (
                  <View key={entry.value} style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: meta?.color, borderColor: meta?.border }]} />
                    <Text style={styles.legendText}>
                      {`2 × ${String(entry.value)} kg`}
                      {entry.count > 1 ? ` (${entry.count}/side)` : ''}
                    </Text>
                  </View>
                );
              })}
              <Text style={styles.legendSum}>
                {`Per side: ${fmt(perSide)} kg · bar 20 kg · total ${fmt(Math.round(oneRm * 2) / 2)} kg`}
              </Text>
            </View>
          </>
        )}
      </Card>

      {/* ---------------------------------------------- Target working weights */}
      <Card style={styles.gapTop}>
        <Text style={styles.cardLabel}>TARGET WORKING WEIGHTS</Text>
        {targets.map((target) => (
          <View key={target.pct} style={styles.tableRow}>
            <Text style={styles.tablePct}>{`${target.pct}%`}</Text>
            <Text style={styles.tableRpe}>{target.rpeLabel}</Text>
            <Text style={styles.tableWeight}>
              {`${fmt(target.weight)} ${unit}`}
            </Text>
          </View>
        ))}
      </Card>

      {/* ---------------------------------------------- Clinical rehab multipliers */}
      <Card style={styles.gapTop}>
        <Text style={styles.cardLabel}>CLINICAL REHAB MULTIPLIERS</Text>
        {clinical.map((item) => (
          <View key={item.title} style={styles.clinicalRow}>
            <View style={[styles.clinicalAccent, { backgroundColor: item.accent }]} />
            <View style={styles.flex}>
              <Text style={styles.clinicalTitle}>{item.title}</Text>
              <Text style={styles.clinicalDetail}>
                {`${item.range} · ${item.detail}`}
              </Text>
            </View>
            <Text style={styles.clinicalWeight}>
              {`${fmt(item.weight)}–${fmt(item.weightMax)} ${unit}`}
            </Text>
          </View>
        ))}
        <Text style={styles.clinicalNote}>
          HSR dosing follows tendon rehab protocols — heavy but slow, pain held at ≤3/10.
        </Text>
      </Card>
    </ScrollView>
  );
}

function plateWidth(value: number): number {
  if (value >= 25) return 30;
  if (value >= 20) return 26;
  if (value >= 15) return 22;
  if (value >= 10) return 18;
  if (value >= 5) return 14;
  if (value >= 2.5) return 10;
  return 7;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  gapTop: { marginTop: 16 },
  cardLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  barLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.accentCyan,
  },
  unitToggle: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  unitToggleText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.accentVolt,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 4,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  gridCell: {
    width: 42,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCellActive: {
    backgroundColor: 'rgba(16, 231, 96, 0.15)',
    borderColor: colors.accentVolt,
  },
  gridText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  gridTextActive: {
    color: colors.accentVolt,
    fontWeight: fontWeight.bold,
  },
  rpeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  rpeCell: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    paddingVertical: 8,
  },
  rpeCellActive: {
    backgroundColor: 'rgba(16, 231, 96, 0.15)',
    borderColor: colors.accentVolt,
  },
  rpeValue: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
  },
  rpeTextActive: {
    color: colors.accentVolt,
  },
  rpeSub: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 1,
  },
  rpeSubActive: {
    color: colors.accentVolt,
  },
  oneRmRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  oneRmValue: {
    fontSize: 56,
    lineHeight: 60,
    fontWeight: fontWeight.heavy,
    color: colors.accentVolt,
    letterSpacing: -1.5,
  },
  oneRmUnit: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    paddingBottom: 10,
  },
  oneRmHint: {
    marginTop: 6,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  barbellWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    minHeight: 120,
    overflow: 'hidden',
  },
  sideRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  plate: {
    height: 84,
    borderRadius: 4,
    borderWidth: 2,
    marginRight: 2,
    marginLeft: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  plateText: {
    fontSize: 8,
    fontWeight: fontWeight.bold,
    color: 'rgba(0, 0, 0, 0.55)',
  },
  collar: {
    width: 8,
    height: 92,
    borderRadius: 2,
    backgroundColor: '#64748B',
    marginHorizontal: 3,
  },
  barShaft: {
    minHeight: 14,
    flexShrink: 1,
    backgroundColor: '#94A3B8',
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  barText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.bgPrimary,
  },
  tooLightText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 8,
  },
  legendWrap: {
    marginTop: 10,
    gap: 5,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
  },
  legendText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  legendSum: {
    marginTop: 6,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
  },
  tablePct: {
    width: 64,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.accentVolt,
  },
  tableRpe: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  tableWeight: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  clinicalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
  },
  clinicalAccent: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
  },
  clinicalTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  clinicalDetail: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  clinicalWeight: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  clinicalNote: {
    marginTop: 8,
    fontSize: fontSize.xs,
    lineHeight: 16,
    color: colors.textMuted,
  },
});

export { CalculatorScreen };
