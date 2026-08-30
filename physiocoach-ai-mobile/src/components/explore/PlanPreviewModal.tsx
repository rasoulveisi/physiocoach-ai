import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ShieldCheck, Star, Users, X } from 'lucide-react-native';
import { Badge, Button } from '../ui';
import { colors } from '../../theme/colors';
import { fontSize, fontWeight } from '../../theme/typography';
import type { ExplorePlanDto } from '../../api/explore';

export interface PlanPreviewModalProps {
  visible: boolean;
  plan: ExplorePlanDto | null;
  /** Loading state while fetching the full routine by id. */
  loading?: boolean;
  /** "Save to Library" — clones the routine without leaving the marketplace. */
  saving?: boolean;
  /** "Set as Active Routine" — clones + activates, then closes the modal. */
  activating?: boolean;
  onClose: () => void;
  onSaveToLibrary: (plan: ExplorePlanDto) => void;
  onSetActive: (plan: ExplorePlanDto) => void;
}

const DAY_BADGE_VARIANTS = ['volt', 'cyan', 'amber', 'zinc'] as const;

function splitLabel(split: string): string {
  switch (split) {
    case 'push_pull_legs':
      return 'PPL';
    case 'upper_lower':
      return 'Upper/Lower';
    case 'full_body':
      return 'Full Body';
    default:
      return 'Custom';
  }
}

export function PlanPreviewModal({
  visible,
  plan,
  loading = false,
  saving = false,
  activating = false,
  onClose,
  onSaveToLibrary,
  onSetActive,
}: PlanPreviewModalProps) {
  if (!visible) return null;

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'overFullScreen'}
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTextBlock}>
            <Text style={styles.headerTitle} numberOfLines={2}>
              {plan?.title ?? 'Routine Preview'}
            </Text>
            {plan ? (
              <Text style={styles.headerMeta}>
                {`${plan.author.name} · ${splitLabel(plan.split)} · ${plan.frequencyDays} days`}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close preview"
            hitSlop={8}
            onPress={onClose}
            style={styles.closeBtn}
          >
            <X size={22} color={colors.textSecondary} strokeWidth={2} />
          </Pressable>
        </View>

        {loading || !plan ? (
          <View style={styles.loadingWrap}>
            {loading ? (
              <ActivityIndicator size="large" color={colors.accentVolt} />
            ) : (
              <Text style={styles.emptyText}>Routine unavailable.</Text>
            )}
          </View>
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Summary + ratings */}
            <Text style={styles.description}>{plan.description}</Text>
            <View style={styles.metaRow}>
              <View style={styles.metaChip}>
                <Star size={13} color={colors.accentAmber} fill={colors.accentAmber} strokeWidth={1.8} />
                <Text style={styles.metaChipText}>
                  {`${plan.rating.toFixed(1)} (${plan.reviewsCount > 0 ? `${plan.reviewsCount} reviews` : 'New'})`}
                </Text>
              </View>
              <View style={styles.metaChip}>
                <Users size={13} color={colors.accentCyan} strokeWidth={2} />
                <Text style={styles.metaChipText}>{`${plan.cloneCount} saves`}</Text>
              </View>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>{`${plan.totalWeeklySets} sets/week`}</Text>
              </View>
            </View>

            {/* Joint safety tags */}
            {plan.jointTags.length > 0 ? (
              <View style={styles.tagSection}>
                <View style={styles.tagSectionHeader}>
                  <ShieldCheck size={15} color={colors.accentVolt} strokeWidth={2.2} />
                  <Text style={styles.tagSectionTitle}>JOINT SAFEGUARDS</Text>
                </View>
                <View style={styles.tagWrap}>
                  {plan.jointTags.map((tag) => (
                    <Badge key={tag} label={tag} variant="volt" />
                  ))}
                </View>
              </View>
            ) : null}

            {/* Persona match tags */}
            {plan.targetPersonas.length > 0 ? (
              <View style={styles.tagSection}>
                <View style={styles.tagSectionHeader}>
                  <Text style={styles.tagSectionTitle}>PERSONA MATCH</Text>
                </View>
                <View style={styles.tagWrap}>
                  {plan.targetPersonas.map((tag) => (
                    <Badge key={tag} label={tag} variant="cyan" />
                  ))}
                </View>
              </View>
            ) : null}

            {/* Safety notes */}
            {plan.safetyNotes && plan.safetyNotes.length > 0 ? (
              <View style={styles.safetyCard}>
                <Text style={styles.safetyTitle}>SAFETY NOTES</Text>
                {plan.safetyNotes.map((note, idx) => (
                  <Text key={idx} style={styles.safetyNote}>
                    {`• ${note}`}
                  </Text>
                ))}
              </View>
            ) : null}

            {/* Multi-day schedule */}
            {plan.days.map((day, dayIdx) => (
              <View key={day.dayNumber ?? dayIdx} style={styles.dayCard}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayTitle} numberOfLines={1}>
                    {day.name}
                  </Text>
                  <Badge
                    label={`${day.exercises.length} exercises`}
                    variant={DAY_BADGE_VARIANTS[dayIdx % DAY_BADGE_VARIANTS.length]}
                  />
                </View>
                {day.focus ? <Text style={styles.dayFocus}>{day.focus}</Text> : null}

                {day.exercises.map((exercise) => (
                  <View key={exercise.id} style={styles.exerciseRow}>
                    <View style={styles.flex}>
                      <Text style={styles.exerciseName}>{exercise.name}</Text>
                      <Text style={styles.exerciseMeta} numberOfLines={2}>
                        {[
                          `${exercise.sets} × ${exercise.reps}`,
                          exercise.rpe != null ? `RPE ${exercise.rpe}` : null,
                          exercise.tempo ?? null,
                          `${exercise.restSeconds ?? 60}s rest`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                      {exercise.notes ? (
                        <Text style={styles.exerciseNotes} numberOfLines={2}>
                          {exercise.notes}
                        </Text>
                      ) : null}
                    </View>
                    <Badge label={exercise.movementPattern} variant="zinc" />
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        )}

        {/* Footer actions */}
        {plan && !loading ? (
          <View style={styles.footer}>
            <View style={styles.footerBtn}>
              <Button
                label="Save to Library"
                variant="secondary"
                fullWidth
                loading={saving}
                disabled={activating}
                onPress={() => onSaveToLibrary(plan)}
              />
            </View>
            <View style={styles.footerBtn}>
              <Button
                label="Set as Active Routine"
                variant="volt"
                fullWidth
                loading={activating}
                disabled={saving}
                onPress={() => onSetActive(plan)}
              />
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.bgSurface,
  },
  headerTextBlock: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  headerMeta: {
    marginTop: 4,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  closeBtn: {
    padding: 4,
    marginTop: 2,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  scroll: {
    flex: 1,
  },
  scrollBody: {
    padding: 20,
    paddingBottom: 24,
  },
  description: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metaChipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  tagSection: {
    marginBottom: 16,
  },
  tagSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  tagSectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
    color: colors.textMuted,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  safetyCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  safetyTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
    color: colors.accentAmber,
    marginBottom: 6,
  },
  safetyNote: {
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  dayCard: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  dayTitle: {
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  dayFocus: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginBottom: 10,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
    marginTop: 10,
  },
  flex: { flex: 1 },
  exerciseName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  exerciseMeta: {
    marginTop: 2,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  exerciseNotes: {
    marginTop: 3,
    fontSize: fontSize.xs,
    lineHeight: 15,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    backgroundColor: colors.bgSurface,
  },
  footerBtn: {
    flex: 1,
  },
});

export default PlanPreviewModal;
