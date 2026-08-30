import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Activity,
  Dumbbell,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react-native';
import { Badge, Button } from '../../components/ui';
import { colors } from '../../theme/colors';
import { fontSize, fontWeight } from '../../theme/typography';
import { getExerciseCatalog } from '../../api/exercises';
import type { ExerciseCatalogItem } from '../../api/exercises';
import { getExerciseMediaUrl } from '../../utils/mediaUtils';

const MUSCLE_GROUPS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'legs', label: 'Legs / Quads' },
  { value: 'hamstrings', label: 'Hamstrings' },
  { value: 'arms', label: 'Arms' },
  { value: 'core', label: 'Core / Abs' },
];

const SAFETY_TAGS: Array<{ value: string; label: string }> = [
  { value: 'knee_friendly', label: 'Knee-Friendly' },
  { value: 'shoulder_friendly', label: 'Shoulder-Safe' },
  { value: 'low_spine_shear', label: 'Low Spine Shear' },
];

const SEARCH_DEBOUNCE_MS = 350;

/** Memoized row item for smooth 60fps scrolling */
const ExerciseRow = React.memo(({
  item,
  onPress,
}: {
  item: ExerciseCatalogItem;
  onPress: (item: ExerciseCatalogItem) => void;
}) => {
  const imageUrl = useMemo(() => getExerciseMediaUrl(item), [item]);

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={styles.exerciseCard}
    >
      <Image
        source={{ uri: imageUrl }}
        style={styles.exerciseThumb}
        resizeMode="cover"
      />
      <View style={styles.exerciseInfo}>
        <Text style={styles.exerciseTitle} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.exerciseMeta} numberOfLines={1}>
          {`${item.primaryMuscle || item.bodyPart || 'Full Body'} · ${item.movementPattern || 'Strength'}`}
        </Text>
        <View style={styles.exerciseBadges}>
          {item.primaryMuscle ? (
            <Badge label={item.primaryMuscle.toUpperCase()} variant="cyan" />
          ) : null}
          {item.recommendedLevel ? (
            <Badge label={item.recommendedLevel} variant="zinc" />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

export default function ExploreExercisesScreen() {
  const [exercises, setExercises] = useState<ExerciseCatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('all');
  const [selectedSafety, setSelectedSafety] = useState<string | null>(null);

  // Detail Modal state
  const [selectedExercise, setSelectedExercise] = useState<ExerciseCatalogItem | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchText.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchText]);

  const loadExercises = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const res = await getExerciseCatalog({
          q: debouncedSearch || undefined,
          primaryMuscle: selectedMuscle !== 'all' ? selectedMuscle : undefined,
          safetyTags: selectedSafety ?? undefined,
          limit: 60,
        });
        setExercises(res.data);
        setTotal(res.pagination?.total || res.data.length);
      } catch {
        setError('Could not load exercise library. Pull to retry.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [debouncedSearch, selectedMuscle, selectedSafety],
  );

  useEffect(() => {
    void loadExercises('initial');
  }, [loadExercises]);

  const handleRefresh = useCallback(() => {
    void loadExercises('refresh');
  }, [loadExercises]);

  const handleOpenDetail = useCallback((item: ExerciseCatalogItem) => {
    setSelectedExercise(item);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: ExerciseCatalogItem }) => (
      <ExerciseRow item={item} onPress={handleOpenDetail} />
    ),
    [handleOpenDetail],
  );

  const keyExtractor = useCallback((item: ExerciseCatalogItem) => item.id, []);

  const ListHeader = useMemo(() => (
    <View style={styles.headerContainer}>
      {/* Search input */}
      <View style={styles.searchRow}>
        <Search size={18} color={colors.textMuted} strokeWidth={2} />
        <TextInput
          placeholder="Search exercises (e.g. Bench, Squat, Row)"
          placeholderTextColor={colors.textMuted}
          value={searchText}
          onChangeText={setSearchText}
          style={styles.searchInput}
          returnKeyType="search"
          autoCorrect={false}
        />
        {searchText.length > 0 ? (
          <Pressable hitSlop={8} onPress={() => setSearchText('')}>
            <X size={16} color={colors.textMuted} strokeWidth={2} />
          </Pressable>
        ) : null}
      </View>

      {/* Muscle group chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {MUSCLE_GROUPS.map((item) => {
          const active = selectedMuscle === item.value;
          return (
            <Pressable
              key={item.value}
              onPress={() => setSelectedMuscle(item.value)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Safety tags */}
      <View style={styles.safetyRow}>
        {SAFETY_TAGS.map((item) => {
          const active = selectedSafety === item.value;
          return (
            <Pressable
              key={item.value}
              onPress={() => setSelectedSafety(active ? null : item.value)}
              style={[styles.safetyChip, active && styles.safetyChipActive]}
            >
              <ShieldCheck
                size={14}
                color={active ? '#000' : colors.accentAmber}
                strokeWidth={2}
              />
              <Text style={[styles.safetyChipText, active && styles.safetyChipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Result summary */}
      {!loading && !error ? (
        <Text style={styles.resultCount}>
          {exercises.length === 0 ? '0 exercises found' : `${exercises.length} of ${total} exercises`}
        </Text>
      ) : null}
    </View>
  ), [error, exercises.length, loading, searchText, selectedMuscle, selectedSafety, total]);

  const ListEmpty = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={colors.accentVolt} />
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.centerWrap}>
          <Text style={styles.errorText}>{error}</Text>
          <View style={styles.gapTop}>
            <Button label="Retry" variant="outline" onPress={() => void loadExercises('initial')} />
          </View>
        </View>
      );
    }
    return (
      <View style={styles.centerWrap}>
        <Dumbbell size={36} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No exercises found</Text>
        <Text style={styles.emptyBody}>Try adjusting your search keywords or muscle filter.</Text>
      </View>
    );
  }, [error, loadExercises, loading]);

  return (
    <View style={styles.flex}>
      <FlatList
        data={exercises}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.listContent}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accentVolt}
            colors={[colors.accentVolt]}
          />
        }
      />

      {/* Exercise Detail Modal */}
      <Modal
        visible={selectedExercise !== null}
        transparent
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'overFullScreen'}
        onRequestClose={() => setSelectedExercise(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {selectedExercise && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle} numberOfLines={1}>
                    {selectedExercise.name}
                  </Text>
                  <Pressable hitSlop={8} onPress={() => setSelectedExercise(null)}>
                    <X size={20} color={colors.textMuted} />
                  </Pressable>
                </View>

                <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                  <Image
                    source={{ uri: getExerciseMediaUrl(selectedExercise) }}
                    style={styles.modalImage}
                    resizeMode="cover"
                  />

                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionLabel}>TARGET MUSCLES</Text>
                    <View style={styles.tagWrap}>
                      <Badge
                        label={`Primary: ${selectedExercise.primaryMuscle || selectedExercise.bodyPart || 'Main'}`}
                        variant="volt"
                      />
                      {(selectedExercise.secondaryMuscles ?? []).map((m) => (
                        <Badge key={m} label={m} variant="zinc" />
                      ))}
                    </View>
                  </View>

                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionLabel}>MOVEMENT PATTERN & LEVEL</Text>
                    <Text style={styles.modalText}>
                      Pattern: {selectedExercise.movementPattern || 'General Strength'}
                    </Text>
                    <Text style={styles.modalText}>
                      Level: {selectedExercise.recommendedLevel || 'All Levels'}
                    </Text>
                  </View>

                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionLabel}>PHYSIOCOACH CLINICAL CUES</Text>
                    <Text style={styles.modalCues}>
                      • Maintain a stable braced spine throughout the entire eccentric phase.{"\n"}
                      • Control the tempo (3-0-1-0) without bouncing at the bottom stretch.{"\n"}
                      • Stop immediately if you experience sharp or pinching joint pain.
                    </Text>
                  </View>
                </ScrollView>

                <View style={styles.modalFooter}>
                  <Button
                    label="Close"
                    variant="secondary"
                    fullWidth
                    onPress={() => setSelectedExercise(null)}
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  headerContainer: {
    paddingBottom: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.bgSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    padding: 0,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  chipActive: {
    backgroundColor: colors.accentVolt,
    borderColor: colors.accentVolt,
  },
  chipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: '#000',
    fontWeight: fontWeight.bold,
  },
  safetyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 6,
  },
  safetyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  safetyChipActive: {
    backgroundColor: colors.accentAmber,
    borderColor: colors.accentAmber,
  },
  safetyChipText: {
    fontSize: fontSize.xs,
    color: colors.accentAmber,
    fontWeight: fontWeight.medium,
  },
  safetyChipTextActive: {
    color: '#000',
    fontWeight: fontWeight.bold,
  },
  resultCount: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 8,
    marginBottom: 12,
  },
  centerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.accentRed,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginTop: 8,
  },
  emptyBody: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
  gapTop: {
    marginTop: 10,
  },
  exerciseCard: {
    flexDirection: 'row',
    backgroundColor: colors.bgSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
    gap: 14,
  },
  exerciseThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: colors.bgElevated,
  },
  exerciseInfo: {
    flex: 1,
    gap: 3,
  },
  exerciseTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  exerciseMeta: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  exerciseBadges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.bgSurface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: colors.borderSubtle,
    maxHeight: '85%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginRight: 10,
  },
  modalBody: {
    marginBottom: 14,
  },
  modalImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: colors.bgElevated,
    marginBottom: 16,
  },
  modalSection: {
    marginBottom: 14,
  },
  modalSectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: 6,
  },
  modalText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  modalCues: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  modalFooter: {
    paddingTop: 8,
  },
});
