/**
 * Recording and compression settings for lectures.
 *
 * Record and upload lecture video at 720p with no fixed duration limit.
 * Android compresses to a 720p H.264 target before upload. Bitrate is adapted
 * to lecture length to fit the video API's 100 MB request limit.
 * The original is deleted only after the compressed upload is verified.
 * Browser: MediaRecorder requests a 720p camera stream directly.
 */
export const recording = {
  /** Android camera source. */
  quality: '720p' as const,
  videoBitsPerSecond: 2_500_000,

  /** Browser capture (already the final size). */
  web: {
    label: '720p',
    width: 1280,
    height: 720,
    videoBitsPerSecond: 2_500_000,
    audioBitsPerSecond: 128_000,
  },

  /** Android compression before upload. maxSize is the longer side. */
  compress: {
    bitrate: 2_500_000,
    maxSize: 1280,
    codec: 'h264' as const,
    speed: 'fast' as const,
  },
} as const;

/** Disk used while recording on Android, for the "minutes left" estimate. */
export const BYTES_PER_MINUTE = (recording.videoBitsPerSecond / 8) * 60;
