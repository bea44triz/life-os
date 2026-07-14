import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Circle, Flame, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { PageBody, PageHeader, Section } from "@/components/ui-bits";
import {
  useCreateHabit,
  useDeleteHabit,
  useHabitLogs,
  useHabits,
  useMarkHabitCompleted,
  useUndoHabitCompletion,
  useUpdateHabit,
} from "@/lib/finance-hooks";
import type { Habit } from "@/lib/finance-api";

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

const defaultForm = {
  name: "",
  description: "",
  frequency: "diária",
};

function isSameDay(value: string, compareDate = new Date()) {
  const date = new Date(value);
  return (
    date.getFullYear() === compareDate.getFullYear() &&
    date.getMonth() === compareDate.getMonth() &&
    date.getDate() === compareDate.getDate()
  );
}

function Habitos() {
  const { data: habits = [], isLoading } = useHabits();
  const { data: habitLogs = [] } = useHabitLogs();
  const createHabit = useCreateHabit();
  const updateHabit = useUpdateHabit();
  const deleteHabit = useDeleteHabit();
  const markCompleted = useMarkHabitCompleted();
  const undoCompletion = useUndoHabitCompletion();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState(defaultForm);

  const completedTodayByHabit = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const habit of habits) {
      const done = habitLogs.some(
        (log) => log.habit_id === habit.id && log.completed && isSameDay(log.created_at),
      );
      map.set(habit.id, done);
    }
    return map;
  }, [habits, habitLogs]);

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    createHabit.mutate(
      {
        name: form.name.trim(),
        description: form.description.trim() || null,
        frequency: form.frequency || "diária",
      },
      {
        onSuccess: () => {
          setForm(defaultForm);
          setShowCreateForm(false);
        },
      },
    );
  };

  const handleEditStart = (habit: Habit) => {
    setEditingId(habit.id);
    setEditingForm({
      name: habit.name,
      description: habit.description ?? "",
      frequency: habit.frequency ?? "diária",
    });
  };

  const handleEditSave = (habitId: string) => {
    if (!editingForm.name.trim()) return;
    updateHabit.mutate(
      {
        id: habitId,
        input: {
          name: editingForm.name.trim(),
          description: editingForm.description.trim() || null,
          frequency: editingForm.frequency || "diária",
        },
      },
      {
        onSuccess: () => setEditingId(null),
      },
    );
  };

  const handleDelete = (habitId: string) => {
    if (window.confirm("Excluir este hábito?")) {
      deleteHabit.mutate(habitId);
    }
  };

  const toggleCompletion = (habitId: string, completed: boolean) => {
    if (completed) {
      undoCompletion.mutate(habitId);
    } else {
      markCompleted.mutate(habitId);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Hábitos"
        title="O que você está construindo, em silêncio."
        subtitle="Sequências, áreas da vida e o link com cada projeto."
        action={
          <button
            onClick={() => setShowCreateForm((value) => !value)}
            className="hidden items-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-xs font-medium text-background sm:inline-flex"
          >
            <Plus className="h-3.5 w-3.5" /> {showCreateForm ? "Fechar" : "Novo hábito"}
          </button>
        }
      />
      <PageBody>
        {showCreateForm && (
          <Section title="Novo hábito">
            <form onSubmit={handleCreate} className="card-soft space-y-3 p-5">
              <input
                value={form.name}
                onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))}
                placeholder="Nome do hábito"
                className="w-full rounded-2xl border border-border/60 bg-background px-3 py-2 text-sm outline-none"
              />
              <textarea
                value={form.description}
                onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))}
                placeholder="Descrição curta"
                className="min-h-20 w-full rounded-2xl border border-border/60 bg-background px-3 py-2 text-sm outline-none"
              />
              <input
                value={form.frequency}
                onChange={(event) => setForm((value) => ({ ...value, frequency: event.target.value }))}
                placeholder="Frequência"
                className="w-full rounded-2xl border border-border/60 bg-background px-3 py-2 text-sm outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={createHabit.isPending}
                  className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-background"
                >
                  {createHabit.isPending ? "Salvando..." : "Salvar hábito"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="rounded-full bg-secondary px-4 py-2 text-xs font-medium text-foreground"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </Section>
        )}

        <Section title="Esta semana">
          {isLoading ? (
            <div className="card-soft p-6 text-center text-sm text-muted-foreground">
              Carregando hábitos...
            </div>
          ) : habits.length === 0 ? (
            <div className="card-soft p-6 text-center">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Sem hábitos ainda
              </div>
              <h2 className="mt-3 font-serif text-2xl">Nenhum hábito cadastrado</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Adicione um hábito simples para começar a registrar pequenas vitórias.
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="mt-4 rounded-full bg-ink px-4 py-2.5 text-xs font-medium text-background"
              >
                Criar primeiro hábito
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {habits.map((habit) => {
                const doneToday = completedTodayByHabit.get(habit.id) ?? false;
                return (
                  <article key={habit.id} className="card-soft p-5">
                    <header className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-medium">{habit.name}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {habit.description || "Sem descrição"}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full bg-secondary px-2.5 py-1 text-muted-foreground">
                            {habit.frequency || "diária"}
                          </span>
                          <span className="rounded-full bg-sage-soft px-2.5 py-1 text-sage">
                            {doneToday ? "Concluído hoje" : "Pendência de hoje"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 rounded-full bg-clay-soft px-2.5 py-1 text-xs text-clay">
                        <Flame className="h-3 w-3" /> 0
                      </div>
                    </header>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        onClick={() => toggleCompletion(habit.id, doneToday)}
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium ${doneToday ? "bg-sage text-background" : "bg-secondary text-foreground"}`}
                      >
                        {doneToday ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                        {doneToday ? "Desfazer hoje" : "Marcar hoje"}
                      </button>
                      <button
                        onClick={() => handleEditStart(habit)}
                        className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-2 text-xs font-medium text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </button>
                      <button
                        onClick={() => handleDelete(habit.id)}
                        className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-2 text-xs font-medium text-foreground"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Excluir
                      </button>
                    </div>

                    {editingId === habit.id && (
                      <div className="mt-4 space-y-3 rounded-2xl border border-border/60 bg-background/70 p-3">
                        <input
                          value={editingForm.name}
                          onChange={(event) => setEditingForm((value) => ({ ...value, name: event.target.value }))}
                          className="w-full rounded-2xl border border-border/60 bg-background px-3 py-2 text-sm outline-none"
                        />
                        <textarea
                          value={editingForm.description}
                          onChange={(event) => setEditingForm((value) => ({ ...value, description: event.target.value }))}
                          className="min-h-20 w-full rounded-2xl border border-border/60 bg-background px-3 py-2 text-sm outline-none"
                        />
                        <input
                          value={editingForm.frequency}
                          onChange={(event) => setEditingForm((value) => ({ ...value, frequency: event.target.value }))}
                          className="w-full rounded-2xl border border-border/60 bg-background px-3 py-2 text-sm outline-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditSave(habit.id)}
                            disabled={updateHabit.isPending}
                            className="rounded-full bg-ink px-3 py-2 text-xs font-medium text-background"
                          >
                            {updateHabit.isPending ? "Salvando..." : "Salvar"}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded-full bg-secondary px-3 py-2 text-xs font-medium text-foreground"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </Section>
      </PageBody>
    </>
  );
}
