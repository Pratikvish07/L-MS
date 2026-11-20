// Small, dependency-free SVG charts for the admin dashboard.
// One series per chart (never two y-axes), thin 2px lines, recessive grid,
// crosshair + tooltip on hover/focus, and a text summary for screen readers.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

export const SERIES = '#7c3aed';

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** "Nice" upper bound and 4 ticks for a 0-based y-axis. */
function niceTicks(max: number) {
  if (max <= 0) return [0, 1, 2, 3, 4];
  const rough = max / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((m) => m >= rough) ?? 10 * pow;
  return [0, 1, 2, 3, 4].map((i) => Math.round(i * step * 100) / 100);
}

/** Tiny trend line for KPI tiles (decorative: the tile states the number and change). */
export function Sparkline({ values, color = SERIES, height = 36 }: { values: number[]; color?: string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const id = useId();
  const max = Math.max(1, ...values);
  const w = Math.max(width, 1);
  const pts = values.map((v, i) => [values.length > 1 ? (i / (values.length - 1)) * w : 0, height - 3 - (v / max) * (height - 6)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <div ref={ref} style={{ width: '100%', height }} aria-hidden>
      {width > 0 && values.length > 1 && (
        <svg width={w} height={height}>
          <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.22" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
          <path d={`${line} L${w},${height} L0,${height} Z`} fill={`url(#${id})`} />
          <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}

export interface SeriesPoint { key: string; label: string; value: number; }

/** Single-series area chart with crosshair tooltip (mouse, touch and arrow keys). */
export function AreaChart({ points, format, label, height = 260 }: { points: SeriesPoint[]; format: (v: number) => string; label: string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();
  const pad = { top: 16, right: 12, bottom: 28, left: 52 };
  const innerW = Math.max(1, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const ticks = niceTicks(Math.max(0, ...points.map((p) => p.value)));
  const top = ticks[ticks.length - 1] || 1;
  const x = (i: number) => pad.left + (points.length > 1 ? (i / (points.length - 1)) * innerW : innerW / 2);
  const y = (v: number) => pad.top + innerH - (v / top) * innerH;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(innerW / 64))));
  const total = points.reduce((sum, p) => sum + p.value, 0);

  const pick = (clientX: number, rect: DOMRect) => {
    const rel = clientX - rect.left - pad.left;
    setHover(Math.max(0, Math.min(points.length - 1, Math.round((rel / innerW) * (points.length - 1)))));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') setHover((h) => Math.min(points.length - 1, (h ?? -1) + 1));
    if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? points.length) - 1));
    if (e.key === 'Escape') setHover(null);
  };
  const active = hover !== null ? points[hover] : null;

  return (
    <div ref={ref} className="chart" style={{ height }}>
      <span className="sr-only">{label}: {points.length} days, total {format(total)}, highest {format(Math.max(0, ...points.map((p) => p.value)))}.</span>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label} tabIndex={0} onKeyDown={onKey} onBlur={() => setHover(null)}
          onMouseMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())} onMouseLeave={() => setHover(null)}
          onTouchMove={(e) => pick(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}>
          <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={SERIES} stopOpacity="0.24" /><stop offset="1" stopColor={SERIES} stopOpacity="0.02" /></linearGradient></defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={pad.left + innerW} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
              <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="chart-axis">{format(t)}</text>
            </g>
          ))}
          {points.map((p, i) => (i % labelEvery === 0 || i === points.length - 1) && (
            <text key={p.key} x={x(i)} y={height - 8} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} className="chart-axis">{p.label}</text>
          ))}
          {points.length > 1 && <path d={`${line} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#${id})`} />}
          <path d={line} fill="none" stroke={SERIES} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {active && hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} stroke="var(--muted)" strokeDasharray="3 3" strokeWidth={1} />
              <circle cx={x(hover)} cy={y(active.value)} r={5} fill={SERIES} stroke="var(--surface)" strokeWidth={2} />
            </g>
          )}
        </svg>
      )}
      {active && hover !== null && (
        <div className="chart-tip" style={{ left: Math.min(Math.max(x(hover), 70), width - 70), top: Math.max(0, y(active.value) - 58) }} role="status">
          <strong>{active.label}</strong>
          <span><i style={{ background: SERIES }} /> {format(active.value)}</span>
        </div>
      )}
    </div>
  );
}

/** Horizontal magnitude bars (one hue), value labelled at the end; for ranked lists. */
export function BarList({ rows, format = (v) => `${Math.round(v)}%`, max }: { rows: { key: string; label: string; value: number; sub?: string }[]; format?: (v: number) => string; max?: number }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="barlist">
      {rows.map((r) => (
        <li key={r.key} title={`${r.label}: ${format(r.value)}${r.sub ? ` · ${r.sub}` : ''}`}>
          <div className="barlist-head"><span>{r.label}</span><strong>{format(r.value)}</strong></div>
          <div className="barlist-track"><span style={{ width: `${Math.max(2, (r.value / top) * 100)}%` }} /></div>
          {r.sub && <small>{r.sub}</small>}
        </li>
      ))}
    </ul>
  );
}
