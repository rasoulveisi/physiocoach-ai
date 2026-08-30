import React, { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, X } from 'lucide-react-native';
import { Button, Input, ScreenContainer } from '../../components/ui';
import { colors } from '../../theme/colors';
import { fontSize, fontWeight } from '../../theme/typography';
import { useAuth } from '../../context/AuthContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

type RegisterScreenProps = NativeStackScreenProps<AuthStackParamList, 'Register'>;

interface RegisterFieldErrors {
  displayName?: string;
  email?: string;
  password?: string;
}

export default function RegisterScreen({ navigation }: RegisterScreenProps) {
  const { register, loginWithGoogle, error, clearError } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const validate = useCallback((): boolean => {
    const next: RegisterFieldErrors = {};
    if (displayName.trim().length < 2) {
      next.displayName = 'Enter your full name.';
    }
    if (!email.trim()) {
      next.email = 'Enter your email address.';
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      next.email = 'That email address does not look right.';
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      next.password = 'Password must be at least 8 characters.';
    } else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      next.password = 'Password must include at least one letter and one number.';
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }, [displayName, email, password]);

  const handleSubmit = useCallback(async () => {
    if (submitting || googleLoading) return;
    clearError();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await register(email.trim(), password, displayName.trim());
    } finally {
      setSubmitting(false);
    }
  }, [clearError, displayName, email, googleLoading, password, register, submitting, validate]);

  const handleGoogleLogin = useCallback(async () => {
    if (submitting || googleLoading) return;
    clearError();
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } finally {
      setGoogleLoading(false);
    }
  }, [clearError, googleLoading, loginWithGoogle, submitting]);

  const passwordHint = useMemo(
    () => 'At least 8 characters, with one letter and one number.',
    [],
  );

  return (
    <ScreenContainer scrollable style={styles.centered}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.brandBlock}>
          <Text style={styles.brandName}>PHYSIOCOACH</Text>
          <Text style={styles.brandTag}>Create your athlete account.</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.title}>Join PhysioCoach</Text>
          <Text style={styles.subtitle}>A few details and you are ready to train.</Text>

          {error ? (
            <View style={styles.errorBanner}>
              <AlertTriangle size={18} color={colors.accentRed} strokeWidth={2} />
              <Text style={styles.errorText}>{error}</Text>
              <X
                size={16}
                color={colors.textMuted}
                strokeWidth={2}
                onPress={() => clearError()}
                accessibilityRole="button"
                accessibilityLabel="Dismiss error"
              />
            </View>
          ) : null}

          <Input
            label="FULL NAME"
            placeholder="e.g. Rasoul Veisi"
            value={displayName}
            onChangeText={(text) => {
              setDisplayName(text);
              if (fieldErrors.displayName) {
                setFieldErrors((prev) => ({ ...prev, displayName: undefined }));
              }
              if (error) clearError();
            }}
            autoCapitalize="words"
            autoComplete="name"
            error={fieldErrors.displayName ?? null}
          />

          <Input
            label="EMAIL"
            placeholder="you@example.com"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
              if (error) clearError();
            }}
            keyboardType="email-address"
            autoComplete="email"
            error={fieldErrors.email ?? null}
          />

          <Input
            label="PASSWORD"
            placeholder="Create a password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (fieldErrors.password) {
                setFieldErrors((prev) => ({ ...prev, password: undefined }));
              }
              if (error) clearError();
            }}
            secure
            autoComplete="new-password"
            error={fieldErrors.password ?? null}
          />
          <Text style={styles.passwordHint}>{passwordHint}</Text>

          <Button
            label="Create Account"
            variant="volt"
            size="lg"
            fullWidth
            loading={submitting}
            disabled={googleLoading}
            onPress={() => void handleSubmit()}
          />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <Button
            label="Continue with Google"
            variant="secondary"
            fullWidth
            loading={googleLoading}
            disabled={submitting}
            onPress={() => void handleGoogleLogin()}
          />

          <View style={styles.switchRow}>
            <Text style={styles.switchHint}>Already have an account?</Text>
            <Button
              label="Back to Login"
              variant="ghost"
              size="sm"
              onPress={() => navigation.navigate('Login')}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 32,
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: 28,
  },
  brandName: {
    fontSize: fontSize.display,
    lineHeight: 42,
    fontWeight: fontWeight.heavy,
    letterSpacing: 2,
    color: colors.accentVolt,
  },
  brandTag: {
    marginTop: 4,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    letterSpacing: 0.4,
  },
  formCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 20,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 20,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  passwordHint: {
    marginTop: -8,
    marginBottom: 16,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  switchHint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderSubtle,
  },
  dividerText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    letterSpacing: 1,
  },
});
