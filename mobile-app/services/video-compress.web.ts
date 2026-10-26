/**
 * Browser: the native compressor is not available, and MediaRecorder already
 * records at the target bitrate (see constants/recording.ts), so this is a
 * pass-through. Keep the exports identical to video-compress.ts.
 */
export async function compressVideo(uri: string, _durationSeconds: number, _onProgress?: (fraction: number) => void): Promise<string> {
  return uri;
}

export const isCompressionSupported = false;
