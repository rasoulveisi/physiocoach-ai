import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { colors } from '../../theme/colors';

export interface CardProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Use bgElevated instead of bgSurface (e.g. floating HUD). */
  elevated?: boolean;
  onPress?: () => void;
}

export function Card({ children, style, elevated = false, onPress }: CardProps) {
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: elevated ? colors.bgElevated : colors.bgSurface },
        style,
      ]}
      onTouchEnd={onPress}
    >
      {children}
    </View>
  );
}

const styles = {
  base: {
    backgroundColor: colors.bgSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 16,
  } as ViewStyle,
};

export default Card;
