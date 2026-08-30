import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Dumbbell,
  HeartPulse,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react-native';
import { Badge, Button, Card, Header, ScreenContainer } from '../../components/ui';
import { colors } from '../../theme/colors';
import { fontSize, fontWeight } from '../../theme/typography';
import {
  getConsiderationOptions,
  getLatestAssessment,
  submitAssessment,
} from '../../api/assessments';
import type {
  AssessmentConsideration,
  AssessmentInput,
  BodyConsiderationOption,
} from '../../api/assessments';
import type { RootStackParamList } from '../../navigation/types';

type AssessmentNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const GOAL_OPTIONS: Array<{
  id: AssessmentInput['goals'][number];
  label: string;
  desc: string;
}> = [
  { id: 'muscle_gain', label: 'Hypertrophy / Muscle Gain', desc: 'Maximize muscle size and metabolic conditioning' },
  { id: 'strength', label: 'Strength & Power', desc: 'Focus on progressive overload and heavy compound lifts' },
  { id: 'posture_improvement', label: 'Posture Correction', desc: 'Fix rounded shoulders, forward head, and anterior tilt' },
  { id: 'mobility', label: 'Joint Mobility & Prehab', desc: 'Restore range of motion and joint resilience' },
  { id: 'fat_loss', label: 'Fat Loss & Conditioning', desc: 'High-density resistance sessions with short rest' },
  { id: 'recomposition', label: 'Body Recomposition', desc: 'Build lean mass while staying athletic' },
];

const EQUIPMENT_OPTIONS: Array<{
  id: AssessmentInput['equipment'][number];
  label: string;
  desc: string;
}> = [
  { id: 'full_gym', label: 'Full Commercial Gym', desc: 'Barbells, cables, dumbbells, and isolation machines' },
  { id: 'home_gym', label: 'Home Gym (Barbell & Rack)', desc: 'Squat rack, flat bench, and Olympic plates' },
  { id: 'dumbbells_only', label: 'Dumbbells Only', desc: 'Adjustable dumbbells and bench' },
  { id: 'resistance_bands', label: 'Resistance Bands & Bodyweight', desc: 'Elastic loops, pull-up bar, and calisthenics' },
];

const JOINT_CONSIDERATION_DEFS: Array<{
  code: string;
  name: string;
  region: string;
  safeguard: string;
}> = [
  { code: 'knee_pain', name: 'Knee Pain / Patellar Discomfort', region: 'Knees', safeguard: 'Knee-Friendly Loading (Caps deep flexion)' },
  { code: 'shoulder_pain', name: 'Shoulder Impingement / Pain', region: 'Shoulders', safeguard: 'Shoulder-Safe (Replaces painful overhead pressing)' },
  { code: 'lower_back_pain', name: 'Lower Back Discomfort', region: 'Spine', safeguard: 'Low Spine Shear (Spares lumbar compressive load)' },
  { code: 'neck_pain', name: 'Neck Stiffness / Cervical Discomfort', region: 'Neck', safeguard: 'Cervical Spine Support (Avoids direct trap overload)' },
  { code: 'rounded_shoulders', name: 'Rounded Shoulders (Upper Crossed)', region: 'Posture', safeguard: 'Postural Retraction (Adds face pulls & scapular work)' },
  { code: 'tight_hips', name: 'Tight Hips / Restricted Flexion', region: 'Hips', safeguard: 'Hip Mobility Protocol (Adds 90/90 flows)' },
];

