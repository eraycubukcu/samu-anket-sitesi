import { DECISION_META } from "@/lib/analysis";
import { cn } from "@/lib/utils";
import type { Decision } from "@/types/analysis";

// Durum rengi + ikon + etiket: renk körü kullanıcılar da kararı okuyabilsin
export function DecisionBadge({ decision, className }: { decision: Decision; className?: string }) {
  const meta = DECISION_META[decision];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-foreground",
        className,
      )}
      style={{
        borderColor: meta.color,
        backgroundColor: `color-mix(in oklab, ${meta.color} 14%, transparent)`,
      }}
    >
      <Icon className="size-3.5 shrink-0" style={{ color: meta.color }} aria-hidden />
      {meta.label}
    </span>
  );
}
