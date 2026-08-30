import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Calculator as CalculatorIcon, Compass, HeartPulse, type LucideIcon } from 'lucide-react-native';
import { ScreenContainer } from '../components/ui';
import { colors } from '../theme/colors';
import { fontSize, fontWeight } from '../theme/typography';
import ExplorePlansScreen from './explore/ExplorePlansScreen';
import CalculatorScreen from './tools/CalculatorScreen';
import PrehabSection from '../components/workout/PrehabSection';
import type { RootStackParamList } from '../navigation/types';

type ExploreNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// ---------------------------------------------------------------------------
// Segmented sub-navigation
// ---------------------------------------------------------------------------

type ExploreSegment = 'plans' | 'calculator' | 'prehab';

const SEGMENTS: Array<{ key: ExploreSegment; label: string }> = [
  { key: 'plans', label: 'Explore Plans' },
  { key: 'calculator', label: '1RM & Plates' },
  { key: 'prehab', label: 'Prehab Generator' },
];

const SEGMENT_ICONS: Record<ExploreSegment, LucideIcon> = {
  plans: Compass,
  calculator: CalculatorIcon,
  prehab: HeartPulse,
};

export default function ExploreScreen() {
  const navigation = useNavigation<ExploreNavigationProp>();
  const [segment, setSegment] = useState<ExploreSegment>('plans');

  // Dedicated stack route for the prehab generator keeps state alive across
  // tab switches; the segmented "Prehab Generator" tab renders it inline.
  const openPrehabScreen = useCallback(() => {
    navigation.navigate('Prehab', undefined);
  }, [navigation]);

  const openCalculatorScreen = useCallback(() => {
    navigation.navigate('Calculator', undefined);
  }, [navigation]);

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <View style={styles.headerTextBlock}>
          <Text style={styles.headerTitle}>Explore</Text>
          <Text style={styles.headerSubtitle}>Community routines & strength tools</Text>
        </View>
        <Compass size={22} color={colors.accentCyan} />
      </View>

      {/* Segmented control */}
      <View style={styles.segmentRow}>
        {SEGMENTS.map((item) => {
          const active = segment === item.key;
          const Icon = SEGMENT_ICONS[item.key];
          return (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={item.label}
              onPress={() => setSegment(item.key)}
              style={[styles.segmentBtn, active && styles.segmentBtnActive]}
            >
              <Icon size={14} color={active ? colors.bgPrimary : colors.textMuted} strokeWidth={2.2} />
              <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Segment content */}
      <View style={styles.content}>
        {segment === 'plans' ? <ExplorePlansScreen /> : null}
        {segment === 'calculator' ? <CalculatorScreen /> : null}
        {segment === 'prehab' ? (
          <View style={styles.prehabWrap}>
            <PrehabSection />
            <Text style={styles.prehabHint}>
              You can also open this as a full screen from the tools launcher.
            </Text>
            <View style={styles.launcherRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open calculator full screen"
                onPress={openCalculatorScreen}
                style={styles.launcherBtn}
              >
                <CalculatorIcon size={18} color={colors.accentVolt} strokeWidth={2} />
                <Text style={styles.launcherText}>1RM Calculator</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open prehab generator full screen"
                onPress={openPrehabScreen}
                style={styles.launcherBtn}
              >
                <HeartPulse size={18} color={colors.accentAmber} strokeWidth={2} />
                <Text style={styles.launcherText}>Prehab Generator</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerTextBlock: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: fontSize.xxl,
    lineHeight: 30,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: fontSize.sm,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 20,
    marginTop: 14,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgSurface,
  },
  segmentBtnActive: {
    backgroundColor: colors.accentVolt,
    borderColor: colors.accentVolt,
  },
  segmentLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  segmentLabelActive: {
    color: colors.bgPrimary,
    fontWeight: fontWeight.semibold,
  },
  content: {
    flex: 1,
    marginTop: 4,
  },
  prehabWrap: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  prehabHint: {
    marginTop: 12,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
  launcherRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  launcherBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgSurface,
  },
  launcherText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
});

export { ExploreScreen };
