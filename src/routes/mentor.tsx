import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Send } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { PageBody, PageHeader, Section } from "@/components/ui-bits";
import { InsightCard } from "@/components/InsightCard";
import { useAuth } from "@/lib/auth-context";
import {
  useCategories,
  useCreditCards,
  useHabitLogs,
  useHabits,
  useInvoices,
  useJournalEntries,
  useProjects,
  useTransactions,
  useWellbeingLogs,
} from "@/lib/finance-hooks";
import {
  buildMentorResponse,
  createInitialMentorMessage,
  detectMentorIntent,
  generateMentorInsights,
  mentorSuggestions,
  type MentorIntent,
  type MentorMessage,
} from "@/lib/mentor-insights";

export const Route = createFileRoute("/mentor")({
  head: () => ({
    meta: [
      { title: "Mentor IA — Life OS" },
      {
        name: "description",
        content:
          "Seu mentor pessoal cruza finanças, hábitos, humor e projetos para mostrar padrões explicáveis.",
      },
    ],
  }),
  component: Mentor,
});

function Mentor() {
  const { user } = useAuth();
  const transactions = useTransactions();
  const categories = useCategories();
  const creditCards = useCreditCards();
  const invoices = useInvoices();
  const projects = useProjects();
  const habits = useHabits();
  const habitLogs = useHabitLogs();
  const journalEntries = useJournalEntries();
  const wellbeingLogs = useWellbeingLogs();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<MentorMessage[]>([]);

  const queries = [
    transactions,
    categories,
    creditCards,
    invoices,
    projects,
    habits,
    habitLogs,
    journalEntries,
    wellbeingLogs,
  ];
  const isLoading = queries.some((query) => query.isPending);
  const hasError = queries.some((query) => query.isError);
  const displayName =
    (user?.user_metadata?.full_name as string | undefined)?.trim().split(" ")[0] ??
    user?.email?.split("@")[0];

  const insights = useMemo(
    () =>
      generateMentorInsights({
        transactions: transactions.data ?? [],
        categories: categories.data ?? [],
        creditCards: creditCards.data ?? [],
        invoices: invoices.data ?? [],
        projects: projects.data ?? [],
        habits: habits.data ?? [],
        habitLogs: habitLogs.data ?? [],
        journalEntries: journalEntries.data ?? [],
        wellbeingLogs: wellbeingLogs.data ?? [],
      }),
    [
      transactions.data,
      categories.data,
      creditCards.data,
      invoices.data,
      projects.data,
      habits.data,
      habitLogs.data,
      journalEntries.data,
      wellbeingLogs.data,
    ],
  );
  const initialMessage = useMemo(
    () => createInitialMentorMessage(insights, displayName),
    [displayName, insights],
  );

  function askMentor(text: string, forcedIntent?: MentorIntent) {
    const cleanText = text.trim();
    if (!cleanText || isLoading || hasError) return;
    const intent = forcedIntent ?? detectMentorIntent(cleanText);
    const timestamp = Date.now();
    setMessages((current) => [
      ...current,
      { id: `user-${timestamp}-${current.length}`, role: "user", body: cleanText },
      {
        id: `mentor-${timestamp}-${current.length}`,
        role: "mentor",
        body: buildMentorResponse(intent, insights),
      },
    ]);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanQuestion = question.trim();
    if (!cleanQuestion) return;
    askMentor(cleanQuestion);
    setQuestion("");
  }

  return (
    <>
      <PageHeader
        eyebrow="Mentor IA"
        title="Aqui pra te ajudar a enxergar."
        subtitle="Não pra te julgar — pra mostrar conexões explicáveis a partir do que você já registrou."
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
                Análise local de finanças, cartões, diário, hábitos, bem-estar e projetos
              </div>
            </div>
          </div>

          <div className="space-y-4 p-5 sm:p-6" aria-live="polite">
            {isLoading ? (
              <div className="max-w-2xl rounded-2xl rounded-tl-md bg-secondary/80 p-4 text-sm leading-relaxed">
                Estou organizando seus registros para montar uma leitura cuidadosa…
              </div>
            ) : hasError ? (
              <div className="max-w-2xl rounded-2xl rounded-tl-md bg-clay-soft p-4 text-sm leading-relaxed text-ink">
                Não consegui acessar todos os seus registros agora. Pode valer tentar novamente em
                alguns instantes; nenhuma conclusão foi gerada com dados incompletos.
              </div>
            ) : (
              <>
                <div className="max-w-2xl rounded-2xl rounded-tl-md bg-secondary/80 p-4 text-sm leading-relaxed">
                  {initialMessage.body}
                </div>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={
                      message.role === "user"
                        ? "ml-auto max-w-2xl rounded-2xl rounded-tr-md bg-ink p-4 text-sm leading-relaxed text-background"
                        : "max-w-2xl rounded-2xl rounded-tl-md bg-secondary/80 p-4 text-sm leading-relaxed"
                    }
                  >
                    {message.body}
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2 px-5 pb-4">
            {mentorSuggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => askMentor(suggestion.label, suggestion.intent)}
                disabled={isLoading || hasError}
                className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {suggestion.label}
              </button>
            ))}
          </div>

          <form className="border-t border-border/60 p-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-full border border-border bg-surface-soft px-4 py-2">
              <label htmlFor="mentor-question" className="sr-only">
                Pergunte ao Mentor
              </label>
              <input
                id="mentor-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                disabled={isLoading || hasError}
                className="bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
                placeholder="Pergunte sobre finanças, projetos, hábitos, diário ou bem-estar…"
              />
              <button
                type="submit"
                disabled={isLoading || hasError || !question.trim()}
                className="grid h-8 w-8 place-items-center rounded-full bg-ink text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Enviar pergunta"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>
        </div>

        <Section title="Padrões que percebi nos seus registros">
          {isLoading ? (
            <div className="card-soft p-6 text-sm text-muted-foreground">
              Preparando leituras explicáveis…
            </div>
          ) : hasError ? (
            <div className="card-soft p-6 text-sm text-clay">
              Os padrões não foram exibidos porque parte dos dados não pôde ser carregada.
            </div>
          ) : insights.length === 0 ? (
            <div className="card-soft grid min-h-48 place-items-center p-8 text-center">
              <div>
                <Sparkles className="mx-auto h-8 w-8 text-muted-foreground" />
                <h2 className="mt-3 font-serif text-xl">Ainda estamos construindo contexto</h2>
                <p className="mt-2 max-w-lg text-sm text-muted-foreground">
                  Quando houver registros suficientes, o Mentor poderá mostrar padrões simples e
                  explicáveis — sem pressa e sem julgamento.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {insights.map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          )}
        </Section>
      </PageBody>
    </>
  );
}
