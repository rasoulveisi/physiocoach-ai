import React from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Library } from 'lucide-react-native';
import { Badge, Button } from '../ui';
import { colors } from '../../theme/colors';
import { fontSize, fontWeight } from '../../theme/typography';
import type { WorkoutPlan } from '../../api/plans';

export interface PlansLibraryModalProps {
  visible: boolean;
  plans: WorkoutPlan[] | null;
  loading: boolean;
  /** Id of the plan whose activation request is in flight. */
  activatingPlanId: string | null;
  onClose: () => void;
  onActivate: (planId: string) => void;
}

/** "My Plans Library" — browse saved routines and 1-click activate. */
export function PlansLibraryModal({
  visible,
  plans,
  loading,
  activatingPlanId,
  onClose,
  onActivate,
}: PlansLibraryModalProps) {
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
          <Pressable accessibilityRole="button" accessibilityLabel="Close plans library" hitSlop={8} onPress={onClose}>
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
                  <Button
                    label={activatingPlanId === item.id ? 'Activating…' : 'Activate'}
                    variant="outline"
                    size="sm"
                    loading={activatingPlanId === item.id}
                    onPress={() => onActivate(item.id)}
                  />
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
  empty: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 24,
  },
});

export default PlansLibraryModal;
