import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageBody, PageHeader, Section } from "@/components/ui-bits";
import { journal } from "@/lib/mockData";

export const Route = createFileRoute("/diario")({
  head: () => ({
    meta: [
      { title: "Diário — Life OS" },
      {
        name: "description",
        content:
          "Registre humor, energia, ansiedade e o que está vivendo. Seu diário alimenta os insights do mentor.",
      },
    ],
  }),
  component: Diario,
});

const moods = ["😞", "😕", "😐", "🙂", "😊"];

function Scale({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}/5</span>
      </div>
      <div className="mt-2 flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={
              n <= value
                ? "h-2 flex-1 rounded-full bg-ink transition"
                : "h-2 flex-1 rounded-full bg-secondary transition hover:bg-ink/30"
            }
          />
        ))}
      </div>
    </div>
  );
}

function Diario() {
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [anxiety, setAnxiety] = useState(3);

  return (
    <>
      <PageHeader
        eyebrow="Diário"
        title="Como você está hoje?"
        subtitle="Não precisa estar tudo certo. Escrever ajuda a entender — e o que você sente fala muito do que você gasta."
      />

      <PageBody>
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="card-soft p-6 sm:p-8">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Como me sinto agora
            </div>
            <div className="mt-4 flex items-center justify-between">
              {moods.map((m, i) => (
                <button
                  key={i}
                  onClick={() => setMood(i + 1)}
                  className={
                    mood === i + 1
                      ? "grid h-14 w-14 place-items-center rounded-2xl bg-ink text-2xl text-background transition"
                      : "grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-2xl transition hover:bg-ink/10"
                  }
                  aria-label={`Humor ${i + 1}`}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="mt-6 space-y-5">
              <Scale label="Energia" value={energy} onChange={setEnergy} />
              <Scale label="Ansiedade" value={anxiety} onChange={setAnxiety} />
            </div>

            <div className="mt-6">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                O que está vivendo?
              </label>
              <textarea
                rows={5}
                placeholder="Escreva sem filtro. Ninguém vê além de você e do seu mentor."
                className="mt-2 w-full resize-none rounded-2xl border border-border bg-surface-soft p-4 text-sm leading-relaxed outline-none transition focus:border-ink/30 focus:bg-surface"
              />
            </div>

            <div className="mt-4">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Uma gratidão de hoje
              </label>
              <input
                type="text"
                placeholder="Um momento, uma pessoa, uma pequena coisa…"
                className="mt-2 w-full rounded-full border border-border bg-surface-soft px-4 py-2.5 text-sm outline-none focus:border-ink/30 focus:bg-surface"
              />
            </div>

            <button className="mt-6 w-full rounded-full bg-ink py-3 text-sm font-medium text-background transition hover:opacity-90">
              Registrar este dia
            </button>
          </div>

          <Section title="Entradas recentes">
            <div className="space-y-3">
              {journal.map((j) => (
                <article key={j.id} className="card-soft p-5">
                  <div className="flex items-center justify-between">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      {new Date(j.date).toLocaleDateString("pt-BR", {
                        weekday: "long",
                        day: "2-digit",
                        month: "long",
                      })}
                    </div>
                    <span className="text-xl">{moods[j.mood - 1]}</span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-foreground">{j.text}</p>
                  {j.gratitude && (
                    <div className="mt-3 rounded-xl bg-gold-soft px-3 py-2 text-xs text-ink">
                      🙏 {j.gratitude}
                    </div>
                  )}
                  <div className="mt-3 flex gap-3 text-[11px] text-muted-foreground">
                    <span>Energia {j.energy}/5</span>
                    <span>·</span>
                    <span>Ansiedade {j.anxiety}/5</span>
                  </div>
                </article>
              ))}
            </div>
          </Section>
        </div>
      </PageBody>
    </>
  );
}
