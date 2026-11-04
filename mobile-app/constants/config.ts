function readNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// EXPO_PUBLIC_* variables are inlined at build time and must be accessed
// with static property names (no destructuring or dynamic keys).
export const config = {
  videoApiBaseUrl: (process.env.EXPO_PUBLIC_VIDEO_API_BASE_URL ?? 'https://nvqf.vocmanindia.com').replace(/\/$/, ''),
  videoUploadUrl: `${(process.env.EXPO_PUBLIC_VIDEO_API_BASE_URL ?? 'https://nvqf.vocmanindia.com').replace(/\/$/, '')}/api/videos`,
  firebaseDatabaseUrl: (process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ?? 'https://lmsmodule-20d97-default-rtdb.asia-southeast1.firebasedatabase.app').replace(/\/$/, ''),
  firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? 'AIzaSyAlWYrg9feqgMBsCHcC61g_QlWMVWvssQY',
  maxVideoUploadBytes: 100 * 1024 * 1024,
  pairingCodeTtlSeconds: readNumber(process.env.EXPO_PUBLIC_PAIRING_CODE_TTL_SECONDS, 30),
} as const;
