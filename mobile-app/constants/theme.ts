export const colors = {
  primary: '#0E9F6E',
  primaryDark: '#057A55',
  primarySoft: '#E7F7EF',
  blue: '#2563EB',
  blueSoft: '#E8F0FE',
  red: '#E02424',
  redSoft: '#FDECEC',
  amber: '#D97706',
  amberSoft: '#FEF3C7',
  text: '#111827',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  surface: '#FFFFFF',
  background: '#F6F8F7',
  dark: '#0B0F0E',
  darkSurface: '#1C2321',
  darkBorder: '#2D3633',
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
