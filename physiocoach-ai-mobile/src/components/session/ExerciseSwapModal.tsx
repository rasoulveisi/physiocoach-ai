import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ArrowLeftRight,
  Check,
  Dumbbell,
  Search,
  ShieldCheck,
  X,
  AlertCircle,
} from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { fontSize, fontWeight } from '../../theme/typography';
import { Button } from '../ui';
import {
  getDirectExerciseAlternatives,
  getExerciseCatalog,
  type ExerciseCatalogItem,
} from '../../api/exercises';

export interface ExerciseSwapModalProps {
  visible: boolean;
  onClose: () => void;
  currentExercise: {
    id: string;
    name: string;
    movementPattern?: string | null;
    muscleGroup?: string | null;
  } | null;
  onConfirmSwap: (candidate: ExerciseCatalogItem) => void | Promise<void>;
}

function inferReason(
  candidate: ExerciseCatalogItem,
  currentPattern?: string | null,
  currentMuscle?: string | null,
): string {
  const patMatch =
    currentPattern &&
    candidate.movementPattern?.toLowerCase() === currentPattern.toLowerCase();
  const muscleMatch =
    currentMuscle &&
    (candidate.primaryMuscle?.toLowerCase().includes(currentMuscle.toLowerCase()) ||
      candidate.target?.toLowerCase().includes(currentMuscle.toLowerCase()));

  if (patMatch && muscleMatch) {
    return `Direct biomechanical match for ${candidate.movementPattern} (${candidate.primaryMuscle || currentMuscle}).`;
  }
  if (patMatch) {
    return `Preserves ${candidate.movementPattern} movement pattern with joint-friendly load path.`;
  }
  if (muscleMatch) {
    return `Targets ${candidate.primaryMuscle || currentMuscle} with alternate equipment requirement.`;
  }
  return 'Functional alternative preserving workout stimulus and volume.';
}

