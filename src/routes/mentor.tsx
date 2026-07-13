import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Send } from "lucide-react";
import { PageBody, PageHeader, Section } from "@/components/ui-bits";
import { InsightCard } from "@/components/InsightCard";
import { insights } from "@/lib/mockData";

export const Route = createFileRoute("/mentor")({
  head: () => ({
    meta: [
      { title: "Mentor IA — Life OS" },
      {
        name: "description",
        content: "Seu mentor pessoal cruza finanças, hábitos, humor e projetos para te mostrar padrões.",
      },
    ],
  }),
  component: Mentor,
});

const suggestions = [
  "Onde meu dinheiro está fora do que importa pra mim?",
  "Meus hábitos estão ajudando o projeto Japão?",
  "O que mudou na minha rotina nas últimas duas semanas?",
  "Como meu humor afetou meus gastos este mês?",
];

function Mentor() {
  return (
    <>
      <PageHeader
        eyebrow="Mentor IA"
        title="Aqui pra te ajudar a enxergar."
        subtitle="Não pra te julgar — pra te mostrar conexões que escapam no dia a dia."
      />
      <PageBody>
        <div className="card-soft overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border/60 bg-surface-soft px-5 py-4">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-ink text-background">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-medium">Mentor</div>
              <div className="text-xs text-muted-foreground">
                Conectado a finanças, cartões, diário, hábitos e projetos
              </div>
            </div>
          </div>

          <div className="space-y-4 p-5 sm:p-6">
            <div className="max-w-2xl rounded-2xl rounded-tl-md bg-secondary/80 p-4 text-sm leading-relaxed">
              Bom te ver, Beatriz. Olhei seus últimos 7 dias e quero te mostrar um padrão que pode
              te interessar. Posso?
            </div>
            <div className="ml-auto max-w-2xl rounded-2xl rounded-tr-md bg-ink p-4 text-sm leading-relaxed text-background">
              Pode sim. O que você viu?
            </div>
            <div className="max-w-2xl rounded-2xl rounded-tl-md bg-secondary/80 p-4 text-sm leading-relaxed">
              Percebi que seus gastos com delivery aumentaram nos mesmos dias em que você registrou
              ansiedade mais alta e sono menor. Isso pode estar diminuindo o ritmo do seu projeto
              de emagrecimento e também afetando sua meta de economia para o Japão. Uma alternativa
              simples seria deixar duas refeições práticas planejadas para os dias mais intensos.
              Faz sentido pra você?
            </div>
          </div>

          <div className="flex flex-wrap gap-2 px-5 pb-4">
            {suggestions.map((s) => (
              <button
                key={s}
                className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>

          <div className="border-t border-border/60 p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-full border border-border bg-surface-soft px-4 py-2">
              <input
                className="bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Pergunte ao seu mentor…"
              />
              <button className="grid h-8 w-8 place-items-center rounded-full bg-ink text-background">
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        <Section title="Padrões que percebi essa semana">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {insights.map((i) => (
              <InsightCard key={i.id} insight={i} />
            ))}
          </div>
        </Section>
      </PageBody>
    </>
  );
}
