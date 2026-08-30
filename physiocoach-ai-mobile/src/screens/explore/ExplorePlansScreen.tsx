import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Bookmark, Search, Star } from 'lucide-react-native';
import { Badge, Button } from '../../components/ui';
import { PlanPreviewModal } from '../../components/explore/PlanPreviewModal';
import { colors } from '../../theme/colors';
import { fontSize, fontWeight } from '../../theme/typography';
import { clonePlan, getExplorePlans, isNetworkError } from '../../api/explore';
import type { ExplorePlanDto, PersonaTag, JointTag } from '../../api/explore';
import { useSync } from '../../context/SyncContext';
import { getPlanCoverImage } from '../../utils/mediaUtils';

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

const SPLITS: Array<{ value: string; label: string }> = [
  { value: 'All', label: 'All' },
  { value: 'push_pull_legs', label: 'PPL' },
  { value: 'upper_lower', label: 'Upper/Lower' },
  { value: 'full_body', label: 'Full Body' },
];

const JOINT_TAGS: Array<{ value: string; label: string }> = [
  { value: 'Knee-Friendly', label: 'Knee-Friendly' },
  { value: 'Shoulder-Safe', label: 'Shoulder-Safe' },
  { value: 'Low Spine Shear', label: 'Low Spine Shear' },
];

const SEARCH_DEBOUNCE_MS = 400;

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

