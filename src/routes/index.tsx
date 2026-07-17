import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowUpRight, TrendingUp, TrendingDown, CreditCard } from "lucide-react";
import { PageBody, PageHeader, Section, StatCard, brl } from "@/components/ui-bits";
import { useDashboardData } from "@/lib/use-dashboard-data";
import { useAuth } from "@/lib/auth-context";
import {
  useCategories,
  useCreditCards,
  useHabits,
  useHabitLogs,
  useInvoices,
  useJournalEntries,
  useProjects,
  useTransactions,
} from "@/lib/finance-hooks";
import { bestPurchaseDay, computeInvoicePeriod } from "@/lib/credit-cards";
import { computeUsedCreditLimit, deriveInvoiceBalance } from "@/lib/finance-domain";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hoje — Life OS" },
      {
        name: "description",
        content:
          "Seu dia em uma página: finanças, hábitos, humor e o insight do seu mentor pessoal.",
      },
    ],
  }),
  component: Dashboard,
});

function isSameDay(value: string, compareDate = new Date()) {
  const date = new Date(value);
  return (
    date.getFullYear() === compareDate.getFullYear() &&
    date.getMonth() === compareDate.getMonth() &&
    date.getDate() === compareDate.getDate()
  );
}

function Dashboard() {
  const { user: authUser } = useAuth();
  const live = useDashboardData();
  const { data: liveCards = [] } = useCreditCards();
  const { data: liveInvoices = [] } = useInvoices();
  const { data: liveProjects = [] } = useProjects();
  const { data: liveTransactions = [] } = useTransactions();
  const { data: liveCategories = [] } = useCategories();
  const { data: liveJournalEntries = [] } = useJournalEntries();
  const { data: liveHabits = [] } = useHabits();
  const { data: liveHabitLogs = [] } = useHabitLogs();
  const displayName =
    (authUser?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ??
    authUser?.email?.split("@")[0] ??
    "você";
  const hasAnyData =
    live.accountsCount > 0 ||
    live.cardsCount > 0 ||
    live.projectsCount > 0 ||
    liveTransactions.length > 0 ||
    liveJournalEntries.length > 0 ||
    liveHabits.length > 0;
  const hasFinancialData =
    live.accountsCount > 0 || live.cardsCount > 0 || liveTransactions.length > 0;
  const monthLabel = new Date().toLocaleDateString("pt-BR", { month: "long" });
  const currentMonthSubtitle = `${monthLabel.charAt(0).toUpperCase()}${monthLabel.slice(1)} · até hoje`;
  const cardPreview = useMemo(() => {
    const card = liveCards[0];
    if (!card) {
      return {
        name: null,
        currentAmount: 0,
        nextAmount: 0,
        usedPercent: 0,
        closingLabel: null,
        dueLabel: null,
        bestDay: null,
        available: false,
      };
    }
    const today = new Date().toISOString().slice(0, 10);
    const currentPeriod = computeInvoicePeriod(today, card);
    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + 1);
    const nextPeriod = computeInvoicePeriod(nextDate.toISOString().slice(0, 10), card);
    const currentInvoice = liveInvoices.find(
      (invoice) =>
        invoice.credit_card_id === card.id &&
        invoice.reference_month.slice(0, 10) === currentPeriod.referenceMonth,
    );
    const nextInvoice = liveInvoices.find(
      (invoice) =>
        invoice.credit_card_id === card.id &&
        invoice.reference_month.slice(0, 10) === nextPeriod.referenceMonth,
    );
    const currentBalance = deriveInvoiceBalance({
      totalAmount: currentInvoice?.total_amount ?? 0,
      paidAmount: currentInvoice?.paid_amount ?? 0,
    });
    const nextBalance = deriveInvoiceBalance({
      totalAmount: nextInvoice?.total_amount ?? 0,
      paidAmount: nextInvoice?.paid_amount ?? 0,
    });
    const used = computeUsedCreditLimit(
      liveInvoices
        .filter((invoice) => invoice.credit_card_id === card.id)
        .map((invoice) => ({
          totalAmount: invoice.total_amount,
          paidAmount: invoice.paid_amount,
        })),
    );
    const limit = card.credit_limit ?? 0;
    return {
      name: card.name,
      currentAmount: currentBalance.pendingAmount,
      nextAmount: nextBalance.pendingAmount,
      usedPercent: limit > 0 ? Math.min((used / limit) * 100, 100) : 0,
      closingLabel: new Date(`${currentPeriod.closingDate}T12:00:00`).toLocaleDateString(
        "pt-BR",
      ),
      dueLabel: new Date(`${currentPeriod.dueDate}T12:00:00`).toLocaleDateString("pt-BR"),
      bestDay: bestPurchaseDay(card.closing_day ?? 1),
      available: true,
    };
  }, [liveCards, liveInvoices]);

  const recentTransactions = liveTransactions.slice(0, 5).map((transaction) => ({
    id: transaction.id,
    description: transaction.description,
    amount: Number(transaction.amount),
    type: transaction.type,
    date: transaction.transaction_date,
    category:
      liveCategories.find((category) => category.id === transaction.category_id)?.name ??
      "Sem categoria",
  }));

  const completedTodayByHabit = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const habit of liveHabits) {
      const done = liveHabitLogs.some(
        (log) => log.habit_id === habit.id && log.completed && isSameDay(log.created_at),
      );
      map.set(habit.id, done);
    }
    return map;
  }, [liveHabits, liveHabitLogs]);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentJournalEntries = liveJournalEntries.filter(
    (entry) => new Date(entry.created_at) >= sevenDaysAgo,
  );
  const moodAverage =
    recentJournalEntries.length > 0
      ? (
          recentJournalEntries.reduce((sum, entry) => sum + Number(entry.mood ?? 0), 0) /
          recentJournalEntries.length
        ).toFixed(1)
      : null;

  return (
    <>
      <PageHeader
        eyebrow={`${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}`}
        title={`Bom te ver, ${displayName}.`}
        subtitle="Aqui está como sua vida está se conectando hoje — sem julgamento, só clareza."
      />

      <PageBody>
        {!live.loading && !hasAnyData && (
          <div className="card-soft bg-sage-soft p-6 ring-1 ring-sage/20">
            <div className="text-[11px] uppercase tracking-[0.18em] text-ink-soft">
              Vamos começar
            </div>
            <h3 className="mt-2 font-serif text-2xl text-ink">
              Seu Life OS está pronto para receber sua vida.
            </h3>
            <p className="mt-2 text-sm text-ink-soft">
              Aqui aparecerão as primeiras tendências do seu próprio fluxo quando você começar a registrar.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/financeiro" className="rounded-full bg-ink px-4 py-2 text-xs text-background hover:opacity-90">
                Adicionar primeira despesa
              </Link>
              <Link to="/financeiro" className="rounded-full border border-border bg-surface px-4 py-2 text-xs hover:bg-secondary">
                Cadastrar meu primeiro cartão
              </Link>
              <Link to="/projetos" className="rounded-full border border-border bg-surface px-4 py-2 text-xs hover:bg-secondary">
                Criar projeto de vida
              </Link>
              <Link to="/diario" className="rounded-full border border-border bg-surface px-4 py-2 text-xs hover:bg-secondary">
                Registrar meu dia
              </Link>
            </div>
          </div>
        )}

        {/* Money row */}
        <Section title="Seu dinheiro este mês" subtitle={currentMonthSubtitle}>
          {hasFinancialData ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label="Saldo atual"
                value={brl(live.balance)}
                hint={live.accountsCount > 0 ? `${live.accountsCount} conta(s)` : "sem contas ainda"}
              />
              <StatCard
                label="Receitas"
                value={brl(live.income)}
                hint="este mês"
                tone="sage"
              />
              <StatCard
                label="Despesas pagas"
                value={brl(live.expenses)}
                hint="este mês"
              />
              <StatCard
                label="Economia do mês"
                value={brl(Math.max(0, live.income - live.expenses))}
                hint="receitas − despesas"
                tone="gold"
              />
            </div>
          ) : (
            <div className="card-soft border border-dashed border-border/70 bg-surface-soft p-6 text-center">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Sem dados financeiros ainda
              </div>
              <h3 className="mt-2 font-serif text-xl">
                Seu resumo aparecerá aqui quando houver registros próprios.
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Comece com uma conta, uma receita ou uma despesa para ativar esse painel.
              </p>
            </div>
          )}
        </Section>


        {/* Credit cards preview + projects */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="card-soft lg:col-span-2 p-6">
            {cardPreview.available ? (
              <>
                <header className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      Cartão em aberto
                    </div>
                    <h3 className="mt-2 font-serif text-2xl">
                      {cardPreview.name} · fecha {cardPreview.closingLabel}
                    </h3>
                  </div>
                  <Link
                    to="/cartoes"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Ver financeiro <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </header>

                <div className="mt-5 grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Fatura atual</div>
                    <div className="mt-1 font-serif text-2xl">{brl(cardPreview.currentAmount)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Próxima fatura</div>
                    <div className="mt-1 font-serif text-2xl">{brl(cardPreview.nextAmount)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Limite usado</div>
                    <div className="mt-1 font-serif text-2xl">
                      {Math.round(cardPreview.usedPercent)}%
                    </div>
                  </div>
                </div>

                <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-ink"
                    style={{ width: `${cardPreview.usedPercent}%` }}
                  />
                </div>

                <p className="mt-4 text-sm text-muted-foreground">
                  Vence {cardPreview.dueLabel}. Melhor dia de compra: {" "}
                  <strong className="text-foreground">
                    {String(cardPreview.bestDay).padStart(2, "0")}
                  </strong>
                  .
                </p>
              </>
            ) : (
              <div className="flex h-full flex-col justify-center">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Cartão em aberto
                </div>
                <h3 className="mt-2 font-serif text-2xl">Ainda não há um cartão cadastrado</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  O resumo da fatura aparece aqui quando houver um cartão real vinculado ao seu fluxo.
                </p>
              </div>
            )}
          </div>

          <div className="card-soft p-6">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Humor da semana
            </div>
            {moodAverage ? (
              <>
                <div className="mt-3 flex items-end gap-2">
                  <span className="font-serif text-3xl">{moodAverage}</span>
                  <span className="text-xs text-muted-foreground">/5</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Média dos registros recentes do diário.
                </p>
              </>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-border/70 bg-surface-soft p-4 text-sm text-muted-foreground">
                Registre seu humor no diário para ver uma média aqui.
              </div>
            )}
            <Link
              to="/diario"
              className="mt-5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Abrir diário <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Projects */}
        <Section
          title="Seus projetos de vida"
          subtitle="O que dá sentido ao dinheiro e aos hábitos."
          action={
            <Link
              to="/projetos"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Ver todos →
            </Link>
          }
        >
          {liveProjects.length ? (
            <div className="grid gap-4 md:grid-cols-3">
              {liveProjects.map((p) => {
                return (
                  <Link
                    key={p.id}
                    to="/projetos"
                    className="card-soft block p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-2xl">📌</span>
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {p.status || "Sem status"}
                      </span>
                    </div>
                    <h3 className="mt-3 font-serif text-lg leading-tight">{p.name}</h3>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {p.type ? `Tipo: ${p.type}` : "Projeto registrado"}
                    </p>
                    <p className="mt-4 text-xs text-muted-foreground">
                      Progresso será adicionado depois.
                    </p>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="card-soft rounded-3xl border border-border/70 bg-surface p-6 text-center">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Sem projetos ativos
              </div>
              <h3 className="mt-3 font-serif text-2xl">Nenhum projeto cadastrado</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Seus projetos aparecerão aqui quando houver cadastros reais.
              </p>
            </div>
          )}
        </Section>

        {/* Habits + recent tx */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card-soft p-6">
            <header className="flex items-center justify-between">
              <h3 className="font-serif text-xl">Hábitos da semana</h3>
              <Link
                to="/habitos"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Ver todos →
              </Link>
            </header>
            {liveHabits.length ? (
              <ul className="mt-4 divide-y divide-border/60">
                {liveHabits.slice(0, 4).map((habit) => {
                  const doneToday = completedTodayByHabit.get(habit.id) ?? false;
                  return (
                    <li key={habit.id} className="flex items-center gap-3 py-3">
                      <span className="text-xl">🧭</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{habit.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {doneToday ? "Concluído hoje" : "Ainda não registrado hoje"} · {habit.frequency ?? "frequência"}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-border/70 bg-surface-soft p-4 text-sm text-muted-foreground">
                Ainda não há hábitos registrados para mostrar aqui.
              </div>
            )}
          </div>

          <div className="card-soft p-6">
            <header className="flex items-center justify-between">
              <h3 className="font-serif text-xl">Movimentações recentes</h3>
              <Link
                to="/financeiro"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Ver tudo →
              </Link>
            </header>
            {recentTransactions.length ? (
              <ul className="mt-4 divide-y divide-border/60">
                {recentTransactions.map((t) => {
                  const isIncome = t.type === "income";
                  return (
                    <li key={t.id} className="flex items-center gap-3 py-3">
                      <span
                        className={
                          isIncome
                            ? "grid h-8 w-8 place-items-center rounded-full bg-sage-soft text-sage"
                            : t.type === "credit_card_purchase"
                              ? "grid h-8 w-8 place-items-center rounded-full bg-secondary text-foreground"
                              : "grid h-8 w-8 place-items-center rounded-full bg-secondary text-foreground"
                        }
                      >
                        {isIncome ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : t.type === "credit_card_purchase" ? (
                          <CreditCard className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{t.description}</div>
                        <div className="text-xs text-muted-foreground">
                          {t.category} · {" "}
                          {new Date(t.date).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </div>
                      </div>
                      <div
                        className={
                          isIncome
                            ? "text-sm font-medium text-sage"
                            : "text-sm font-medium text-foreground"
                        }
                      >
                        {brl(t.amount)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-border/70 bg-surface-soft p-4 text-sm text-muted-foreground">
                Ainda não há movimentações para mostrar aqui.
              </div>
            )}
          </div>
        </div>

      </PageBody>
    </>
  );
}
