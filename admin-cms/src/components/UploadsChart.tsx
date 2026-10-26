import { dayKey } from '../lib/format';
import type { Recording } from '../lib/types';

const SERIES = [
  { key: 'uploaded', label: 'Uploaded', color: '#0e9f6e' },
  { key: 'uploading', label: 'Uploading', color: '#60a5fa' },
  { key: 'failed', label: 'Failed', color: '#e02424' },
] as const;

type SeriesKey = (typeof SERIES)[number]['key'];

function bucket(r: Recording): SeriesKey | null {
  if (r.status === 'uploaded' || r.status === 'published') return 'uploaded';
  if (r.status === 'uploading' || r.status === 'saved_locally' || r.status === 'recording') return 'uploading';
  if (r.status === 'failed') return 'failed';
  return null;
}

/** Grouped bar chart of recordings per day for the 7 days ending on `endDate`. */
export function UploadsChart({ recordings, endDate }: { recordings: Recording[]; endDate: Date }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(endDate);
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const counts = days.map((d) => {
    const key = dayKey(d);
    const row: Record<SeriesKey, number> = { uploaded: 0, uploading: 0, failed: 0 };
    for (const r of recordings) {
      if (r.recordedAt && dayKey(r.recordedAt) === key) {
        const b = bucket(r);
        if (b) row[b] += 1;
      }
    }
    return row;
  });
  const max = Math.max(4, ...counts.flatMap((c) => Object.values(c)));
  const ticks = Array.from({ length: 5 }, (_, i) => Math.round((max * i) / 4));

  const W = 520;
  const H = 220;
  const pad = { l: 28, r: 8, t: 10, b: 28 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const group = plotW / 7;
  const bar = Math.min(12, (group - 12) / 3);
  const y = (v: number) => pad.t + plotH - (v / max) * plotH;

  const summary = days
    .map((d, i) => `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}: ${counts[i].uploaded} uploaded, ${counts[i].uploading} in progress, ${counts[i].failed} failed`)
    .join('; ');

  return (
    <div>
      <div className="chart-legend" aria-hidden>
        {SERIES.map((s) => (
          <span key={s.key}>
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Recordings over the last 7 days. ${summary}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#eef0f2" />
            <text x={pad.l - 6} y={y(t) + 4} fontSize="10" textAnchor="end" fill="#6b7280">
              {t}
            </text>
          </g>
        ))}
        {days.map((d, i) => {
          const x0 = pad.l + i * group + (group - bar * 3 - 4) / 2;
          return (
            <g key={i}>
              {SERIES.map((s, j) => {
                const v = counts[i][s.key];
                return (
                  <rect
                    key={s.key}
                    x={x0 + j * (bar + 2)}
                    y={y(v)}
                    width={bar}
                    height={Math.max(0, pad.t + plotH - y(v))}
                    rx="3"
                    fill={s.color}
                  >
                    <title>{`${s.label}: ${v}`}</title>
                  </rect>
                );
              })}
              <text x={pad.l + i * group + group / 2} y={H - 8} fontSize="10" textAnchor="middle" fill="#6b7280">
                {d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
