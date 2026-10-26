import { useKeepAwake } from 'expo-keep-awake';

/** Keeps the screen on while recording or uploading (Android). */
export function useScreenAwake() {
  useKeepAwake();
}
