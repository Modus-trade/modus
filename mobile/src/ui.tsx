import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

// Шрифт сайта — Manrope. Начертание выбираем по fontWeight.
export const fonts = {
  400: 'Manrope-400',
  500: 'Manrope-500',
  600: 'Manrope-600',
  700: 'Manrope-700',
  800: 'Manrope-800',
} as const;

export const fontAssets = {
  'Manrope-400': require('../assets/fonts/manrope-400.ttf'),
  'Manrope-500': require('../assets/fonts/manrope-500.ttf'),
  'Manrope-600': require('../assets/fonts/manrope-600.ttf'),
  'Manrope-700': require('../assets/fonts/manrope-700.ttf'),
  'Manrope-800': require('../assets/fonts/manrope-800.ttf'),
};

function withFont(style: StyleProp<TextStyle>): StyleProp<TextStyle> {
  const flat = StyleSheet.flatten(style) || {};
  const w = Number(flat.fontWeight === 'bold' ? 700 : flat.fontWeight ?? 500);
  const key = (w >= 800 ? 800 : w >= 700 ? 700 : w >= 600 ? 600 : w >= 500 ? 500 : 400) as keyof typeof fonts;
  return [flat, { fontFamily: fonts[key], fontWeight: undefined }];
}

export function Text({ style, ...rest }: TextProps) {
  return <RNText {...rest} style={withFont(style)} />;
}

export function TextInput({ style, ...rest }: TextInputProps) {
  return <RNTextInput {...rest} style={withFont(style)} />;
}

/** Кнопка/карточка, которая мягко «проседает» при нажатии. */
export function PressableScale({
  children,
  style,
  scaleTo = 0.97,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & { children: ReactNode; style?: StyleProp<ViewStyle>; scaleTo?: number }) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, { damping: 18, stiffness: 320 });
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 14, stiffness: 260 });
        rest.onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Шрифты и цвет нативной шапки — как заголовки сайта. */
export const headerFonts = {
  headerTitleStyle: { fontFamily: fonts[700], color: '#102F49' },
  headerLargeTitleStyle: { fontFamily: fonts[800], color: '#102F49' },
  headerTintColor: '#102F49',
} as const;
