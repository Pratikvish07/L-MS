function readNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// EXPO_PUBLIC_* variables are inlined at build time and must be accessed
// with static property names (no destructuring or dynamic keys).
export const config = {
  videoApiBaseUrl: (process.env.EXPO_PUBLIC_VIDEO_API_BASE_URL ?? '').replace(/\/$/, ''),
  videoUploadUrl: `${(process.env.EXPO_PUBLIC_VIDEO_API_BASE_URL ?? '').replace(/\/$/, '')}/api/videos`,
  maxVideoUploadBytes: 100 * 1024 * 1024,
  // Each new code is one Firestore write: keep it long enough to stay well inside the daily write quota.
  pairingCodeTtlSeconds: readNumber(process.env.EXPO_PUBLIC_PAIRING_CODE_TTL_SECONDS, 300),
} as const;
