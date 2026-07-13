import { createFileRoute } from "@tanstack/react-router";
import { Plus, Flame } from "lucide-react";
import { PageBody, PageHeader, Section } from "@/components/ui-bits";
import { habits, projects } from "@/lib/mockData";

export const Route = createFileRoute("/habitos")({
  head: () => ({
    meta: [
      { title: "Hábitos — Life OS" },
      {
        name: "description",
        content: "Hábitos conectados aos seus projetos de vida. Pequenas escolhas, grande direção.",
      },
    ],
  }),
  component: Habitos,
});

const dayLabels = ["S", "T", "Q", "Q", "S", "S", "D"];
const areaTone = {
  saúde: "bg-sage-soft text-sage",
  dinheiro: "bg-gold-soft text-gold",
  rotina: "bg-secondary text-foreground",
  aprendizado: "bg-sky-soft text-sky",
  "bem-estar": "bg-sky-soft text-sky",
} as const;

function Habitos() {
  return (
    <>
      <PageHeader
        eyebrow="Hábitos"
        title="O que você está construindo, em silêncio."
        subtitle="Sequências, áreas da vida e o link com cada projeto."
        action={
          <button className="hidden items-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-xs font-medium text-background sm:inline-flex">
            <Plus className="h-3.5 w-3.5" /> Novo hábito
          </button>
        }
      />
      <PageBody>
        <Section title="Esta semana">
          <div className="grid gap-4 md:grid-cols-2">
            {habits.map((h) => {
              const project = projects.find((p) => p.id === h.projectId);
              return (
                <article key={h.id} className="card-soft p-5">
                  <header className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{h.emoji}</span>
                      <div>
                        <h3 className="font-medium">{h.name}</h3>
                        <div className="mt-1 flex items-center gap-2 text-xs">
                          <span
                            className={`rounded-full px-2 py-0.5 ${areaTone[h.area]}`}
                          >
                            {h.area}
                          </span>
                          {project && (
                            <span className="text-muted-foreground">→ {project.name}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 rounded-full bg-clay-soft px-2.5 py-1 text-xs text-clay">
                      <Flame className="h-3 w-3" /> {h.streak}
                    </div>
                  </header>

                  <div className="mt-5 grid grid-cols-7 gap-1.5">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div key={i} className="flex flex-col items-center gap-1.5">
                        <button
                          className={
                            i < h.weekDone
                              ? "grid h-9 w-full place-items-center rounded-xl bg-sage text-background"
                              : "h-9 w-full rounded-xl bg-secondary hover:bg-secondary/80"
                          }
                        >
                          {i < h.weekDone && "✓"}
                        </button>
                        <span className="text-[10px] text-muted-foreground">{dayLabels[i]}</span>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </Section>
      </PageBody>
    </>
  );
}
