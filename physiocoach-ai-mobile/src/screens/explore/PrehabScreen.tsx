import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, HeartPulse } from 'lucide-react-native';
import { ScreenContainer } from '../../components/ui';
import PrehabSection from '../../components/workout/PrehabSection';
import { colors } from '../../theme/colors';
import { fontSize, fontWeight } from '../../theme/typography';
import type { RootStackParamList } from '../../navigation/types';

type PrehabNavigationProp = NativeStackNavigationProp<RootStackParamList>;

/** Standalone Smart Warm-up / Prehab generator screen (Explore tools). */
export default function PrehabScreen() {
  const navigation = useNavigation<PrehabNavigationProp>();

  return (
    <ScreenContainer scrollable>
      <View style={styles.backRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Explore"
          hitSlop={8}
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <ChevronLeft size={22} color={colors.textSecondary} strokeWidth={2.2} />
          <Text style={styles.backText}>Explore</Text>
        </Pressable>
        <HeartPulse size={20} color={colors.accentAmber} strokeWidth={2} />
      </View>

      <Text style={styles.title}>Smart Warm-up & Prehab</Text>
      <Text style={styles.subtitle}>
        Clinical mobility matrix primed for your session's movement patterns.
      </Text>

      <View style={styles.sectionGap} />
      <PrehabSection />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -8,
  },
  backText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 4,
    fontSize: fontSize.sm,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  sectionGap: {
    height: 8,
  },
});

export { PrehabScreen };
