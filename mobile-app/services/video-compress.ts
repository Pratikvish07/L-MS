import { compress } from 'expo-image-and-video-compressor';

import { recording } from '@/constants/recording';

/**
 * Android: hardware H.264 compression of a recorded lecture
 * (expo-image-and-video-compressor). Resolves to the compressed file's URI;
 * the original file is left untouched.
 */
export function compressVideo(uri: string, durationSeconds: number, onProgress?: (fraction: number) => void): Promise<string> {
  const sizeBudgetBitrate = durationSeconds > 0
    ? Math.floor((100 * 1024 * 1024 * 8 * 0.92) / durationSeconds)
    : recording.compress.bitrate;
  return compress(
    uri,
    {
      bitrate: Math.min(recording.compress.bitrate, sizeBudgetBitrate),
      maxSize: recording.compress.maxSize,
      codec: recording.compress.codec,
      speed: recording.compress.speed,
    },
    onProgress,
  );
}

export const isCompressionSupported = true;
