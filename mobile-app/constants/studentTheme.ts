import type { Href } from 'expo-router';

/** Student area palette (Finetution purple). Instructor and recorder screens use the matching theme in theme.ts. */
export const sColors = {
  primary: '#6D28D9',
  primaryDark: '#4C1D95',
  primaryLight: '#8B5CF6',
  soft: '#EDE9FE',
  softer: '#F5F3FF',
  gradientFrom: '#7C3AED',
  gradientTo: '#4F46E5',
  text: '#1F1235',
  muted: '#6B6880',
  border: '#E9E5F5',
  surface: '#FFFFFF',
  background: '#F7F5FD',
  green: '#16A34A',
  greenSoft: '#DCFCE7',
  amber: '#D97706',
  amberSoft: '#FEF3C7',
  red: '#DC2626',
  redSoft: '#FEE2E2',
  blue: '#2563EB',
  blueSoft: '#DBEAFE',
  white: '#FFFFFF',
} as const;

/** Soft accent per subject/card, cycled by index. */
export const accents = [
  { bg: '#EDE9FE', fg: '#6D28D9' },
  { bg: '#DBEAFE', fg: '#2563EB' },
  { bg: '#DCFCE7', fg: '#16A34A' },
  { bg: '#FEF3C7', fg: '#D97706' },
  { bg: '#FCE7F3', fg: '#DB2777' },
  { bg: '#CFFAFE', fg: '#0891B2' },
] as const;

export const sRadius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;

export const sShadow = {
  shadowColor: '#4C1D95',
  shadowOpacity: 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
} as const;

/** Student home tab (app/student/index.tsx). Typed explicitly because generated route types list it as /student/index. */
export const STUDENT_HOME = '/student' as Href;
