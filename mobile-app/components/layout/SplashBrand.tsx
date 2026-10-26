import { Image, ImageBackground, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

const logo = require('@/assets/logo.png');
const campus = require('@/assets/splash.webp');

export const INSTITUTION_NAME = 'Rayat Bahra University';

/** University crest used as the app's brand mark. */
export function BrandMark({ size = 96 }: { size?: number }) {
  return (
    <Image
      source={logo}
      accessibilityLabel={`${INSTITUTION_NAME} logo`}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      resizeMode="contain"
    />
  );
}

/** Campus photo strip used at the top of the login screen. */
export function CampusBanner({ height = 180 }: { height?: number }) {
  return (
    <ImageBackground source={campus} style={{ height }} resizeMode="cover" accessibilityIgnoresInvertColors>
      <View style={styles.bannerShade} />
    </ImageBackground>
  );
}

export function SplashBrand() {
  return (
    <ImageBackground source={campus} style={styles.container} resizeMode="cover" accessibilityIgnoresInvertColors>
      <View style={styles.shade} />
      <View style={styles.card}>
        <BrandMark size={110} />
        <Text accessibilityRole="header" style={styles.title}>
          Rayat Bahra University
        </Text>
        <Text style={styles.institution}>{INSTITUTION_NAME}</Text>
        <Text style={styles.tagline}>Record • Upload • Educate</Text>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  shade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(242,250,246,0.9)' },
  bannerShade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
  card: { alignItems: 'center', gap: 10, padding: 24 },
  title: { fontSize: 30, fontWeight: '800', color: colors.text, marginTop: 8 },
  institution: { fontSize: 15, fontWeight: '600', color: colors.primaryDark },
  tagline: { fontSize: 14, color: colors.textMuted },
});
