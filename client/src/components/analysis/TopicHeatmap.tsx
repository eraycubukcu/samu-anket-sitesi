import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DIMENSION_LABELS } from "@/lib/course";
import { divergingColor, divergingInk, formatDecimal } from "@/lib/analysis";
import type { TopicResult } from "@/types/analysis";

const DIMENSIONS = ["icerik", "sinav", "materyal"] as const;

// Konu × boyut ortalama puanı. Değer her hücrede yazılı; renk ek bir ipucu.
export function TopicHeatmap({ topics }: { topics: TopicResult[] }) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0.5 text-sm">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left font-medium text-muted-foreground">Konu</th>
              {DIMENSIONS.map((d) => (
                <th key={d} className="px-2 py-1 text-center font-medium text-muted-foreground">
                  {DIMENSION_LABELS[d]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topics.map((t) => (
              <tr key={t.topic}>
                <th scope="row" className="max-w-48 truncate px-2 py-1 text-left font-normal" title={t.topic}>
                  {t.topic}
                </th>
                {DIMENSIONS.map((d) => {
                  const value = t.dimension_means[d];
                  if (value === undefined) {
                    return (
                      <td key={d} className="rounded-md bg-muted px-2 py-2 text-center text-muted-foreground">
                        —
                      </td>
                    );
                  }
                  return (
                    <td key={d} className="p-0">
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <div
                              tabIndex={0}
                              className="rounded-md px-2 py-2 text-center font-medium tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              style={{ backgroundColor: divergingColor(value), color: divergingInk(value) }}
                            />
                          }
                        >
                          {formatDecimal(value)}
                        </TooltipTrigger>
                        <TooltipContent>
                          {t.topic} · {DIMENSION_LABELS[d]}: <span className="font-semibold">{formatDecimal(value)}</span> / 5
                        </TooltipContent>
                      </Tooltip>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>1 · zayıf</span>
        <div
          className="h-2 w-40 rounded-full"
          style={{
            background:
              "linear-gradient(to right, var(--viz-div-neg), var(--viz-div-mid), var(--viz-div-pos))",
          }}
          aria-hidden
        />
        <span>5 · güçlü</span>
        <span className="ml-1">(3 = nötr)</span>
      </div>
    </div>
  );
}
