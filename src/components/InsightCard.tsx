import { Sparkles, ArrowRight } from "lucide-react";
import type { MentorInsightPresentation } from "@/lib/mentor-insights";
import { cn } from "@/lib/utils";

const toneStyles: Record<
  MentorInsightPresentation["tone"],
  { bg: string; ring: string; chip: string }
> = {
  sage: { bg: "bg-sage-soft", ring: "ring-sage/20", chip: "bg-sage text-background" },
  sky: { bg: "bg-sky-soft", ring: "ring-sky/20", chip: "bg-sky text-background" },
  gold: { bg: "bg-gold-soft", ring: "ring-gold/30", chip: "bg-gold text-ink" },
  clay: { bg: "bg-clay-soft", ring: "ring-clay/20", chip: "bg-clay text-background" },
};

const kindLabel = {
  pattern: "Padrão identificado",
  explanation: "Entendendo o momento",
  suggestion: "Sugestão gentil",
  question: "Quer conversar?",
};

export function InsightCard({
  insight,
  featured = false,
}: {
  insight: MentorInsightPresentation;
  featured?: boolean;
}) {
  const t = toneStyles[insight.tone];
  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border/60 p-6 ring-1 transition",
        t.bg,
        t.ring,
        featured && "p-7 sm:p-9",
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("grid h-7 w-7 place-items-center rounded-full", t.chip)}>
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <span className="text-[11px] uppercase tracking-[0.18em] text-ink-soft">
          Mentor &middot; {kindLabel[insight.kind]}
        </span>
      </div>
      <h3
        className={cn(
          "mt-4 font-serif leading-snug text-ink",
          featured ? "text-2xl sm:text-3xl" : "text-xl",
        )}
      >
        {insight.title}
      </h3>
      <p
        className={cn(
          "mt-3 leading-relaxed text-ink-soft",
          featured ? "text-base sm:text-[17px]" : "text-sm",
        )}
      >
        {insight.body}
      </p>
      {featured && (
        <button className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-medium text-background transition hover:opacity-90">
          Ver análise completa
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </article>
  );
}
