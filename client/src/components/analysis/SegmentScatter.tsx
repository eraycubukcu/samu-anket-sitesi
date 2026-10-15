import { useState } from "react";
import { SERIES_COLORS } from "@/lib/analysis";
import type { Segments } from "@/types/analysis";

const WIDTH = 900;
const HEIGHT = 420;
const PAD = 16;
const MARK = 6; // ~12px işaret

// Renge ek olarak şekil: segmentler renk körlüğünde ve baskıda da ayırt edilsin
function Mark({ shape, x, y, color }: { shape: number; x: number; y: number; color: string }) {
  const common = { fill: color, stroke: "var(--card)", strokeWidth: 1.5 };
  if (shape === 1) return <rect x={x - MARK} y={y - MARK} width={MARK * 2} height={MARK * 2} rx={2} {...common} />;
  if (shape === 2)
    return <path d={`M${x},${y - MARK - 1} L${x + MARK + 1},${y + MARK} L${x - MARK - 1},${y + MARK} Z`} {...common} />;
  return <circle cx={x} cy={y} r={MARK} {...common} />;
}

export function SegmentScatter({ segments }: { segments: Segments }) {
  const [hover, setHover] = useState<number | null>(null);
  const xs = segments.points.map((p) => p.x);
  const ys = segments.points.map((p) => p.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const sx = (x: number) => PAD + ((x - minX) / (maxX - minX || 1)) * (WIDTH - PAD * 2);
  const sy = (y: number) => HEIGHT - PAD - ((y - minY) / (maxY - minY || 1)) * (HEIGHT - PAD * 2);
  const nameOf = new Map(segments.clusters.map((c) => [c.id, c.name]));
  // Renk, segmentin kimliğine (id) bağlı; sıralamaya göre değişmez
  const colorOf = (id: number) => SERIES_COLORS[id % SERIES_COLORS.length];
  const hovered = hover !== null ? segments.points[hover] : null;

  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {segments.clusters.map((c) => (
          <li key={c.id} className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <Mark shape={c.id} x={7} y={7} color={colorOf(c.id)} />
            </svg>
            <span>{c.name}</span>
            <span className="text-muted-foreground tabular-nums">{c.size} kişi</span>
          </li>
        ))}
      </ul>
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full rounded-lg border bg-card"
          role="img"
          aria-label="Öğrenci segmentleri dağılım grafiği"
          onMouseLeave={() => setHover(null)}
        >
          {segments.points.map((p, i) => (
            <g key={i} onMouseEnter={() => setHover(i)} className="cursor-default">
              {/* İşaretten büyük, görünmez isabet alanı */}
              <circle cx={sx(p.x)} cy={sy(p.y)} r={MARK + 5} fill="transparent" />
              <g opacity={hover === null || hover === i ? 0.9 : 0.35}>
                <Mark shape={p.cluster} x={sx(p.x)} y={sy(p.y)} color={colorOf(p.cluster)} />
              </g>
            </g>
          ))}
        </svg>
        {hovered && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
            style={{
              left: `${(sx(hovered.x) / WIDTH) * 100}%`,
              top: `calc(${(sy(hovered.y) / HEIGHT) * 100}% - 10px)`,
            }}
          >
            Bir öğrenci · <span className="font-medium">{nameOf.get(hovered.cluster)}</span>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Her nokta bir öğrencinin cevap profilidir (PCA ile 2 boyuta indirgenmiş). Eksenlerin birimi yoktur;
        yakın noktalar benzer cevap veren öğrencilerdir.
      </p>
    </div>
  );
}
