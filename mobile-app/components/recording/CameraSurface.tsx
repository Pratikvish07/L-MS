/**
 * Camera used by the tripod screen. Android: expo-camera's CameraView.
 * Browser: CameraSurface.web.tsx (getUserMedia + MediaRecorder), which
 * implements the same methods the screen uses.
 */
import { CameraView } from 'expo-camera';

export const CameraSurface = CameraView;
export type CameraSurface = CameraView;
