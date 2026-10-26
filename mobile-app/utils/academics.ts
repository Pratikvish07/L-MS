const ORDINALS = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'];

/** 1 → "First Year" */
export function yearLabel(year: number): string {
  const ordinal = ORDINALS[year - 1];
  return ordinal ? `${ordinal} Year` : `Year ${year}`;
}

/** "B.Tech CSE · Second Year" — stored as recordings.className for display and filtering. */
export function academicLabel(degree: string, streamCode: string, year: number): string {
  return [[degree, streamCode].filter(Boolean).join(' '), year ? yearLabel(year) : ''].filter(Boolean).join(' · ');
}
