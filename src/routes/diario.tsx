import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Heart, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { PageBody, PageHeader, Section } from "@/components/ui-bits";
import {
  useCreateJournalEntry,
  useCreateWellbeingLog,
  useDeleteJournalEntry,
  useDeleteWellbeingLog,
  useRecentJournalEntries,
  useWellbeingLogs,
} from "@/lib/finance-hooks";

export const Route = createFileRoute("/diario")({
  head: () => ({
    meta: [
      { title: "Diário — Life OS" },
      {
        name: "description",
        content: "Registre humor, energia, ansiedade e o que está vivendo.",
      },
    ],
  }),
  component: Diario,
});

const moods = ["😞", "😕", "😐", "🙂", "😊"];

function Scale({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}/5</span>
      </div>
      <div className="mt-2 flex gap-1.5">
        {[1, 2, 3, 4, 5].map((number) => (
          <button
            key={number}
            type="button"
            onClick={() => onChange(number)}
            className={
              number <= value
                ? "h-2 flex-1 rounded-full bg-ink transition"
                : "h-2 flex-1 rounded-full bg-secondary transition hover:bg-ink/30"
            }
            aria-label={`${label} ${number} de 5`}
          />
        ))}
      </div>
    </div>
  );
}

function formatEntryDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function formatNoteDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Diario() {
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [anxiety, setAnxiety] = useState(3);
  const [content, setContent] = useState("");
  const [gratitude, setGratitude] = useState("");
  const [wellbeingNote, setWellbeingNote] = useState("");

  const journalEntries = useRecentJournalEntries(5);
  const wellbeingLogs = useWellbeingLogs();
  const createJournalEntry = useCreateJournalEntry();
  const deleteJournalEntry = useDeleteJournalEntry();
  const createWellbeingLog = useCreateWellbeingLog();
  const deleteWellbeingLog = useDeleteWellbeingLog();

  async function handleJournalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      toast.error("Escreva algo sobre o seu dia antes de registrar.");
      return;
    }

    try {
      await createJournalEntry.mutateAsync({
        mood,
        energy,
        anxiety,
        gratitude: gratitude.trim() || null,
        content: trimmedContent,
      });
      setContent("");
      setGratitude("");
      toast.success("Entrada registrada.");
    } catch {
      toast.error("Não foi possível registrar a entrada.");
    }
  }

  async function handleDeleteJournalEntry(id: string) {
    if (!window.confirm("Excluir esta entrada do diário?")) return;
    try {
      await deleteJournalEntry.mutateAsync(id);
      toast.success("Entrada excluída.");
    } catch {
      toast.error("Não foi possível excluir a entrada.");
    }
  }

  async function handleWellbeingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const notes = wellbeingNote.trim();
    if (!notes) return;

    try {
      await createWellbeingLog.mutateAsync({ notes });
      setWellbeingNote("");
      toast.success("Nota de bem-estar salva.");
    } catch {
      toast.error("Não foi possível salvar a nota.");
    }
  }

  async function handleDeleteWellbeingLog(id: string) {
    if (!window.confirm("Excluir esta nota de bem-estar?")) return;
    try {
      await deleteWellbeingLog.mutateAsync(id);
      toast.success("Nota excluída.");
    } catch {
      toast.error("Não foi possível excluir a nota.");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Diário"
        title="Como você está hoje?"
        subtitle="Não precisa estar tudo certo. Escrever ajuda a entender o que você está vivendo."
      />

      <PageBody>
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <form className="card-soft p-6 sm:p-8" onSubmit={handleJournalSubmit}>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Como me sinto agora
            </div>
            <div className="mt-4 flex items-center justify-between">
              {moods.map((emoji, index) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setMood(index + 1)}
                  className={
                    mood === index + 1
                      ? "grid h-14 w-14 place-items-center rounded-2xl bg-ink text-2xl text-background transition"
                      : "grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-2xl transition hover:bg-ink/10"
                  }
                  aria-label={`Humor ${index + 1} de 5`}
                  aria-pressed={mood === index + 1}
                >
                  {emoji}
                </button>
              ))}
            </div>

            <div className="mt-6 space-y-5">
              <Scale label="Energia" value={energy} onChange={setEnergy} />
              <Scale label="Ansiedade" value={anxiety} onChange={setAnxiety} />
            </div>

            <div className="mt-6">
              <label
                htmlFor="journal-content"
                className="text-xs uppercase tracking-wider text-muted-foreground"
              >
                O que está vivendo?
              </label>
              <textarea
                id="journal-content"
                rows={5}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Escreva sem filtro. Este espaço é seu."
                className="mt-2 w-full resize-none rounded-2xl border border-border bg-surface-soft p-4 text-sm leading-relaxed outline-none transition focus:border-ink/30 focus:bg-surface"
              />
            </div>

            <div className="mt-4">
              <label
                htmlFor="journal-gratitude"
                className="text-xs uppercase tracking-wider text-muted-foreground"
              >
                Uma gratidão de hoje
              </label>
              <input
                id="journal-gratitude"
                type="text"
                value={gratitude}
                onChange={(event) => setGratitude(event.target.value)}
                placeholder="Um momento, uma pessoa, uma pequena coisa…"
                className="mt-2 w-full rounded-full border border-border bg-surface-soft px-4 py-2.5 text-sm outline-none focus:border-ink/30 focus:bg-surface"
              />
            </div>

            <button
              type="submit"
              disabled={createJournalEntry.isPending || !content.trim()}
              className="mt-6 w-full rounded-full bg-ink py-3 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createJournalEntry.isPending ? "Registrando…" : "Registrar este dia"}
            </button>
          </form>

          <Section title="Entradas recentes">
            {journalEntries.isPending ? (
              <div className="card-soft p-6 text-sm text-muted-foreground">
                Carregando entradas…
              </div>
            ) : journalEntries.isError ? (
              <div className="card-soft p-6 text-sm text-clay">
                Não foi possível carregar suas entradas agora.
              </div>
            ) : journalEntries.data.length === 0 ? (
              <div className="card-soft grid min-h-52 place-items-center p-8 text-center">
                <div>
                  <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-3 font-serif text-xl">Seu diário começa aqui</p>
                  <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                    Registre como você está se sentindo. Suas entradas recentes aparecerão neste
                    espaço.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {journalEntries.data.map((entry) => (
                  <article key={entry.id} className="card-soft p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">
                        {formatEntryDate(entry.created_at)}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{moods[entry.mood - 1] ?? moods[2]}</span>
                        <button
                          type="button"
                          onClick={() => void handleDeleteJournalEntry(entry.id)}
                          disabled={deleteJournalEntry.isPending}
                          className="rounded-full p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50"
                          aria-label="Excluir entrada"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {entry.content}
                    </p>
                    {entry.gratitude && (
                      <div className="mt-3 rounded-xl bg-gold-soft px-3 py-2 text-xs text-ink">
                        🙏 {entry.gratitude}
                      </div>
                    )}
                    <div className="mt-3 flex gap-3 text-[11px] text-muted-foreground">
                      <span>Energia {entry.energy}/5</span>
                      <span>·</span>
                      <span>Ansiedade {entry.anxiety}/5</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Section>
        </div>

        <Section
          title="Notas de bem-estar"
          subtitle="Um espaço simples para registrar algo importante sobre como você está."
        >
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <form className="card-soft p-5 sm:p-6" onSubmit={handleWellbeingSubmit}>
              <label htmlFor="wellbeing-note" className="sr-only">
                Nova nota de bem-estar
              </label>
              <textarea
                id="wellbeing-note"
                rows={3}
                maxLength={500}
                value={wellbeingNote}
                onChange={(event) => setWellbeingNote(event.target.value)}
                placeholder="Como seu corpo e sua mente estão hoje?"
                className="w-full resize-none rounded-2xl border border-border bg-surface-soft p-4 text-sm leading-relaxed outline-none transition focus:border-ink/30 focus:bg-surface"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">{wellbeingNote.length}/500</span>
                <button
                  type="submit"
                  disabled={createWellbeingLog.isPending || !wellbeingNote.trim()}
                  className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {createWellbeingLog.isPending ? "Salvando…" : "Salvar nota"}
                </button>
              </div>
            </form>

            {wellbeingLogs.isPending ? (
              <div className="card-soft p-5 text-sm text-muted-foreground">Carregando notas…</div>
            ) : wellbeingLogs.isError ? (
              <div className="card-soft p-5 text-sm text-clay">
                Não foi possível carregar as notas.
              </div>
            ) : wellbeingLogs.data.length === 0 ? (
              <div className="card-soft flex min-h-36 items-center gap-4 p-6">
                <Heart className="h-7 w-7 shrink-0 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Ainda não há notas de bem-estar. A primeira pode ser breve e sem julgamento.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {wellbeingLogs.data.slice(0, 5).map((log) => (
                  <article key={log.id} className="card-soft p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          {formatNoteDate(log.created_at)}
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                          {log.notes}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDeleteWellbeingLog(log.id)}
                        disabled={deleteWellbeingLog.isPending}
                        className="shrink-0 rounded-full p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50"
                        aria-label="Excluir nota de bem-estar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </Section>
      </PageBody>
    </>
  );
}
