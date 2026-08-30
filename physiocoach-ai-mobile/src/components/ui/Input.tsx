import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  StyleProp,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { fontSize, fontWeight } from '../../theme/typography';

export interface InputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  /** Renders a password field with a show/hide toggle. */
  secure?: boolean;
  error?: string | null;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: 'email' | 'password' | 'new-password' | 'name' | 'off';
  keyboardType?: 'default' | 'email-address';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Input({
  label,
  placeholder,
  value,
  onChangeText,
  secure = false,
  error = null,
  autoCapitalize = 'none',
  autoComplete = 'off',
  keyboardType = 'default',
  disabled = false,
  style,
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const isPassword = secure;
  const obscured = isPassword && !showPassword;

  const borderColor = error
    ? colors.accentRed
    : isFocused
      ? colors.accentVolt
      : colors.borderSubtle;

  return (
    <View style={[styles.wrapper, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.field,
          { borderColor },
          isFocused && !error && styles.focused,
          disabled && styles.disabled,
        ]}
      >
        <TextInput
          style={[styles.input, obscured && styles.obscuredText]}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={obscured}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={!isPassword && keyboardType !== 'email-address'}
          keyboardType={keyboardType}
          editable={!disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          accessibilityLabel={label}
        />
        {isPassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            onPress={() => setShowPassword((prev) => !prev)}
            hitSlop={8}
            style={styles.toggle}
          >
            {showPassword ? (
              <EyeOff size={20} color={colors.textSecondary} strokeWidth={1.8} />
            ) : (
              <Eye size={20} color={colors.textSecondary} strokeWidth={1.8} />
            )}
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 50,
  },
  focused: {
    borderColor: colors.accentVolt,
  },
  disabled: {
    opacity: 0.55,
  },
  input: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    paddingVertical: 12,
  },
  obscuredText: {
    letterSpacing: 1.5,
  },
  toggle: {
    marginLeft: 10,
    padding: 4,
  },
  error: {
    marginTop: 6,
    fontSize: fontSize.sm,
    color: colors.accentRed,
  },
});

export default Input;
