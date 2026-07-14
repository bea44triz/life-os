import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { PageBody, PageHeader, brl } from "@/components/ui-bits";
import { habits, insights } from "@/lib/mockData";
import { InsightCard } from "@/components/InsightCard";
import { useProjects } from "@/lib/finance-hooks";

export const Route = createFileRoute("/projetos")({
  head: () => ({
    meta: [
      { title: "Projetos — Life OS" },
      {
        name: "description",
        content: "Seus projetos de vida e como dinheiro, hábitos e humor estão impactando cada um.",
      },
    ],
  }),
  component: Projetos,
});

const toneBg = {
  gold: "from-gold-soft to-surface",
  sage: "from-sage-soft to-surface",
  sky: "from-sky-soft to-surface",
} as const;

function Projetos() {
  const { data: liveProjects = [], isLoading } = useProjects();
  const hasProjects = liveProjects.length > 0;

  return (
    <>
      <PageHeader
        eyebrow="Projetos"
        title="O que dá direção à sua vida."
        subtitle="Cada projeto cruza um objetivo financeiro com um objetivo de comportamento."
        action={
          <button
            disabled
            className="hidden items-center gap-1.5 rounded-full bg-ink/70 px-4 py-2.5 text-xs font-medium text-background opacity-70 cursor-not-allowed sm:inline-flex"
          >
            <Plus className="h-3.5 w-3.5" /> Novo projeto
          </button>
        }
      />
      <PageBody>
        {isLoading ? (
          <div className="card-soft p-6 text-center text-sm text-muted-foreground">
            Carregando seus projetos...
          </div>
        ) : !hasProjects ? (
          <div className="card-soft p-6 text-center">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Sem projetos ainda
            </div>
            <h2 className="mt-3 font-serif text-2xl">Nenhum projeto encontrado</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Crie seu primeiro projeto assim que quiser conectar suas metas financeiras e de comportamento.
            </p>
            <div className="mt-4">
              <button
                disabled
                className="rounded-full bg-ink px-4 py-2.5 text-xs font-medium text-background opacity-70 cursor-not-allowed"
              >
                Novo projeto
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6">
            {liveProjects.map((p) => {
              const goalAmount = (p as any).goalAmount as number | undefined;
              const savedAmount = (p as any).savedAmount as number | undefined;
              const fin = goalAmount ? Math.round(((savedAmount ?? 0) / goalAmount) * 100) : null;
              const beh = (p as any).behavioralProgress as number | undefined;
              const deadline = (p as any).deadline as string | undefined;
              const tone = (p as any).tone as keyof typeof toneBg | undefined;
              const emoji = (p as any).emoji ?? "📌";
              const description =
                (p as any).description ??
                (p.status ? `Status: ${p.status}` : p.type ? `Tipo: ${p.type}` : "Sem descrição disponível");
              const deadlineLabel = deadline ?? (p.status ? `Status: ${p.status}` : p.type ? `Tipo: ${p.type}` : "Sem prazo");
              const linkedHabits = habits.filter((h) => h.projectId === p.id);
              const linkedInsights = insights.filter((i) => i.related.includes(p.id));

              return (
                <article
                  key={p.id}
                  className={`card-soft overflow-hidden bg-gradient-to-br ${tone ? toneBg[tone] : "from-surface to-surface"}`}
                >
                  <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.4fr_1fr]">
                    <div>
                      <div className="flex items-start gap-4">
                        <span className="text-4xl">{emoji}</span>
                        <div className="min-w-0">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                            {deadlineLabel}
                          </div>
                          <h3 className="mt-1 font-serif text-2xl leading-tight sm:text-3xl">
                            {p.name}
                          </h3>
                          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                            {description}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 grid gap-5 sm:grid-cols-2">
                        {fin !== null && (
                          <div className="rounded-2xl bg-surface/80 p-4 backdrop-blur">
                            <div className="text-xs uppercase tracking-wider text-muted-foreground">
                              Financeiro
                            </div>
                            <div className="mt-2 font-serif text-2xl">
                              {brl(savedAmount ?? 0)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              de {brl(goalAmount ?? 0)}
                            </div>
                            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                              <div
                                className="h-full rounded-full bg-gold"
                                style={{ width: `${fin}%` }}
                              />
                            </div>
                            <div className="mt-1 text-[11px] font-medium">{fin}%</div>
                          </div>
                        )}
                        {beh !== null && typeof beh === "number" && (
                          <div className="rounded-2xl bg-surface/80 p-4 backdrop-blur">
                            <div className="text-xs uppercase tracking-wider text-muted-foreground">
                              Comportamento
                            </div>
                            <div className="mt-2 text-sm">{(p as any).behavioralGoal ?? "Meta comportamental não disponível"}</div>
                            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                              <div
                                className="h-full rounded-full bg-sage"
                                style={{ width: `${beh}%` }}
                              />
                            </div>
                            <div className="mt-1 text-[11px] font-medium">{beh}%</div>
                          </div>
                        )}
                      </div>

                      {linkedHabits.length > 0 && (
                        <div className="mt-5">
                          <div className="text-xs uppercase tracking-wider text-muted-foreground">
                            Hábitos vinculados
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {linkedHabits.map((h) => (
                              <span
                                key={h.id}
                                className="rounded-full bg-surface/80 px-3 py-1.5 text-xs"
                              >
                                {h.emoji} {h.name} · {h.weekDone}/7
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      {linkedInsights.length > 0 ? (
                        linkedInsights.map((i) => <InsightCard key={i.id} insight={i} />)
                      ) : (
                        <div className="card-soft bg-surface/80 p-5 text-sm text-muted-foreground">
                          Ainda não percebi padrões fortes aqui. Continue registrando — em alguns dias
                          eu te mostro o que está se conectando.
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </PageBody>
    </>
  );
}
