import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { AlertTriangle, ShieldCheck } from 'lucide-react-native';
import { Button } from '../../components/ui';
import { colors } from '../../theme/colors';
import { fontSize, fontWeight } from '../../theme/typography';

export interface PainAlertModalProps {
  visible: boolean;
  painLevel: number;
  bodyPart: string | null;
  bodyParts: string[];
  submitting: boolean;
  advice: string | null;
  deloadRecommended: boolean | null;
  error: string | null;
  onClose: () => void;
  onPainChange: (value: number) => void;
  onBodyPartChange: (bodyPart: string) => void;
  onSubmit: () => void;
}

/** Semantic color ramp for the 0-10 pain scale. */
function painColor(level: number): string {
  if (level <= 2) return colors.accentVolt;
  if (level <= 5) return colors.accentAmber;
  return colors.accentRed;
}

/** Joint Pain / Discomfort Alert — 0-10 scale → sendPainAlert → instant advice. */
export function PainAlertModal({
  visible,
  painLevel,
  bodyPart,
  bodyParts,
  submitting,
  advice,
  deloadRecommended,
  error,
  onClose,
  onPainChange,
  onBodyPartChange,
  onSubmit,
}: PainAlertModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => undefined}>
          <View style={styles.headerRow}>
            <AlertTriangle size={22} color={colors.accentRed} strokeWidth={2.2} />
            <Text style={styles.title}>Joint Pain / Discomfort</Text>
          </View>
          <Text style={styles.subtitle}>
            Rate your pain so the AI can adjust the session instantly.
          </Text>

          {advice === null ? (
            <>
              <Text style={styles.label}>WHERE DOES IT HURT?</Text>
              <View style={styles.chipsRow}>
                {bodyParts.map((part) => {
                  const active = bodyPart === part;
                  return (
                    <Pressable
                      key={part}
                      accessibilityRole="button"
                      accessibilityLabel={`Body part ${part}`}
                      onPress={() => onBodyPartChange(part)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{part}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.label, { color: painColor(painLevel) }]}>
                {`PAIN LEVEL: ${painLevel}/10`}
              </Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={10}
                step={1}
                value={painLevel}
                onValueChange={onPainChange}
                minimumTrackTintColor={painColor(painLevel)}
                maximumTrackTintColor={colors.borderSubtle}
                thumbTintColor={painColor(painLevel)}
              />
              <View style={styles.scaleLegend}>
                <Text style={styles.scaleText}>0 · none</Text>
                <Text style={styles.scaleText}>5 · moderate</Text>
                <Text style={styles.scaleText}>10 · severe</Text>
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <View style={styles.actions}>
                <View style={styles.actionFlex}>
                  <Button label="Cancel" variant="ghost" onPress={onClose} />
                </View>
                <View style={styles.actionFlex}>
                  <Button
                    label="Send Alert"
                    variant="danger"
                    loading={submitting}
                    disabled={bodyPart === null}
                    onPress={onSubmit}
                  />
                </View>
              </View>
            </>
          ) : (
            <>
              <View
                style={[
                  styles.adviceBox,
                  deloadRecommended
                    ? { borderColor: 'rgba(239, 68, 68, 0.4)' }
                    : { borderColor: 'rgba(16, 231, 96, 0.35)' },
                ]}
              >
                <View style={styles.adviceHeaderRow}>
                  <ShieldCheck
                    size={18}
                    color={deloadRecommended ? colors.accentRed : colors.accentVolt}
                    strokeWidth={2.2}
                  />
                  <Text
                    style={[
                      styles.adviceTitle,
                      { color: deloadRecommended ? colors.accentRed : colors.accentVolt },
                    ]}
                  >
                    {deloadRecommended ? 'Deload Recommended' : 'You Are Clear'}
                  </Text>
                </View>
                <Text style={styles.adviceText}>{advice}</Text>
              </View>
              <View style={styles.actions}>
                <View style={styles.actionFlex}>
                  <Button label="Done" variant="volt" onPress={onClose} />
                </View>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: colors.bgElevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 6,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  label: {
    marginTop: 16,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgSurface,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: colors.accentRed,
  },
  chipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.accentRed,
  },
  scaleLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  slider: {
    width: '100%',
    height: 40,
    marginTop: 4,
  },
  scaleText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  errorText: {
    marginTop: 10,
    fontSize: fontSize.xs,
    color: colors.accentRed,
  },
  adviceBox: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: colors.bgSurface,
    padding: 14,
  },
  adviceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adviceTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  adviceText: {
    marginTop: 8,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  actionFlex: { flex: 1 },
});

export default PainAlertModal;
