import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArrowLeftRight, ChevronRight, Dumbbell, X } from 'lucide-react-native';
import { Badge, Button } from '../ui';
import { colors } from '../../theme/colors';
import { fontSize, fontWeight } from '../../theme/typography';
import type { Exercise } from '../../api/plans';
import {
  getDirectExerciseAlternatives,
  getExerciseCatalog,
  type ExerciseCatalogItem,
} from '../../api/exercises';
import { getExerciseMediaUrl } from '../../utils/mediaUtils';

export interface ExerciseSwapModalProps {
  visible: boolean;
  exercise: Exercise | null;
  onClose: () => void;
  onSelectAlternative: (targetExercise: Exercise, alt: ExerciseCatalogItem) => void;
}

/**
 * ExerciseSwapModal — In-Plan exercise alternative selector.
 * Fetches direct biomechanical alternatives or fallback same-muscle exercises.
 */
export function ExerciseSwapModal({
  visible,
  exercise,
  onClose,
  onSelectAlternative,
}: ExerciseSwapModalProps) {
  const [loading, setLoading] = useState(false);
  const [alternatives, setAlternatives] = useState<ExerciseCatalogItem[]>([]);
  const [swappingId, setSwappingId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !exercise) {
      setAlternatives([]);
      setSwappingId(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    (async () => {
      try {
        // 1. Fetch direct alternatives matching pattern / muscle group
        const result = await getDirectExerciseAlternatives(
          exercise.id,
          undefined,
          undefined,
          exercise.muscleGroup ?? undefined,
        );

        let list = result.data ?? [];

        // 2. Filter out current exercise itself
        list = list.filter(
          (item) =>
            item.id !== exercise.id &&
            item.name.trim().toLowerCase() !== exercise.name.trim().toLowerCase(),
        );

        // 3. Fallback to catalog if direct alternatives are empty
        if (list.length === 0 && exercise.muscleGroup) {
          const catalogRes = await getExerciseCatalog({
            primaryMuscle: exercise.muscleGroup,
            limit: 10,
          });
          list = (catalogRes.data ?? []).filter(
            (item) =>
              item.id !== exercise.id &&
              item.name.trim().toLowerCase() !== exercise.name.trim().toLowerCase(),
          );
        }

        if (isMounted) {
          setAlternatives(list);
        }
      } catch {
        if (isMounted) {
          setAlternatives([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [visible, exercise]);

  const handleSelect = (alt: ExerciseCatalogItem) => {
    if (!exercise) return;
    setSwappingId(alt.id);
    onSelectAlternative(exercise, alt);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconBadge}>
                <ArrowLeftRight size={20} color={colors.accentCyan} strokeWidth={2.2} />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.title}>Swap Exercise</Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {exercise ? `Alternatives for ${exercise.name}` : 'Select a replacement exercise'}
                </Text>
              </View>
            </View>
            <Pressable
              hitSlop={8}
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close swap modal"
            >
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Body */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.accentVolt} />
              <Text style={styles.loadingText}>Finding biomechanical alternatives…</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            >
              {alternatives.map((alt) => (
                <Pressable
                  key={alt.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${alt.name}`}
                  onPress={() => handleSelect(alt)}
                  style={({ pressed }) => [styles.altCard, pressed && styles.altCardPressed]}
                >
                  <Image
                    source={{ uri: getExerciseMediaUrl(alt) }}
                    style={styles.thumb}
                    resizeMode="cover"
                  />
                  <View style={styles.flex}>
                    <Text style={styles.altName} numberOfLines={1}>
                      {alt.name}
                    </Text>
                    <View style={styles.metaRow}>
                      {alt.primaryMuscle ? (
                        <Badge label={alt.primaryMuscle.toUpperCase()} variant="cyan" />
                      ) : null}
                      {alt.movementPattern ? (
                        <Text style={styles.metaText}>{alt.movementPattern}</Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.swapAction}>
                    {swappingId === alt.id ? (
                      <ActivityIndicator size="small" color={colors.accentVolt} />
                    ) : (
                      <ChevronRight size={20} color={colors.accentVolt} />
                    )}
                  </View>
                </Pressable>
              ))}

              {alternatives.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Dumbbell size={36} color={colors.textMuted} strokeWidth={1.5} />
                  <Text style={styles.emptyTitle}>No Direct Alternatives Found</Text>
                  <Text style={styles.emptyText}>
                    No alternative exercises were found matching this movement pattern and
                    equipment setup.
                  </Text>
                </View>
              ) : null}
            </ScrollView>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Button label="Cancel" variant="ghost" fullWidth onPress={onClose} />
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
    maxHeight: '85%',
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
    alignItems: 'center',
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
  },
  iconBadge: {
    width: 40,
    height: 40,
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
  },
  closeBtn: {
    padding: 4,
  },
  scroll: {
    marginTop: 8,
  },
  list: {
    paddingVertical: 12,
    gap: 10,
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  altCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgPrimary,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  altCardPressed: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.accentVolt,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.bgElevated,
  },
  flex: {
    flex: 1,
  },
  altName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  metaText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  swapAction: {
    paddingHorizontal: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginTop: 4,
  },
  emptyText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 18,
  },
  footer: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
});

export default ExerciseSwapModal;
