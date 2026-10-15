import { useState } from "react";
import { formatDecimal } from "@/lib/analysis";
import type { TermPoint } from "@/types/analysis";

// Geniş viewBox: SVG kart genişliğine ölçeklenirken yazılar ~12px civarında kalsın
const WIDTH = 900;
const HEIGHT = 260;
const PAD = { top: 24, right: 16, bottom: 32, left: 32 };
const Y_TICKS = [1, 2, 3, 4, 5];

// Dönem bazında genel ortalama puan (tek seri: başlık seriyi adlandırır, legend yok)
export function TrendChart({ terms }: { terms: TermPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const points = terms.filter((t) => t.mean !== null);

  if (points.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        Karşılaştırma için önceki dönem verisi yok
        {points.length === 1 && ` (bu dönem ortalaması: ${formatDecimal(points[0].mean!)})`}.
      </p>
    );
  }

  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * innerW;
  const y = (v: number) => PAD.top + ((5 - v) / 4) * innerH;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.mean!)}`).join(" ");
  const hovered = hover !== null ? points[hover] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label="Dönemlere göre ortalama puan"
        onMouseLeave={() => setHover(null)}
      >
        {Y_TICKS.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="12" fill="var(--muted-foreground)">
              {t}
            </text>
          </g>
        ))}
        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={PAD.top}
            y2={HEIGHT - PAD.bottom}
            stroke="var(--muted-foreground)"
            strokeDasharray="3 3"
          />
        )}
        <path d={path} fill="none" stroke="var(--viz-series-1)" strokeWidth={2} strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={p.term} onMouseEnter={() => setHover(i)}>
            {/* Dikey şerit isabet alanı: tüm sütun üzerinde hover */}
            <rect
              x={x(i) - innerW / (points.length - 1) / 2}
              y={PAD.top}
              width={innerW / (points.length - 1)}
              height={innerH}
              fill="transparent"
            />
            <circle cx={x(i)} cy={y(p.mean!)} r={hover === i ? 6 : 4.5} fill="var(--viz-series-1)" stroke="var(--card)" strokeWidth={2} />
            {/* İlk ve son etiket kenara hizalanır ki kesilmesin */}
            <text
              x={x(i)}
              y={HEIGHT - 10}
              textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
              fontSize="12"
              fill="var(--muted-foreground)"
            >
              {p.term}
            </text>
          </g>
        ))}
        {/* Son nokta doğrudan etiketlenir */}
        <text
          x={x(points.length - 1)}
          y={y(points[points.length - 1].mean!) - 12}
          textAnchor="end"
          fontSize="12"
          fontWeight="600"
          fill="var(--foreground)"
        >
          {formatDecimal(points[points.length - 1].mean!)}
        </text>
      </svg>
      {hovered && (
        <div
          className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
          style={{ left: `${(x(hover!) / WIDTH) * 100}%` }}
        >
          <div className="font-medium">{hovered.term}</div>
          <div>
            Ortalama <span className="font-semibold tabular-nums">{formatDecimal(hovered.mean!)}</span> ·{" "}
            {hovered.n_responses} cevap
          </div>
        </div>
      )}
    </div>
  );
}
