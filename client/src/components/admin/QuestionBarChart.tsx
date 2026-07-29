import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface QuestionBarChartProps {
  data: { label: string; count: number }[];
  total: number;
}

export function QuestionBarChart({ data, total }: QuestionBarChartProps) {
  if (total === 0) {
    return <p className="text-sm text-muted-foreground">Henüz cevap yok.</p>;
  }

  const maxCount = Math.max(0, ...data.map((d) => d.count));

  return (
    <div className="space-y-2">
      {data.map((item) => {
        const percentage = Math.round((item.count / total) * 100);
        const isMajority = maxCount > 0 && item.count === maxCount;

        return (
          <Tooltip key={item.label}>
            <TooltipTrigger
              render={
                <div
                  tabIndex={0}
                  className="flex items-center gap-3 rounded-sm px-1 py-0.5 outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                />
              }
            >
              <span
                className={cn(
                  "w-28 shrink-0 truncate text-sm sm:w-40",
                  isMajority ? "font-semibold text-foreground" : "text-muted-foreground"
                )}
                title={item.label}
              >
                {item.label}
              </span>
              <div className="h-5 flex-1 rounded-full bg-muted">
                <div
                  className={cn(
                    "h-5 rounded-r-[4px] transition-[width]",
                    isMajority ? "bg-primary" : "bg-primary/50"
                  )}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="w-20 shrink-0 text-right text-sm text-muted-foreground tabular-nums">
                {item.count} · %{percentage}
              </span>
              {isMajority && (
                <Badge variant="secondary" className="hidden shrink-0 sm:inline-flex">
                  Çoğunluk
                </Badge>
              )}
            </TooltipTrigger>
            <TooltipContent>
              <span className="font-semibold">{item.count}</span> kişi (%{percentage}) — {item.label}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