export default function AssessmentScreen() {
  const navigation = useNavigation<AssessmentNavigationProp>();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [goals, setGoals] = useState<Array<AssessmentInput['goals'][number]>>(['muscle_gain']);
  const [frequencyDays, setFrequencyDays] = useState<number>(3);
  const [sessionMinutes, setSessionMinutes] = useState<number>(60);
  const [equipment, setEquipment] = useState<Array<AssessmentInput['equipment'][number]>>(['full_gym']);
  const [selectedJoints, setSelectedJoints] = useState<
    Record<string, { severity: 'mild' | 'moderate' | 'severe' }>
  >({});

  useEffect(() => {
    let cancelled = false;
    getLatestAssessment()
      .then((res) => {
        if (!cancelled && res?.data) {
          const d = res.data;
          if (Array.isArray(d.goals) && d.goals.length > 0) {
            setGoals(d.goals as Array<AssessmentInput['goals'][number]>);
          }
          if (d.frequencyDays) setFrequencyDays(d.frequencyDays);
          if (d.sessionMinutes) setSessionMinutes(d.sessionMinutes);
          if (Array.isArray(d.equipment) && d.equipment.length > 0) {
            setEquipment(d.equipment as Array<AssessmentInput['equipment'][number]>);
          }
          if (Array.isArray(d.considerations)) {
            const map: Record<string, { severity: 'mild' | 'moderate' | 'severe' }> = {};
            for (const c of d.considerations) {
              map[c.code] = { severity: c.severity || 'mild' };
            }
            setSelectedJoints(map);
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleGoal = useCallback((id: AssessmentInput['goals'][number]) => {
    setGoals((prev) => (prev.includes(id) ? (prev.length > 1 ? prev.filter((g) => g !== id) : prev) : [...prev, id]));
  }, []);

  const toggleEquipment = useCallback((id: AssessmentInput['equipment'][number]) => {
    setEquipment((prev) => (prev.includes(id) ? (prev.length > 1 ? prev.filter((e) => e !== id) : prev) : [...prev, id]));
  }, []);

  const toggleJoint = useCallback((code: string) => {
    setSelectedJoints((prev) => {
      const next = { ...prev };
      if (next[code]) {
        delete next[code];
      } else {
        next[code] = { severity: 'moderate' };
      }
      return next;
    });
  }, []);

  const setJointSeverity = useCallback((code: string, severity: 'mild' | 'moderate' | 'severe') => {
    setSelectedJoints((prev) => ({
      ...prev,
      [code]: { severity },
    }));
  }, []);

  const handleSave = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const considerations: AssessmentConsideration[] = Object.entries(selectedJoints).map(
        ([code, { severity }]) => ({
          code,
          severity,
          side: 'unspecified',
          inferred: false,
        }),
      );

      const limitationCodes: Array<'shoulder_pain' | 'knee_pain' | 'lower_back_pain' | 'neck_pain'> = [];
      const postureFlagCodes: Array<
        'rounded_shoulders' | 'forward_head' | 'anterior_pelvic_tilt' | 'tight_hips' | 'lower_back_discomfort'
      > = [];

      for (const code of Object.keys(selectedJoints)) {
        if (['shoulder_pain', 'knee_pain', 'lower_back_pain', 'neck_pain'].includes(code)) {
          limitationCodes.push(code as any);
        }
        if (['rounded_shoulders', 'forward_head', 'anterior_pelvic_tilt', 'tight_hips', 'lower_back_discomfort'].includes(code)) {
          postureFlagCodes.push(code as any);
        }
      }

      await submitAssessment({
        goals,
        frequencyDays,
        sessionMinutes,
        equipment,
        considerations,
        limitations: limitationCodes,
        postureFlags: postureFlagCodes,
      });

      Alert.alert(
        'Assessment Completed',
        `Your profile and injury safeguards have been saved. AI generator will enforce ${considerations.length} safety constraints across your workouts.`,
        [
          {
            text: 'View My Plan',
            onPress: () => navigation.navigate('MainTabs', { screen: 'My Plan' } as never),
          },
        ],
      );
    } catch {
      Alert.alert('Error', 'Could not save your assessment. Please check your connection and retry.');
    } finally {
      setSubmitting(false);
    }
  }, [equipment, frequencyDays, goals, navigation, selectedJoints, sessionMinutes, submitting]);

  return (
    <ScreenContainer scrollable>
      <Header
        title="Physio Assessment"
        subtitle="Precision movement & injury profile"
        rightAction={<HeartPulse size={22} color={colors.accentVolt} />}
      />

      {loading ? (
        <Card style={styles.centerCard}>
          <ActivityIndicator size="large" color={colors.accentVolt} />
          <Text style={styles.loadingText}>Loading your assessment profile…</Text>
        </Card>
      ) : (
        <>
          {/* Step Progress Indicator */}
          <View style={styles.stepProgressRow}>
            {[1, 2, 3].map((s) => (
              <View key={s} style={styles.stepItem}>
                <View
                  style={[
                    styles.stepCircle,
                    step === s && styles.stepCircleActive,
                    step > s && styles.stepCircleCompleted,
                  ]}
                >
                  {step > s ? (
                    <Check size={14} color="#000" strokeWidth={3} />
                  ) : (
                    <Text
                      style={[
                        styles.stepNum,
                        step === s && styles.stepNumActive,
                      ]}
                    >
                      {s}
                    </Text>
                  )}
                </View>
                <Text style={[styles.stepLabel, step === s && styles.stepLabelActive]}>
                  {s === 1 ? 'Goals & Split' : s === 2 ? 'Joint Health' : 'Review & Save'}
                </Text>
              </View>
            ))}
          </View>

          {/* ---------------------------------------------------- STEP 1 */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <Card elevated>
                <Text style={styles.sectionHeader}>PRIMARY TRAINING GOALS</Text>
                <Text style={styles.sectionSub}>Select all targets you want to optimize for.</Text>

                <View style={styles.optionsList}>
                  {GOAL_OPTIONS.map((opt) => {
                    const selected = goals.includes(opt.id);
                    return (
                      <Pressable
                        key={opt.id}
                        onPress={() => toggleGoal(opt.id)}
                        style={[styles.optionCard, selected && styles.optionCardSelected]}
                      >
                        <View style={styles.optionHeader}>
                          <Text style={[styles.optionTitle, selected && styles.textVolt]}>
                            {opt.label}
                          </Text>
                          {selected ? <CheckCircle2 size={18} color={colors.accentVolt} /> : null}
                        </View>
                        <Text style={styles.optionDesc}>{opt.desc}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Card>

              <Card elevated style={styles.gapTop}>
                <Text style={styles.sectionHeader}>TRAINING FREQUENCY</Text>
                <Text style={styles.sectionSub}>How many days per week can you lift consistently?</Text>

                <View style={styles.freqRow}>
                  {[2, 3, 4, 5].map((d) => (
                    <Pressable
                      key={d}
                      onPress={() => setFrequencyDays(d)}
                      style={[styles.freqPill, frequencyDays === d && styles.freqPillSelected]}
                    >
                      <Text style={[styles.freqNum, frequencyDays === d && styles.freqNumSelected]}>
                        {d}
                      </Text>
                      <Text style={[styles.freqLabel, frequencyDays === d && styles.freqLabelSelected]}>
                        Days/Wk
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </Card>

              <View style={styles.buttonRow}>
                <Button
                  label="Next: Joint Considerations"
                  variant="volt"
                  size="lg"
                  fullWidth
                  onPress={() => setStep(2)}
                />
              </View>
            </View>
          )}

          {/* ---------------------------------------------------- STEP 2 */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <Card elevated>
                <Text style={styles.sectionHeader}>EQUIPMENT ACCESS</Text>
                <Text style={styles.sectionSub}>Select your available gym setup.</Text>

                <View style={styles.optionsList}>
                  {EQUIPMENT_OPTIONS.map((opt) => {
                    const selected = equipment.includes(opt.id);
                    return (
                      <Pressable
                        key={opt.id}
                        onPress={() => toggleEquipment(opt.id)}
                        style={[styles.optionCard, selected && styles.optionCardSelected]}
                      >
                        <View style={styles.optionHeader}>
                          <Text style={[styles.optionTitle, selected && styles.textVolt]}>
                            {opt.label}
                          </Text>
                          {selected ? <CheckCircle2 size={18} color={colors.accentVolt} /> : null}
                        </View>
                        <Text style={styles.optionDesc}>{opt.desc}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Card>

              <Card elevated style={styles.gapTop}>
                <View style={styles.rowBetween}>
                  <Text style={styles.sectionHeader}>JOINT DISCOMFORT & POSTURE</Text>
                  <ShieldAlert size={18} color={colors.accentAmber} />
                </View>
                <Text style={styles.sectionSub}>
                  Flag any joints that experience discomfort. PhysioCoach AI will automatically adapt exercise selections.
                </Text>

                <View style={styles.optionsList}>
                  {JOINT_CONSIDERATION_DEFS.map((joint) => {
                    const selected = !!selectedJoints[joint.code];
                    const severity = selectedJoints[joint.code]?.severity ?? 'mild';

                    return (
                      <View
                        key={joint.code}
                        style={[styles.jointCard, selected && styles.jointCardSelected]}
                      >
                        <Pressable
                          onPress={() => toggleJoint(joint.code)}
                          style={styles.jointHeaderRow}
                        >
                          <View style={styles.flex}>
                            <Text style={[styles.optionTitle, selected && styles.textAmber]}>
                              {joint.name}
                            </Text>
                            <Text style={styles.jointSafeguardText}>⚡ {joint.safeguard}</Text>
                          </View>
                          {selected ? (
                            <Badge label={severity.toUpperCase()} variant="amber" />
                          ) : (
                            <Text style={styles.tapToAdd}>+ Add</Text>
                          )}
                        </Pressable>

                        {selected && (
                          <View style={styles.severityRow}>
                            <Text style={styles.severityTitle}>Severity:</Text>
                            {(['mild', 'moderate', 'severe'] as const).map((sev) => (
                              <Pressable
                                key={sev}
                                onPress={() => setJointSeverity(joint.code, sev)}
                                style={[
                                  styles.severityPill,
                                  severity === sev && styles.severityPillActive,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.severityText,
                                    severity === sev && styles.severityTextActive,
                                  ]}
                                >
                                  {sev.charAt(0).toUpperCase() + sev.slice(1)}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </Card>

              <View style={styles.navRow}>
                <View style={styles.navBtnFlex}>
                  <Button
                    label="Back"
                    variant="outline"
                    size="lg"
                    fullWidth
                    onPress={() => setStep(1)}
                  />
                </View>
                <View style={styles.navBtnFlex}>
                  <Button
                    label="Next: Review"
                    variant="volt"
                    size="lg"
                    fullWidth
                    onPress={() => setStep(3)}
                  />
                </View>
              </View>
            </View>
          )}

          {/* ---------------------------------------------------- STEP 3 */}
          {step === 3 && (
            <View style={styles.stepContent}>
              <Card elevated>
                <View style={styles.rowBetween}>
                  <Text style={styles.sectionHeader}>ASSESSMENT PROFILE SUMMARY</Text>
                  <ShieldCheck size={20} color={colors.accentVolt} />
                </View>

                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Selected Goals</Text>
                  <Text style={styles.summaryValue}>
                    {goals.map((g) => g.replace('_', ' ')).join(', ')}
                  </Text>
                </View>

                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Weekly Schedule</Text>
                  <Text style={styles.summaryValue}>
                    {frequencyDays} Days per week ({sessionMinutes} mins/session)
                  </Text>
                </View>

                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Equipment Setup</Text>
                  <Text style={styles.summaryValue}>
                    {equipment.map((e) => e.replace('_', ' ')).join(', ')}
                  </Text>
                </View>

                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Active Injury Safeguards</Text>
                  {Object.keys(selectedJoints).length === 0 ? (
                    <Text style={styles.summaryValue}>None (Full unrestricted movement profile)</Text>
                  ) : (
                    <View style={styles.tagWrap}>
                      {Object.entries(selectedJoints).map(([code, { severity }]) => (
                        <Badge
                          key={code}
                          label={`${code.replace(/_/g, ' ')} (${severity})`}
                          variant="amber"
                        />
                      ))}
                    </View>
                  )}
                </View>
              </Card>

              <View style={styles.navRow}>
                <View style={styles.navBtnFlex}>
                  <Button
                    label="Back"
                    variant="outline"
                    size="lg"
                    fullWidth
                    disabled={submitting}
                    onPress={() => setStep(2)}
                  />
                </View>
                <View style={styles.navBtnFlex}>
                  <Button
                    label="Save Assessment"
                    variant="volt"
                    size="lg"
                    fullWidth
                    loading={submitting}
                    onPress={() => void handleSave()}
                  />
                </View>
              </View>
            </View>
          )}
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centerCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  loadingText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  stepProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepCircleActive: {
    borderColor: colors.accentVolt,
    backgroundColor: 'rgba(16, 231, 96, 0.15)',
  },
  stepCircleCompleted: {
    backgroundColor: colors.accentVolt,
    borderColor: colors.accentVolt,
  },
  stepNum: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
  },
  stepNumActive: {
    color: colors.accentVolt,
  },
  stepLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: colors.textPrimary,
    fontWeight: fontWeight.semibold,
  },
  stepContent: {
    gap: 16,
    paddingBottom: 24,
  },
  sectionHeader: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  sectionSub: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 14,
  },
  optionsList: {
    gap: 10,
  },
  optionCard: {
    backgroundColor: colors.bgPrimary,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 12,
    padding: 14,
  },
  optionCardSelected: {
    borderColor: colors.accentVolt,
    backgroundColor: 'rgba(16, 231, 96, 0.06)',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  optionTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  optionDesc: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    lineHeight: 16,
  },
  textVolt: {
    color: colors.accentVolt,
  },
  textAmber: {
    color: colors.accentAmber,
  },
  freqRow: {
    flexDirection: 'row',
    gap: 8,
  },
  freqPill: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freqPillSelected: {
    borderColor: colors.accentVolt,
    backgroundColor: 'rgba(16, 231, 96, 0.12)',
  },
  freqNum: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  freqNumSelected: {
    color: colors.accentVolt,
  },
  freqLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  freqLabelSelected: {
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
  },
  jointCard: {
    backgroundColor: colors.bgPrimary,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 12,
    padding: 12,
  },
  jointCardSelected: {
    borderColor: colors.accentAmber,
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
  },
  jointHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  jointSafeguardText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  tapToAdd: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.accentCyan,
  },
  severityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  severityTitle: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
  },
  severityPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  severityPillActive: {
    backgroundColor: colors.accentAmber,
    borderColor: colors.accentAmber,
  },
  severityText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  severityTextActive: {
    color: '#000',
    fontWeight: fontWeight.bold,
  },
  summaryItem: {
    marginBottom: 14,
  },
  summaryLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
    lineHeight: 20,
    textTransform: 'capitalize',
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  buttonRow: {
    marginTop: 8,
  },
  navRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  navBtnFlex: {
    flex: 1,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gapTop: {
    marginTop: 14,
  },
});
