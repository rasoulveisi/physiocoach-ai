import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  AlertTriangle,
  ChevronRight,
  RotateCcw,
  Sliders,
  Sparkles,
  X,
} from 'lucide-react-native';
import { Badge, Button } from '../ui';
import { colors } from '../../theme/colors';
import { fontSize, fontWeight } from '../../theme/typography';
import { activatePlan, generatePlan, type WorkoutPlan } from '../../api/plans';
import { getLatestAssessment } from '../../api/assessments';
import { setCachedCurrentPlan } from '../../services/offlineSync';

export interface RegeneratePlanModalProps {
  visible: boolean;
  onClose: () => void;
  onRetakeAssessment: () => void;
  onPlanRegenerated?: (newPlan: WorkoutPlan) => void;
  currentPlan?: WorkoutPlan | null;
}

/**
 * RegeneratePlanModal — Rebuild routine modal.
 * Offers "Re-take Assessment" (guided questionnaire) or "Instant AI Regeneration"
 * using existing preferences/profile.
 */
export function RegeneratePlanModal({
  visible,
  onClose,
  onRetakeAssessment,
  onPlanRegenerated,
  currentPlan,
}: RegeneratePlanModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInstantRegenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch latest assessment to reuse biometrics, safeguards & schedule
      const assessmentRes = await getLatestAssessment();
      const assessment = assessmentRes?.data;

      // 2. Prepare payload
      const limitations = assessment?.limitations?.length ? assessment.limitations : undefined;
      const daysPerWeek = assessment?.frequencyDays ?? currentPlan?.days?.length ?? 4;
      const goal = assessment?.goals?.[0] ?? currentPlan?.goal ?? 'muscle_gain';
      const sessionMinutes = assessment?.sessionMinutes ?? 60;
      const split = currentPlan?.split;

      // 3. Call generatePlan
      const genResult = await generatePlan({
        split,
        limitations,
        daysPerWeek,
        goal,
        sessionMinutes,
      });

      if (!genResult.plan || !genResult.plan.id) {
        throw new Error('AI was unable to generate a routine. Please try again.');
      }

      // 4. Activate the newly generated plan
      const activateResult = await activatePlan(genResult.plan.id);
      const activePlan = activateResult.plan ?? genResult.plan;

      // 5. Update offline cache
      await setCachedCurrentPlan(activePlan);

      // 6. Notify parent & close modal
      onPlanRegenerated?.(activePlan);
      onClose();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Could not regenerate plan. Please check your connection and try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      onRequestClose={() => {
        if (!loading) onClose();
      }}
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            if (!loading) onClose();
          }}
        />
        <View style={styles.sheet}>
          {/* Mobile drag handle */}
          <View style={styles.dragHandle} />

          {/* Modal Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconBadge}>
                <Sparkles size={20} color={colors.accentCyan} strokeWidth={2.2} />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.title}>Regenerate Workout Plan</Text>
                <Text style={styles.subtitle}>
                  Choose how you would like to rebuild your training routine
                </Text>
              </View>
            </View>
            <Pressable
              hitSlop={8}
              disabled={loading}
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close regenerate modal"
            >
              <X size={20} color={loading ? colors.textMuted : colors.textSecondary} />
            </Pressable>
          </View>

          {/* Error Message */}
          {error ? (
            <View style={styles.errorContainer}>
              <AlertTriangle size={16} color={colors.accentRed} strokeWidth={2} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Loading View */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.accentVolt} />
              <Text style={styles.loadingTitle}>Synthesizing AI Workout Plan…</Text>
              <Text style={styles.loadingSubtitle}>
                Applying progressive overload, biometrics & injury safeguards
              </Text>
            </View>
          ) : (
            /* Options */
            <View style={styles.optionsList}>
              {/* Option 1: Re-take Assessment */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Re-take Assessment"
                onPress={() => {
                  onClose();
                  onRetakeAssessment();
                }}
                style={({ pressed }) => [styles.optionCard, pressed && styles.optionPressed]}
              >
                <View style={[styles.optionIconBox, styles.cyanBox]}>
                  <Sliders size={22} color={colors.accentCyan} strokeWidth={2} />
                </View>
                <View style={styles.optionContent}>
                  <View style={styles.optionTitleRow}>
                    <Text style={styles.optionTitle}>Re-take Assessment</Text>
                    <Badge label="RECOMMENDED" variant="cyan" />
                  </View>
                  <Text style={styles.optionDescription}>
                    Update joint safeguards, posture flags, equipment, and days. AI will synthesize
                    your new routine upon completion.
                  </Text>
                </View>
                <ChevronRight size={20} color={colors.textMuted} />
              </Pressable>

              {/* Option 2: Instant AI Regeneration */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Instant AI Regeneration"
                onPress={() => void handleInstantRegenerate()}
                style={({ pressed }) => [styles.optionCard, pressed && styles.optionPressed]}
              >
                <View style={[styles.optionIconBox, styles.voltBox]}>
                  <RotateCcw size={22} color={colors.accentVolt} strokeWidth={2} />
                </View>
                <View style={styles.optionContent}>
                  <View style={styles.optionTitleRow}>
                    <Text style={styles.optionTitle}>Instant AI Regeneration</Text>
                    <Badge label="INSTANT" variant="volt" />
                  </View>
                  <Text style={styles.optionDescription}>
                    Keep existing biometrics, safeguards, and schedule. Instantly generate a fresh
                    routine with progressive overload.
                  </Text>
                </View>
                <ChevronRight size={20} color={colors.textMuted} />
              </Pressable>
            </View>
          )}

          {/* Footer / Cancel */}
          <View style={styles.footer}>
            <Button
              label="Cancel"
              variant="ghost"
              fullWidth
              disabled={loading}
              onPress={onClose}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: colors.bgSurface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  dragHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 8,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 4,
    marginTop: -2,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 10,
    padding: 10,
    marginTop: 14,
  },
  errorText: {
    fontSize: fontSize.xs,
    color: colors.accentRed,
    flex: 1,
    lineHeight: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 12,
  },
  loadingTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  loadingSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  optionsList: {
    marginTop: 16,
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgPrimary,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  optionPressed: {
    backgroundColor: colors.bgElevated,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  optionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cyanBox: {
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderColor: 'rgba(6, 182, 212, 0.25)',
  },
  voltBox: {
    backgroundColor: 'rgba(16, 231, 96, 0.12)',
    borderColor: 'rgba(16, 231, 96, 0.25)',
  },
  optionContent: {
    flex: 1,
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  optionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  optionDescription: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 16,
  },
  footer: {
    marginTop: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
});

export default RegeneratePlanModal;