export function ExerciseSwapModal({
  visible,
  onClose,
  currentExercise,
  onConfirmSwap,
}: ExerciseSwapModalProps) {
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<ExerciseCatalogItem[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<ExerciseCatalogItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch alternatives when modal opens
  useEffect(() => {
    if (!visible || !currentExercise) return;

    let cancelled = false;
    setQuery('');
    setSelectedCandidate(null);
    setError(null);
    setLoading(true);

    (async () => {
      try {
        const directRes = await getDirectExerciseAlternatives(
          currentExercise.id,
          undefined,
          currentExercise.movementPattern ?? undefined,
          currentExercise.muscleGroup ?? undefined,
        );

        let list = (directRes?.data ?? []).filter(
          (c) =>
            c.id !== currentExercise.id &&
            c.name.trim().toLowerCase() !== currentExercise.name.trim().toLowerCase(),
        );

        // If direct list is sparse, augment with catalog search for same movement pattern or muscle
        if (list.length < 6) {
          const searchTerm =
            currentExercise.movementPattern || currentExercise.muscleGroup || currentExercise.name;
          const catalogRes = await getExerciseCatalog({
            q: searchTerm,
            limit: 20,
          });

          const catalogItems = (catalogRes?.data ?? []).filter(
            (c) =>
              c.id !== currentExercise.id &&
              c.name.trim().toLowerCase() !== currentExercise.name.trim().toLowerCase() &&
              !list.some((existing) => existing.id === c.id || existing.name.toLowerCase() === c.name.toLowerCase()),
          );

          list = [...list, ...catalogItems];
        }

        if (!cancelled) {
          setCandidates(list);
          if (list.length > 0) {
            setSelectedCandidate(list[0]);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError('Could not load alternatives. You can search by exercise name.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, currentExercise]);

  const filteredCandidates = useMemo(() => {
    const term = query.toLowerCase().trim();
    if (!term) return candidates;
    return candidates.filter((item) => {
      const matchName = item.name.toLowerCase().includes(term);
      const matchPat = item.movementPattern?.toLowerCase().includes(term);
      const matchMuscle =
        item.primaryMuscle?.toLowerCase().includes(term) ||
        item.target?.toLowerCase().includes(term) ||
        item.secondaryMuscles?.some((m) => m.toLowerCase().includes(term));
      const equipStr = Array.isArray(item.equipment)
        ? item.equipment.join(' ')
        : (item.equipment || '');
      const matchEquip = equipStr.toLowerCase().includes(term);
      return matchName || matchPat || matchMuscle || matchEquip;
    });
  }, [candidates, query]);

  if (!visible || !currentExercise) return null;

  const handleConfirm = async () => {
    if (!selectedCandidate) return;
    setSwapping(true);
    try {
      await onConfirmSwap(selectedCandidate);
      onClose();
    } catch {
      setError('Failed to swap exercise. Please retry.');
    } finally {
      setSwapping(false);
    }
  };

  const currentPattern = currentExercise.movementPattern || 'General';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Mobile Drag Indicator */}
          <View style={styles.dragHandleWrap}>
            <View style={styles.dragHandle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.titleRow}>
                <ArrowLeftRight size={16} color={colors.accentVolt} strokeWidth={2.4} />
                <Text style={styles.title}>SWAP EXERCISE</Text>
              </View>
              <Text style={styles.subtitle}>
                Replace exercise while maintaining biomechanical stimulus
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close swap modal"
              hitSlop={10}
              onPress={onClose}
              style={styles.closeBtn}
            >
              <X size={18} color={colors.textSecondary} strokeWidth={2.2} />
            </Pressable>
          </View>

          {/* Current Exercise Context Box */}
          <View style={styles.contextBox}>
            <View style={styles.contextTextWrap}>
              <Text style={styles.contextLabel}>CURRENTLY REPLACING</Text>
              <Text style={styles.contextExerciseName} numberOfLines={1}>
                {currentExercise.name}
              </Text>
            </View>
            <View style={styles.patternPill}>
              <Text style={styles.patternPillText}>{currentPattern.toUpperCase()}</Text>
            </View>
          </View>

          {/* Search Field */}
          <View style={styles.searchBar}>
            <Search size={16} color={colors.textMuted} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search exercise or muscle (e.g. bench, dumbbell)..."
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {query.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search text"
                hitSlop={8}
                onPress={() => setQuery('')}
              >
                <X size={16} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          {/* Candidate List / Loader */}
          <View style={styles.listContainer}>
            {loading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.accentVolt} />
                <Text style={styles.centerText}>Finding optimal alternatives…</Text>
              </View>
            ) : error ? (
              <View style={styles.centerContainer}>
                <AlertCircle size={24} color={colors.accentRed} strokeWidth={2} />
                <Text style={[styles.centerText, { color: colors.accentRed }]}>{error}</Text>
              </View>
            ) : filteredCandidates.length === 0 ? (
              <View style={styles.centerContainer}>
                <Dumbbell size={28} color={colors.textMuted} strokeWidth={1.8} />
                <Text style={styles.centerText}>
                  {query ? `No exercises match "${query}"` : 'No direct alternatives found.'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredCandidates}
                keyExtractor={(item) => item.id || item.name}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => {
                  const isSelected =
                    selectedCandidate?.id === item.id ||
                    selectedCandidate?.name.toLowerCase() === item.name.toLowerCase();

                  const equipmentStr = Array.isArray(item.equipment)
                    ? item.equipment.join(', ')
                    : item.equipment;

                  const reason = inferReason(
                    item,
                    currentExercise.movementPattern,
                    currentExercise.muscleGroup,
                  );

                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${item.name}`}
                      onPress={() => setSelectedCandidate(item)}
                      style={[
                        styles.candidateCard,
                        isSelected && styles.candidateCardActive,
                      ]}
                    >
                      <View style={styles.candidateHeader}>
                        <View style={styles.candidateNameGroup}>
                          <Text
                            style={[
                              styles.candidateName,
                              isSelected && { color: colors.accentVolt },
                            ]}
                            numberOfLines={1}
                          >
                            {item.name}
                          </Text>
                          <View style={styles.candidateBadges}>
                            {item.movementPattern ? (
                              <View style={styles.miniBadge}>
                                <Text style={styles.miniBadgeText}>
                                  {item.movementPattern.toUpperCase()}
                                </Text>
                              </View>
                            ) : null}
                            {item.primaryMuscle || item.target ? (
                              <View style={[styles.miniBadge, styles.miniBadgeCyan]}>
                                <Text style={[styles.miniBadgeText, styles.miniBadgeTextCyan]}>
                                  {(item.primaryMuscle || item.target || '').toUpperCase()}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </View>

                        {/* Selection check pill */}
                        <View
                          style={[
                            styles.radioCircle,
                            isSelected && styles.radioCircleActive,
                          ]}
                        >
                          {isSelected ? (
                            <Check size={12} color={colors.bgPrimary} strokeWidth={3} />
                          ) : null}
                        </View>
                      </View>

                      {/* Equipment row */}
                      {equipmentStr ? (
                        <View style={styles.equipmentRow}>
                          <Dumbbell size={12} color={colors.textMuted} strokeWidth={2} />
                          <Text style={styles.equipmentText} numberOfLines={1}>
                            {equipmentStr}
                          </Text>
                        </View>
                      ) : null}

                      {/* Clinical / Biomechanical reason */}
                      <View style={styles.reasonBox}>
                        <ShieldCheck size={12} color={colors.accentVolt} strokeWidth={2.2} />
                        <Text style={styles.reasonText}>{reason}</Text>
                      </View>
                    </Pressable>
                  );
                }}
              />
            )}
          </View>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <View style={styles.footerAction}>
              <Button label="Cancel" variant="ghost" size="md" onPress={onClose} />
            </View>
            <View style={styles.footerActionFlex}>
              <Button
                label="Swap Exercise"
                variant="volt"
                size="md"
                disabled={!selectedCandidate || swapping}
                loading={swapping}
                onPress={handleConfirm}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    height: '85%',
    paddingBottom: 20,
  },
  dragHandleWrap: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragHandle: {
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 2,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgSurface,
    marginHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  contextTextWrap: {
    flex: 1,
    paddingRight: 10,
  },
  contextLabel: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  contextExerciseName: {
    marginTop: 2,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  patternPill: {
    backgroundColor: 'rgba(16, 231, 96, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 231, 96, 0.3)',
  },
  patternPillText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.accentVolt,
    letterSpacing: 0.5,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bgSurface,
    marginHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    padding: 0,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  listContent: {
    gap: 10,
    paddingBottom: 16,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  centerText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  candidateCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 12,
    gap: 6,
  },
  candidateCardActive: {
    borderColor: colors.accentVolt,
    backgroundColor: 'rgba(16, 231, 96, 0.08)',
  },
  candidateHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  candidateNameGroup: {
    flex: 1,
    paddingRight: 10,
  },
  candidateName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  candidateBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  miniBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  miniBadgeText: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    letterSpacing: 0.4,
  },
  miniBadgeCyan: {
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
  },
  miniBadgeTextCyan: {
    color: colors.accentCyan,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    backgroundColor: colors.accentVolt,
    borderColor: colors.accentVolt,
  },
  equipmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  equipmentText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  reasonBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  reasonText: {
    flex: 1,
    fontSize: 10,
    color: colors.textSecondary,
    lineHeight: 14,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  footerAction: {
    width: 90,
  },
  footerActionFlex: {
    flex: 1,
  },
});

export default ExerciseSwapModal;
