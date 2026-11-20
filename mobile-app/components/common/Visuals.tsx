import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { sColors, sRadius } from '@/constants/studentTheme';

/** Purple gradient panel (hero banners). */
export function GradientCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.gradient, style]}>
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="hero" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={sColors.gradientFrom} />
            <Stop offset="1" stopColor={sColors.gradientTo} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#hero)" />
        <Circle cx="92" cy="8" r="22" fill="#FFFFFF" opacity={0.08} />
        <Circle cx="78" cy="96" r="16" fill="#FFFFFF" opacity={0.07} />
      </Svg>
      {children}
    </View>
  );
}

/** Circular progress ring with the percentage in the middle. */
export function ProgressRing({ percent, size = 76, stroke = 8, color = sColors.primary, label }: { percent: number; size?: number; stroke?: number; color?: string; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessible accessibilityLabel={`${Math.round(p)} percent${label ? ` ${label}` : ''}`}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={sColors.soft} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${(c * p) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <Text style={[styles.ringText, { fontSize: size * 0.22 }]}>{Math.round(p)}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: { overflow: 'hidden', borderRadius: sRadius.lg, padding: 20 },
  ringText: { color: sColors.text, fontWeight: '800' },
});
