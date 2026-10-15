import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SENTIMENT_META } from "@/lib/analysis";
import type { Sentiment } from "@/types/analysis";

const ORDER: Sentiment[] = ["olumsuz", "notr", "olumlu"];

// Yorum duygu dağılımı: tek yığılmış çubuk, dilimler arasında 2px boşluk
export function SentimentBar({ counts, total }: { counts: Record<Sentiment, number>; total: number }) {
  if (total === 0) {
    return <p className="text-sm text-muted-foreground">Açık uçlu yorum yok.</p>;
  }
  return (
    <div className="space-y-2">
      <div className="flex h-4 w-full gap-0.5">
        {ORDER.filter((s) => counts[s] > 0).map((s) => (
          <Tooltip key={s}>
            <TooltipTrigger
              render={
                <div
                  tabIndex={0}
                  className="h-4 rounded-[4px] outline-none first:rounded-l-full last:rounded-r-full focus-visible:ring-2 focus-visible:ring-ring"
                  style={{ width: `${(counts[s] / total) * 100}%`, backgroundColor: SENTIMENT_META[s].color }}
                />
              }
            />
            <TooltipContent>
              {SENTIMENT_META[s].label}: <span className="font-semibold">{counts[s]}</span> yorum (
              {Math.round((counts[s] / total) * 100)}%)
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {ORDER.map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full border border-border"
              style={{ backgroundColor: SENTIMENT_META[s].color }}
              aria-hidden
            />
            <span className="text-muted-foreground">{SENTIMENT_META[s].label}</span>
            <span className="font-medium tabular-nums">{counts[s]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
