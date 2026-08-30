import React from 'react';
import { ScrollView, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../../theme/colors';

export interface ScreenContainerProps {
  children?: React.ReactNode;
  /** Wrap content in a ScrollView instead of a plain View. */
  scrollable?: boolean;
  /** Extra padding applied to the content wrapper. */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Status bar style; defaults to light for the dark theme. */
  statusBarStyle?: 'light' | 'dark' | 'auto';
}

export function ScreenContainer({
  children,
  scrollable = false,
  padded = true,
  style,
  statusBarStyle = 'light',
}: ScreenContainerProps) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style={statusBarStyle} backgroundColor={colors.bgPrimary} />
      {scrollable ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[padded && styles.padded, style]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, padded && styles.padded, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  flex: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: 20,
  },
});

export default ScreenContainer;
