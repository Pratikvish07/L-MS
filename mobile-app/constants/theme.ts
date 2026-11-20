/** Finetution purple, shared by the instructor (faculty) and recorder (mount) apps. Students: studentTheme.ts. */
export const colors = {
  primary: '#6D28D9',
  primaryDark: '#4C1D95',
  primarySoft: '#EDE9FE',
  blue: '#2563EB',
  blueSoft: '#E8F0FE',
  red: '#E02424',
  redSoft: '#FDECEC',
  green: '#16A34A',
  greenSoft: '#DCFCE7',
  amber: '#D97706',
  amberSoft: '#FEF3C7',
  text: '#1F1235',
  textMuted: '#6B6880',
  border: '#E9E5F5',
  surface: '#FFFFFF',
  background: '#F7F5FD',
  dark: '#120B24',
  darkSurface: '#1E1536',
  darkBorder: '#33284F',
  white: '#FFFFFF',
} as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const font = {
  title: { fontSize: 22, fontWeight: '700' as const, color: colors.text },
  heading: { fontSize: 17, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 15, color: colors.text },
  label: { fontSize: 13, fontWeight: '500' as const, color: colors.textMuted },
  caption: { fontSize: 12, color: colors.textMuted },
};
