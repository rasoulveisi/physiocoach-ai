/**
 * PhysioCoach AI — Settings & Preferences screen.
 *
 * Five sections: athlete account card, workout & hardware preferences (wired
 * into the live-session engine via SettingsContext), data & offline sync
 * (NetInfo status + queue controls), system & clinical safety (version, API
 * status, medical disclaimer), and account actions (sign out).
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { LogOut, Settings as SettingsIcon, ShieldAlert } from 'lucide-react-native';
import Constants from 'expo-constants';
import { ScreenContainer, Header, Card, Badge, Button, OfflineBanner } from '../components/ui';
import { colors } from '../theme/colors';
import { fontSize, fontWeight } from '../theme/typography';
import { useAuth } from '../context/AuthContext';
import {
  DEFAULT_SETTINGS,
  REST_TIMER_OPTIONS,
  useSettings,
  type Settings,
} from '../context/SettingsContext';
import { useSync } from '../context/SyncContext';
import { BASE_URL } from '../api/client';

/** Shape-check a /health probe response (body shape is flexible). */
async function probeApiHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    // The Express deployment exposes /health under the /api/v1 prefix.
    const response = await fetch(`${BASE_URL.replace(/\/$/, '')}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timer);
    return response.ok;
  } catch {
    return false;
  }
}

function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.cardLabel}>{text}</Text>;
}

function PrefRow({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.prefRow}>
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{title}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function ChipSelector<T extends string | number>({
  options,
  value,
  onSelect,
  format,
}: {
  options: readonly T[];
  value: T;
  onSelect: (value: T) => void;
  format?: (value: T) => string;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={String(option)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${format ? format(option) : String(option)}`}
            onPress={() => onSelect(option)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {format ? format(option) : String(option)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { settings, updateSetting, resetToDefaults } = useSettings();
  const { isConnected, pendingCount, isSyncing, processQueue, clearQueue } = useSync();

  // Cloudflare API health probe (Section 4).
  const [apiProbing, setApiProbing] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const probeApi = useCallback(async () => {
    setApiProbing(true);
    const reachable = await probeApiHealth();
    setApiOnline(reachable);
    setApiProbing(false);
  }, []);

  // Disclaimers modal (Section 4).
  const [disclaimerVisible, setDisclaimerVisible] = useState(false);

  const roles = user?.roles ?? [];
  const displayName = user?.displayName?.trim() || user?.email || 'Athlete';

  const appVersion = useMemo(() => {
    const expoVersion = Constants.expoConfig?.version;
    return expoVersion ?? '1.0.0';
  }, []);

  const handleClearCache = useCallback(() => {
    Alert.alert(
      'Clear Local Cache',
      'This permanently discards offline-synced items still pending on this device and resets your preferences. Unsynced workouts would be lost. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard & Reset',
          style: 'destructive',
          onPress: () => {
            void clearQueue();
            void resetToDefaults();
          },
        },
      ],
    );
  }, [clearQueue, resetToDefaults]);

  const handleSyncNow = useCallback(async () => {
    const result = await processQueue();
    if (result.syncedCount > 0 && result.errors === 0) {
      Alert.alert('Sync complete', `${result.syncedCount} item(s) synced to your coach.`);
    } else if (result.errors > 0) {
      Alert.alert(
        'Sync finished with issues',
        `${result.syncedCount} synced, ${result.errors} could not be delivered. They were removed after repeated failures.`,
      );
    } else if (isConnected === false) {
      Alert.alert(
        'Still offline',
        'No connection right now. Your items stay safely queued and will sync automatically.',
      );
    }
  }, [processQueue, isConnected]);

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Sign out of PhysioCoach AI on this device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => void logout() },
    ]);
  }, [logout]);

  return (
    <ScreenContainer scrollable>
      <Header
        title="Settings"
        subtitle="App preferences & account"
        rightAction={<SettingsIcon size={22} color={colors.textSecondary} />}
      />

      {/* ============================================ 1 · Athlete Account */}
      <Card>
        <SectionLabel text="ATHLETE ACCOUNT" />
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>{displayName}</Text>
            <Text style={styles.rowHint}>{user?.email ?? 'Not signed in'}</Text>
            {roles.length > 0 ? (
              <View style={styles.rolesRow}>
                {roles.map((role) => (
                  <Badge key={role} label={role} variant="volt" />
                ))}
              </View>
            ) : null}
          </View>
          <Badge label="Beta" variant="cyan" />
        </View>
      </Card>

      {/* ============================== 2 · Workout & Hardware Preferences */}
      <Card style={styles.gapTop}>
        <SectionLabel text="WORKOUT & HARDWARE" />

        <PrefRow title="Weight Unit" hint="Log entry display — loads stored in kg internally">
          <ChipSelector<'kg' | 'lbs'>
            options={['kg', 'lbs'] as const}
            value={settings.weightUnit}
            onSelect={(unit) => void updateSetting('weightUnit', unit)}
            format={(unit) => unit.toUpperCase()}
          />
        </PrefRow>

        <PrefRow title="Voice Audio Cues" hint="Spoken rest-timer & coaching prompts">
          <Switch
            accessibilityLabel="Voice audio cues"
            value={settings.voiceCuesEnabled}
            onValueChange={(value) => void updateSetting('voiceCuesEnabled', value)}
            trackColor={{ false: colors.bgElevated, true: colors.accentVolt }}
            thumbColor={colors.textPrimary}
          />
        </PrefRow>

        <PrefRow title="Tactile Haptics" hint="Vibration on set completion & milestones">
          <Switch
            accessibilityLabel="Tactile haptics"
            value={settings.hapticsEnabled}
            onValueChange={(value) => void updateSetting('hapticsEnabled', value)}
            trackColor={{ false: colors.bgElevated, true: colors.accentVolt }}
            thumbColor={colors.textPrimary}
          />
        </PrefRow>

        <PrefRow title="Screen Keep-Awake" hint="Keep the screen on during live sessions">
          <Switch
            accessibilityLabel="Screen keep-awake"
            value={settings.keepAwakeEnabled}
            onValueChange={(value) => void updateSetting('keepAwakeEnabled', value)}
            trackColor={{ false: colors.bgElevated, true: colors.accentVolt }}
            thumbColor={colors.textPrimary}
          />
        </PrefRow>

        <PrefRow
          title="Default Rest Timer"
          hint="Used when an exercise has no prescribed rest"
        >
          <ChipSelector<number>
            options={REST_TIMER_OPTIONS}
            value={settings.defaultRestSeconds}
            onSelect={(seconds) => void updateSetting('defaultRestSeconds', seconds)}
            format={(seconds) => `${seconds}s`}
          />
        </PrefRow>
      </Card>

      {/* ================================== 3 · Data & Offline Sync */}
      <Card style={styles.gapTop}>
        <SectionLabel text="DATA & OFFLINE SYNC" />

        <PrefRow
          title="Network Status"
          hint={
            isConnected === null
              ? 'Detecting…'
              : isConnected
                ? 'Connected to the internet'
                : 'No connection — Gym Mode active'
          }
        >
          <Badge
            label={isConnected === false ? 'Offline' : isConnected ? 'Connected' : '…'}
            variant={isConnected === false ? 'amber' : 'volt'}
          />
        </PrefRow>

        <PrefRow
          title="Pending Sync"
          hint={
            pendingCount === 0
              ? 'Everything is synced to the cloud'
              : 'Queued workouts, logs & alerts waiting to sync'
          }
        >
          <View style={styles.syncActions}>
            {pendingCount > 0 ? <Badge label={String(pendingCount)} variant="amber" /> : null}
            <Button
              label={isSyncing ? 'Syncing…' : 'Sync Now'}
              variant="outline"
              size="sm"
              loading={isSyncing}
              disabled={pendingCount === 0}
              onPress={() => void handleSyncNow()}
            />
          </View>
        </PrefRow>

        <OfflineBanner />

        <View style={styles.gapTop}>
          <Button label="Clear Local Cache" variant="danger" fullWidth onPress={handleClearCache} />
        </View>
      </Card>

      {/* ================================ 4 · System & Clinical Safety */}
      <Card style={styles.gapTop}>
        <SectionLabel text="SYSTEM & CLINICAL SAFETY" />

        <PrefRow title="App Version" hint="PhysioCoach AI mobile">
          <Badge label={`v${appVersion}`} variant="cyan" />
        </PrefRow>

        <PrefRow
          title="Cloudflare API"
          hint={
            apiOnline === null
              ? 'Tap refresh to check reachability'
              : apiOnline
                ? BASE_URL
                : `${BASE_URL} — unreachable right now`
          }
        >
          <Button
            label={apiOnline === null ? 'Check' : apiOnline ? 'Online ✓' : 'Offline ✕'}
            variant="outline"
            size="sm"
            loading={apiProbing}
            onPress={() => void probeApi()}
          />
        </PrefRow>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open medical disclaimers"
          onPress={() => setDisclaimerVisible(true)}
          style={styles.disclaimerRow}
        >
          <ShieldAlert size={18} color={colors.accentAmber} strokeWidth={2.2} />
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>Medical Disclaimers</Text>
            <Text style={styles.rowHint}>Clinical safety scope & emergency guidance</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </Card>

      {/* ========================================== 5 · Account Actions */}
      <Card style={styles.gapTop}>
        <SectionLabel text="ACCOUNT ACTIONS" />
        <Button label="Sign Out" variant="danger" fullWidth onPress={handleSignOut} />
      </Card>

      <View style={styles.footerSpace} />

      {/* ====================================== Medical disclaimers modal */}
      <Modal
        visible={disclaimerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDisclaimerVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setDisclaimerVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <View style={styles.modalHeaderRow}>
              <ShieldAlert size={20} color={colors.accentAmber} strokeWidth={2.2} />
              <Text style={styles.modalTitle}>Medical Disclaimers</Text>
            </View>
            <Text style={styles.disclaimerBody}>
              {DISCLAIMER_TEXT.map((paragraph) => `• ${paragraph}`).join('\n\n')}
            </Text>
            <View style={styles.modalActions}>
              <Button
                label="I Understand"
                variant="volt"
                fullWidth
                onPress={() => setDisclaimerVisible(false)}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

/** Clinical-safety copy shown in the disclaimers modal. */
const DISCLAIMER_TEXT: string[] = [
  'PhysioCoach AI provides educational fitness recommendations only. It is not medical advice, diagnosis, or treatment.',
  'Stop immediately and seek qualified medical help for: sharp or stabbing joint pain, chest pain or pressure, dizziness or fainting, numbness or tingling, or shortness of breath disproportionate to effort.',
  'Consult your physician or physical therapist before starting or progressing any program, especially after surgery, injury, or with a diagnosed cardiovascular, metabolic, or renal condition.',
  'Pain scores above 4/10 on the joint-pain scale automatically flag your coach. Loads and progression are always subordinate to pain-free range of motion.',
  'Offline mode: workouts recorded without connectivity stay on this device until sync. Never rely solely on this app as a medical record.',
];

const styles = StyleSheet.create({
  cardLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flex: { flex: 1 },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  rowTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  rowHint: {
    marginTop: 4,
    fontSize: fontSize.sm,
    lineHeight: 18,
    color: colors.textMuted,
  },
  rolesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-end',
    maxWidth: 200,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPrimary,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: colors.accentVolt,
    borderColor: colors.accentVolt,
  },
  chipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.bgPrimary,
  },
  syncActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  disclaimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    marginTop: 8,
  },
  chevron: {
    fontSize: fontSize.xl,
    color: colors.textMuted,
  },
  gapTop: { marginTop: 16 },
  footerSpace: { height: 32 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.bgElevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  disclaimerBody: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  modalActions: {
    marginTop: 18,
  },
});

export { SettingsScreen };
