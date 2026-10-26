import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { formatDuration } from '@/utils/date';

interface RecordingTimerProps {
  /** Epoch ms when recording started; null when not recording. */
  startedAt: number | null;
  /** Milliseconds spent paused so far (excluded from the elapsed time). */
  pausedMs?: number;
  /** Epoch ms when the current pause began, if paused. */
  pausedSince?: number | null;
}

export function elapsedSeconds(startedAt: number, pausedMs = 0, pausedSince: number | null = null, now = Date.now()) {
  const pauseNow = pausedSince ? now - pausedSince : 0;
  return Math.max(0, (now - startedAt - pausedMs - pauseNow) / 1000);
}

/** Red pill with a blinking dot, as on the mount phone's recording screen. */
export function RecordingTimer({ startedAt, pausedMs = 0, pausedSince = null }: RecordingTimerProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [startedAt]);

  if (!startedAt) return null;
  const seconds = elapsedSeconds(startedAt, pausedMs, pausedSince, now);
  const blinkOn = pausedSince ? true : Math.floor(now / 500) % 2 === 0;

  return (
    <View
      accessibilityRole="timer"
      accessibilityLabel={`${pausedSince ? 'Paused at' : 'Recording'} ${formatDuration(seconds)}`}
      style={styles.pill}
    >
      <View style={[styles.dot, { opacity: blinkOn ? 1 : 0.2, backgroundColor: pausedSince ? colors.amber : colors.red }]} />
      <Text style={styles.text}>{formatDuration(seconds)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignSelf: 'center',
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  text: { color: colors.white, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
