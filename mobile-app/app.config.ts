import type { ConfigContext, ExpoConfig } from 'expo/config';

/** Dynamic config layered on top of app.json. */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Rayat Bahra University',
  slug: config.slug ?? 'lms',
  // Android is the real target. Web is for previewing the faculty screens in a
  // browser; camera recording and on-device storage need the Android app.
  platforms: ['android', 'web'],
  web: {
    ...config.web,
    favicon: './assets/logo.png',
  },
});
