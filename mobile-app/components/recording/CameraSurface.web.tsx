import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { recording } from '@/constants/recording';

/**
 * Browser camera for the tripod screen: live preview with getUserMedia and
 * recording with MediaRecorder. Exposes the subset of expo-camera's CameraView
 * API that the screen uses, so the recording logic is shared with Android.
 */
interface Props {
  style?: StyleProp<ViewStyle>;
  facing?: 'front' | 'back';
  mode?: 'picture' | 'video';
  videoQuality?: string;
  videoBitrate?: number;
  enableTorch?: boolean;
  onCameraReady?: () => void;
  onMountError?: (event: { message: string }) => void;
}

export interface CameraSurface {
  recordAsync(): Promise<{ uri: string } | undefined>;
  stopRecording(): void;
  toggleRecordingAsync(): Promise<void>;
  takePictureAsync(options?: { quality?: number; shutterSound?: boolean }): Promise<{ uri: string; width: number; height: number }>;
  getSupportedFeatures(): { toggleRecordingAsyncAvailable: boolean; isModernBarcodeScannerAvailable: boolean };
}

/** Prefer MP4 (Chrome/Edge/Safari); fall back to WebM where MP4 recording is unavailable. */
const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  return MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

export const CameraSurface = forwardRef<CameraSurface, Props>(function CameraSurface(
  { style, facing = 'back', onCameraReady, onMountError },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const readyRef = useRef(onCameraReady);
  const errorRef = useRef(onMountError);
  readyRef.current = onCameraReady;
  errorRef.current = onMountError;

  useEffect(() => {
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      errorRef.current?.({ message: 'This browser cannot access the camera. Use Chrome or Edge over http://localhost or HTTPS.' });
      return;
    }
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: facing === 'front' ? 'user' : 'environment', width: { ideal: recording.web.width }, height: { ideal: recording.web.height } },
        audio: { echoCancellation: false, noiseSuppression: true },
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.play().catch(() => undefined);
        }
        readyRef.current?.();
      })
      .catch((e: Error) => errorRef.current?.({ message: e.message || 'Camera or microphone access was denied.' }));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facing]);

  useImperativeHandle(ref, () => ({
    recordAsync() {
      const stream = streamRef.current;
      if (!stream) return Promise.reject(new Error('Camera is not ready.'));
      if (typeof MediaRecorder === 'undefined') return Promise.reject(new Error('This browser cannot record video.'));
      return new Promise((resolve, reject) => {
        const mimeType = pickMimeType();
        const recorder = new MediaRecorder(stream, {
          ...(mimeType ? { mimeType } : {}),
          videoBitsPerSecond: recording.web.videoBitsPerSecond,
          audioBitsPerSecond: recording.web.audioBitsPerSecond,
        });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        recorder.onstop = () => {
          recorderRef.current = null;
          if (!chunks.length) {
            resolve(undefined);
            return;
          }
          const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'video/webm' });
          resolve({ uri: URL.createObjectURL(blob) });
        };
        recorder.onerror = () => reject(new Error('The browser stopped recording unexpectedly.'));
        recorderRef.current = recorder;
        // Collect data every second so a long lecture is not one huge buffer.
        recorder.start(1000);
      });
    },
    stopRecording() {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
    },
    async toggleRecordingAsync() {
      const recorder = recorderRef.current;
      if (recorder?.state === 'recording') recorder.pause();
      else if (recorder?.state === 'paused') recorder.resume();
    },
    async takePictureAsync(options) {
      const video = videoRef.current;
      if (!video || !video.videoWidth) throw new Error('Camera is not ready.');
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', options?.quality ?? 0.6));
      if (!blob) throw new Error('Could not capture a snapshot.');
      return { uri: URL.createObjectURL(blob), width: canvas.width, height: canvas.height };
    },
    getSupportedFeatures() {
      return { toggleRecordingAsyncAvailable: typeof MediaRecorder !== 'undefined', isModernBarcodeScannerAvailable: false };
    },
  }));

  return (
    <View style={style}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        aria-label="Camera preview"
        style={{ width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#000' }}
      />
    </View>
  );
});