function ratingText(plan: ExplorePlanDto): string {
  const reviews = plan.reviewsCount > 0 ? `${plan.reviewsCount} reviews` : 'New';
  return `${plan.rating.toFixed(1)} (${reviews})`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ExplorePlansScreen() {
  const { enqueueAction } = useSync();
  const [plans, setPlans] = useState<ExplorePlanDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [split, setSplit] = useState('All');
  const [jointTag, setJointTag] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Preview modal state
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewPlan, setPreviewPlan] = useState<ExplorePlanDto | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);
  const [activatingPlanId, setActivatingPlanId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2600);
  }, []);

  // Debounce search input so typing doesn't spam the API.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchText.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchText]);

  const loadPlans = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);
      setOffline(false);
      try {
        const result = await getExplorePlans({
          split: split !== 'All' ? split : undefined,
          jointTag: jointTag ?? undefined,
          search: debouncedSearch || undefined,
          limit: 40,
        });
        setPlans(result.data);
        setTotal(result.total);
      } catch (err) {
        if (isNetworkError(err)) {
          setOffline(true);
          setError('You appear to be offline. Reconnect to browse the marketplace.');
        } else {
          setError('Could not load community routines. Pull to retry.');
        }
        if (mode === 'refresh') {
          // Keep stale list visible on pull-to-refresh failure.
        } else {
          setPlans([]);
          setTotal(0);
        }
      } finally {
        if (mode === 'initial') setLoading(false);
        else setRefreshing(false);
      }
    },
    [split, jointTag, debouncedSearch],
  );

  // Reload whenever filters change (covers first load too).
  useEffect(() => {
    void loadPlans('initial');
  }, [loadPlans]);

  const openPreview = useCallback(
    (plan: ExplorePlanDto) => {
      setPreviewPlan(plan);
      setPreviewLoading(false);
      setPreviewVisible(true);
    },
    [],
  );

  const handleSaveToLibrary = useCallback(
    async (plan: ExplorePlanDto) => {
      setSavingPlanId(plan.id);
      try {
        await clonePlan(plan.id);
        showToast(`"${plan.title}" saved to your plans library!`, 'success');
      } catch (error) {
        if (isNetworkError(error)) {
          // Offline marketplace: queue the clone for automatic replay.
          await enqueueAction('CLONE_PLAN', { planId: plan.id, title: plan.title });
          showToast(`"${plan.title}" saved offline — it will sync when you're back online.`, 'success');
        } else {
          showToast('Could not save the routine. Check your connection and retry.', 'error');
        }
      } finally {
        setSavingPlanId(null);
      }
    },
    [showToast, enqueueAction],
  );

  const handleSetActive = useCallback(
    async (plan: ExplorePlanDto) => {
      setActivatingPlanId(plan.id);
      try {
        await clonePlan(plan.id);
        setPreviewVisible(false);
        showToast(`"${plan.title}" is now your active routine!`, 'success');
      } catch (error) {
        if (isNetworkError(error)) {
          await enqueueAction('CLONE_PLAN', { planId: plan.id, title: plan.title });
          setPreviewVisible(false);
          showToast(`"${plan.title}" will activate once you're back online.`, 'success');
        } else {
          showToast('Could not activate the routine. Check your connection and retry.', 'error');
        }
      } finally {
        setActivatingPlanId(null);
      }
    },
    [showToast, enqueueAction],
  );

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadPlans('refresh')}
            tintColor={colors.accentVolt}
            colors={[colors.accentVolt]}
            progressBackgroundColor={colors.bgSurface}
          />
        }
      >
        {/* Search bar */}
        <View style={styles.searchBar}>
          <Search size={18} color={colors.textMuted} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search routines, authors, exercises…"
            placeholderTextColor={colors.textMuted}
            value={searchText}
            onChangeText={setSearchText}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search community routines"
          />
        </View>

        {/* Split filter chips */}
        <Text style={styles.filterLabel}>SPLIT</Text>
        <View style={styles.chipWrap}>
          {SPLITS.map((item) => {
            const active = split === item.value;
            return (
              <Pressable
                key={item.value}
                accessibilityRole="button"
                accessibilityLabel={`Filter by split ${item.label}`}
                onPress={() => setSplit(item.value)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Joint safeguard filter chips */}
        <Text style={styles.filterLabel}>JOINT SAFEGUARDS</Text>
        <View style={styles.chipWrap}>
          {JOINT_TAGS.map((item) => {
            const active = jointTag === item.value;
            return (
              <Pressable
                key={item.value}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${item.label}`}
                onPress={() => setJointTag(active ? null : item.value)}
                style={[styles.chip, styles.chipSafety, active && styles.chipSafetyActive]}
              >
                <Text style={[styles.chipText, styles.chipSafetyText, active && styles.chipSafetyTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Result count */}
        {!loading && !error ? (
          <Text style={styles.resultCount}>{`${plans.length} of ${total} routines`}</Text>
        ) : null}

        {/* Loading state */}
        {loading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator size="large" color={colors.accentVolt} />
          </View>
        ) : error ? (
          <View style={styles.centerWrap}>
            <Text style={styles.errorText}>{error}</Text>
            <View style={styles.gapTop}>
              <Button label="Retry" variant="outline" onPress={() => void loadPlans('initial')} />
            </View>
          </View>
        ) : plans.length === 0 ? (
          <View style={styles.centerWrap}>
            <Text style={styles.emptyTitle}>No routines match your filters</Text>
            <Text style={styles.emptyBody}>
              Try clearing the search or selecting a different split.
            </Text>
          </View>
        ) : (
          /* ------------------------------------------------ Routine cards */
          plans.map((plan) => {
            const saving = savingPlanId === plan.id;
            const activating = activatingPlanId === plan.id;
            return (
              <View key={plan.id} style={styles.card}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Preview ${plan.title}`}
                  onPress={() => openPreview(plan)}
                >
                  <Image
                    source={{ uri: getPlanCoverImage(plan.split, [plan.title, ...(plan.jointTags ?? [])]) }}
                    style={styles.planCoverImage}
                    resizeMode="cover"
                  />

                  {/* Title + author */}
                  <View style={styles.cardTopRow}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {plan.title}
                    </Text>
                    {plan.isVerified ? <Badge label="Verified" variant="volt" /> : null}
                  </View>
                  <Text style={styles.cardAuthor} numberOfLines={1}>
                    {`by ${plan.author.name} · ${plan.author.role}`}
                  </Text>

                  {/* Badges row: split + sets */}
                  <View style={styles.badgeRow}>
                    <Badge label={splitLabel(plan.split)} variant="cyan" />
                    <Badge label={`${plan.frequencyDays} days`} variant="zinc" />
                    <Badge label={`${plan.totalWeeklySets} sets`} variant="zinc" />
                  </View>

                  {/* Ratings + clone counter */}
                  <View style={styles.statRow}>
                    <View style={styles.statChip}>
                      <Star size={13} color={colors.accentAmber} fill={colors.accentAmber} strokeWidth={1.8} />
                      <Text style={styles.statText}>{ratingText(plan)}</Text>
                    </View>
                    <View style={styles.statChip}>
                      <Bookmark size={13} color={colors.accentCyan} strokeWidth={2} />
                      <Text style={styles.statText}>{`${plan.cloneCount} saves`}</Text>
                    </View>
                  </View>

                  {/* Persona match tags */}
                  {plan.targetPersonas.length > 0 ? (
                    <View style={styles.personaWrap}>
                      {plan.targetPersonas.slice(0, 3).map((tag: PersonaTag) => (
                        <Badge key={tag} label={tag} variant="amber" />
                      ))}
                    </View>
                  ) : null}
                  {plan.jointTags.length > 0 ? (
                    <View style={styles.personaWrap}>
                      {plan.jointTags.slice(0, 3).map((tag: JointTag) => (
                        <Badge key={tag} label={tag} variant="volt" />
                      ))}
                    </View>
                  ) : null}
                </Pressable>

                {/* Action buttons */}
                <View style={styles.actionRow}>
                  <View style={styles.actionBtn}>
                    <Button
                      label="Preview"
                      variant="secondary"
                      size="sm"
                      onPress={() => openPreview(plan)}
                    />
                  </View>
                  <View style={styles.actionBtn}>
                    <Button
                      label="Save to My Plans"
                      variant="volt"
                      size="sm"
                      loading={saving || activating}
                      onPress={() => void handleSaveToLibrary(plan)}
                    />
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Offline banner */}
      {offline && !loading ? (
        <View style={styles.offlineBanner} pointerEvents="none">
          <Text style={styles.offlineText}>Offline — showing cached state</Text>
        </View>
      ) : null}

      {/* Toast */}
      {toast ? (
        <View style={[styles.toast, toast.type === 'error' ? styles.toastError : styles.toastSuccess]} pointerEvents="none">
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      ) : null}

      {/* Preview modal */}
      <PlanPreviewModal
        visible={previewVisible}
        plan={previewPlan}
        loading={previewLoading}
        saving={savingPlanId === previewPlan?.id}
        activating={activatingPlanId === previewPlan?.id}
        onClose={() => setPreviewVisible(false)}
        onSaveToLibrary={(plan) => void handleSaveToLibrary(plan)}
        onSetActive={(plan) => void handleSetActive(plan)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: { flex: 1 },
  body: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 48,
    marginTop: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    paddingVertical: 12,
  },
  filterLabel: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
    color: colors.textMuted,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgSurface,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: 'rgba(16, 231, 96, 0.15)',
    borderColor: colors.accentVolt,
  },
  chipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.accentVolt,
    fontWeight: fontWeight.semibold,
  },
  chipSafety: {
    borderColor: 'rgba(6, 182, 212, 0.35)',
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
  },
  chipSafetyActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.18)',
    borderColor: colors.accentCyan,
  },
  chipSafetyText: {
    color: colors.accentCyan,
  },
  chipSafetyTextActive: {
    color: colors.accentCyan,
    fontWeight: fontWeight.semibold,
  },
  resultCount: {
    marginTop: 16,
    marginBottom: 4,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  centerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.accentRed,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  emptyBody: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
  },
  planCoverImage: {
    width: '100%',
    height: 110,
    borderRadius: 10,
    backgroundColor: colors.bgElevated,
    marginBottom: 12,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  cardAuthor: {
    marginTop: 4,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  personaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
  },
  offlineBanner: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  offlineText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.accentAmber,
  },
  toast: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toastSuccess: {
    backgroundColor: 'rgba(16, 231, 96, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 231, 96, 0.4)',
  },
  toastError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  toastText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  gapTop: { marginTop: 8 },
});

export { ExplorePlansScreen };
