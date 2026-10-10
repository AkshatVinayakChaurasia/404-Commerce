import { inr } from "@/lib/format";

type Series = { key: string; label: string; color: string; dash?: string; values: number[] };

/**
 * Cumulative profit lines. Labels sit at the line ends (no legend box), so the
 * reader matches line to name without a lookup.
 */
export function ProfitChart({
  x,
  series,
  height = 260,
  xLabel,
}: {
  x: number[];
  series: Series[];
  height?: number;
  xLabel: string;
}) {
  const W = 640;
  const H = height;
  const pad = { l: 56, r: 150, t: 16, b: 34 };
  const all = series.flatMap((s) => s.values).concat(0);
  const max = Math.max(...all);
  const min = Math.min(...all);
  const span = max - min || 1;
  const xMax = x[x.length - 1] || 1;
  const px = (v: number) => pad.l + (v / xMax) * (W - pad.l - pad.r);
  const py = (v: number) => pad.t + (1 - (v - min) / span) * (H - pad.t - pad.b);
  const ticks = niceTicks(min, max, 4);

  // End labels are two lines tall; push them apart so close lines stay readable.
  const labelY = new Map<string, number>();
  const ends = series
    .map((s) => ({ key: s.key, y: py(s.values[s.values.length - 1] ?? 0) }))
    .sort((a, b) => a.y - b.y);
  let prev = -Infinity;
  for (const e of ends) {
    const y = Math.max(e.y, prev + 36);
    labelY.set(e.key, y);
    prev = y;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={series.map((s) => `${s.label}: ${inr(s.values[s.values.length - 1] ?? 0)}`).join("; ")}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={py(t)} y2={py(t)} stroke={t === 0 ? "var(--line-strong)" : "var(--line)"} />
          <text x={pad.l - 10} y={py(t) + 4} textAnchor="end" fontSize="12" fill="var(--muted)">
            {inr(t)}
          </text>
        </g>
      ))}
      <text x={pad.l} y={H - 8} fontSize="12" fill="var(--muted)">
        {xLabel}
      </text>
      {series.map((s) => {
        const d = s.values.map((v, i) => `${i ? "L" : "M"} ${px(x[i]).toFixed(1)} ${py(v).toFixed(1)}`).join(" ");
        const last = s.values[s.values.length - 1] ?? 0;
        return (
          <g key={s.key}>
            <path d={d} fill="none" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dash} strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={px(xMax)} cy={py(last)} r="4" fill={s.color} />
            <text x={px(xMax) + 12} y={(labelY.get(s.key) ?? py(last)) + 4} fontSize="13" fill="var(--text)" fontWeight="600">
              {inr(last)}
              <tspan x={px(xMax) + 12} dy="16" fontWeight="400" fill="var(--muted)" fontSize="12">
                {s.label}
              </tspan>
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function niceTicks(min: number, max: number, count: number): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v));
  if (!out.includes(0) && min <= 0 && max >= 0) out.push(0);
  return out.sort((a, b) => a - b);
}
