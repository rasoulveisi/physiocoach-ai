import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Library, Trash2 } from 'lucide-react-native';
import { Badge, Button } from '../ui';
import { colors } from '../../theme/colors';
import { fontSize, fontWeight } from '../../theme/typography';
import { deletePlan, type WorkoutPlan } from '../../api/plans';

export interface PlansLibraryModalProps {
  visible: boolean;
  plans: WorkoutPlan[] | null;
  loading: boolean;
  /** Id of the plan whose activation request is in flight. */
  activatingPlanId: string | null;
  onClose: () => void;
  onActivate: (planId: string) => void;
  onDelete?: (planId: string) => Promise<void> | void;
  onRefresh?: () => Promise<void> | void;
}

/** "My Plans Library" — browse saved routines, 1-click activate, and delete inactive routines. */
export function PlansLibraryModal({
  visible,
  plans,
  loading,
  activatingPlanId,
  onClose,
  onActivate,
  onDelete,
  onRefresh,
}: PlansLibraryModalProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const confirmDelete = (plan: WorkoutPlan) => {
    Alert.alert(
      'Delete Plan',
      'Are you sure you want to delete this workout plan?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void handleDelete(plan.id),
        },
      ],
    );
  };

  const handleDelete = async (planId: string) => {
    setDeletingId(planId);
    try {
      await deletePlan(planId);
      if (onDelete) {
        await onDelete(planId);
      }
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err) {
      Alert.alert(
        'Delete Failed',
        err instanceof Error ? err.message : 'Could not delete workout plan.',
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'overFullScreen'}
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Library size={20} color={colors.accentVolt} strokeWidth={2} />
            <Text style={styles.title}>My Plans Library</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close plans library"
            hitSlop={8}
            onPress={onClose}
          >
            <Text style={styles.close}>Done</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.bodyCenter}>
            <ActivityIndicator size="large" color={colors.accentVolt} />
          </View>
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
            {(plans ?? []).map((item) => (
              <View key={item.id} style={styles.row}>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {`${item.split} · ${item.days?.length ?? 0} days${
                      item.averageRating != null ? ` · ★ ${item.averageRating.toFixed(1)}` : ''
                    }`}
                  </Text>
                </View>
                {item.isActive ? (
                  <Badge label="Active" variant="volt" />
                ) : (
                  <View style={styles.actions}>
                    <Button
                      label={activatingPlanId === item.id ? 'Activating…' : 'Activate'}
                      variant="outline"
                      size="sm"
                      loading={activatingPlanId === item.id}
                      onPress={() => onActivate(item.id)}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${item.title}`}
                      hitSlop={8}
                      disabled={deletingId === item.id}
                      onPress={() => confirmDelete(item)}
                      style={styles.deleteBtn}
                    >
                      {deletingId === item.id ? (
                        <ActivityIndicator size="small" color={colors.accentRed} />
                      ) : (
                        <Trash2 size={18} color={colors.accentRed} strokeWidth={2} />
                      )}
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
            {(plans ?? []).length === 0 ? (
              <Text style={styles.empty}>No saved plans yet. Your routines will appear here.</Text>
            ) : null}
          </ScrollView>
        )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  close: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.accentVolt,
  },
  scroll: { flex: 1 },
  body: {
    padding: 20,
    paddingBottom: 40,
  },
  bodyCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  flex: { flex: 1 },
  rowTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  rowMeta: {
    marginTop: 2,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 24,
  },
});

export default PlansLibraryModal;
