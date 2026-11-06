'use client';

import React, { useCallback, useState } from 'react';
import type { SummaryPoint } from '../../lib/types';

/**
 * Daily transactions as four lines: Completed, Failed, Reversed and Total.
 * Hand-rolled SVG (the portal ships no charting library): one y-axis, 2px
 * lines, a crosshair that snaps to the nearest day with one tooltip listing
 * every series, a legend, and a table view of the same numbers.
 */

type SeriesKey = 'total' | 'completed' | 'failed' | 'reversed';

const SERIES: readonly { key: SeriesKey; label: string; color: string }[] = [
  { key: 'total', label: 'Total', color: 'var(--chart-total)' },
  { key: 'completed', label: 'Completed', color: 'var(--chart-completed)' },
  { key: 'failed', label: 'Failed', color: 'var(--chart-failed)' },
  { key: 'reversed', label: 'Reversed', color: 'var(--chart-reversed)' },
];

const HEIGHT = 240;
const MARGIN = { top: 12, right: 16, bottom: 28, left: 44 };

/** Days arrive as yyyy-mm-dd Lagos days; format them without shifting. */
const dayLabel = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayLong = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const asDate = (day: string) => new Date(`${day}T00:00:00Z`);

/** Round ticks from 0 to at least `max`: steps of 1, 2 or 5 × 10ⁿ. */
function niceTicks(max: number, target = 4): number[] {
  if (max <= 0) return [0, 1, 2, 3, 4];
  const rough = max / target;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= rough) ?? 10 * power;
  const wholeStep = Math.max(1, step);
  const ticks: number[] = [];
  for (let v = 0; v < max + wholeStep; v += wholeStep) ticks.push(v);
  return ticks;
}

const tickText = (v: number) =>
  new Intl.NumberFormat(undefined, { notation: v >= 10_000 ? 'compact' : 'standard' }).format(v);

export function TransactionsChart({ points }: { points: SummaryPoint[] }) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  // Measure the container so text stays at its real size at any width.
  const measure = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const n = points.length;
  const ticks = niceTicks(Math.max(0, ...points.map((p) => p.total)));
  const yMax = ticks[ticks.length - 1];
  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const x = (i: number) => MARGIN.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => MARGIN.top + plotH - (v / yMax) * plotH;

  // About six date labels, whatever the window.
  const labelEvery = Math.max(1, Math.ceil(n / 6));
  const xLabels = points
    .map((p, i) => ({ i, date: p.date }))
    .filter(({ i }) => (n - 1 - i) % labelEvery === 0);

  const nearest = (clientX: number, rect: DOMRect) => {
    if (n === 0 || plotW <= 0) return null;
    const ratio = (clientX - rect.left - MARGIN.left) / plotW;
    return Math.min(n - 1, Math.max(0, Math.round(ratio * (n - 1))));
  };

  const onKeyDown = (event: React.KeyboardEvent<SVGSVGElement>) => {
    if (n === 0) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const step = event.key === 'ArrowRight' ? 1 : -1;
      setActive((current) => Math.min(n - 1, Math.max(0, (current ?? (step > 0 ? -1 : n)) + step)));
    } else if (event.key === 'Escape') {
      setActive(null);
    }
  };

  const shown = active === null ? null : points[active];
  const tooltipLeft = active === null ? 0 : x(active);
  const flip = tooltipLeft > width / 2;

  return (
    <figure className="m-0">
      <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted" aria-label="Legend">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-0.5 w-4 rounded-full" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>

      <div ref={measure} className="relative" style={{ height: HEIGHT }}>
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`Transactions per day over ${n} days: total, completed, failed and reversed. Use the arrow keys to read each day.`}
            tabIndex={0}
            className="block outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            onPointerMove={(event) => setActive(nearest(event.clientX, event.currentTarget.getBoundingClientRect()))}
            onPointerLeave={() => setActive(null)}
            onKeyDown={onKeyDown}
            onBlur={() => setActive(null)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={MARGIN.left}
                  x2={MARGIN.left + plotW}
                  y1={y(t)}
                  y2={y(t)}
                  stroke={t === 0 ? 'var(--chart-axis)' : 'var(--chart-grid)'}
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <text
                  x={MARGIN.left - 8}
                  y={y(t)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-muted text-[11px] tabular-nums"
                >
                  {tickText(t)}
                </text>
              </g>
            ))}
            {xLabels.map(({ i, date }) => (
              <text
                key={date}
                x={x(i)}
                y={HEIGHT - 8}
                textAnchor={i === 0 && n > 1 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle'}
                className="fill-muted text-[11px]"
              >
                {dayLabel.format(asDate(date))}
              </text>
            ))}

            {active !== null && (
              <line
                x1={x(active)}
                x2={x(active)}
                y1={MARGIN.top}
                y2={MARGIN.top + plotH}
                stroke="var(--chart-axis)"
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
            )}

            {SERIES.map((s) => (
              <path
                key={s.key}
                d={points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p[s.key])}`).join('')}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}

            {/* End dots, or the hovered day's dots, ringed in the surface colour. */}
            {n > 0 &&
              SERIES.map((s) => {
                const i = active ?? n - 1;
                return (
                  <circle
                    key={s.key}
                    cx={x(i)}
                    cy={y(points[i][s.key])}
                    r={4}
                    fill={s.color}
                    stroke="var(--surface)"
                    strokeWidth={2}
                  />
                );
              })}
          </svg>
        )}

        {shown && (
          <div
            role="status"
            className="pointer-events-none absolute top-2 z-10 min-w-[10rem] rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-xs shadow-lg"
            style={flip ? { right: width - tooltipLeft + 12 } : { left: tooltipLeft + 12 }}
          >
            <p className="mb-1 text-muted">{dayLong.format(asDate(shown.date))}</p>
            {SERIES.map((s) => (
              <p key={s.key} className="flex items-center gap-2">
                <span aria-hidden="true" className="inline-block h-0.5 w-3 rounded-full" style={{ background: s.color }} />
                <span className="font-semibold tabular-nums text-foreground">{shown[s.key].toLocaleString()}</span>
                <span className="text-muted">{s.label}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-muted hover:text-foreground">Show as table</summary>
        <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-surface-border">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-surface-raised text-muted">
              <tr>
                <th className="px-3 py-1.5 font-semibold">Day</th>
                {SERIES.map((s) => (
                  <th key={s.key} className="px-3 py-1.5 text-right font-semibold">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.date} className="border-t border-surface-border">
                  <td className="px-3 py-1.5 text-muted">{dayLong.format(asDate(p.date))}</td>
                  {SERIES.map((s) => (
                    <td key={s.key} className="px-3 py-1.5 text-right tabular-nums text-foreground">
                      {p[s.key].toLocaleString()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
