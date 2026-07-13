import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Plus, TrendingUp, TrendingDown, CreditCard, Smile } from "lucide-react";
import { PageBody, PageHeader, Section, StatCard, brl } from "@/components/ui-bits";
import { InsightCard } from "@/components/InsightCard";
import {
  account,
  creditCards,
  habits,
  insights,
  monthSummary,
  projects,
  transactions,
  user,
  weekMood,
} from "@/lib/mockData";
import { useDashboardData } from "@/lib/use-dashboard-data";
import { useAuth } from "@/lib/auth-context";

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

const dayLabels = ["S", "T", "Q", "Q", "S", "S", "D"];

function Dashboard() {
  const featured = insights[0];
  const nubank = creditCards[0];
  const nubankFatura = transactions
    .filter((t) => t.cardId === nubank.id)
    .reduce((a, b) => a + Math.abs(b.amount), 0);
  const { user: authUser } = useAuth();
  const live = useDashboardData();
  const displayName =
    (authUser?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ??
    authUser?.email?.split("@")[0] ??
    user.name;
  const useLive = live.hasAnyData;

  return (
    <>
      <PageHeader
        eyebrow={`${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}`}
        title={`${user.greeting}, ${displayName}.`}
        subtitle="Aqui está como sua vida está se conectando hoje — sem julgamento, só clareza."
        action={
          <button className="hidden items-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-xs font-medium text-background transition hover:opacity-90 sm:inline-flex">
            <Plus className="h-3.5 w-3.5" /> Registrar
          </button>
        }
      />

      <PageBody>
        {/* Featured insight */}
        <InsightCard insight={featured} featured />

        {!live.loading && !useLive && (
          <div className="card-soft bg-sage-soft p-6 ring-1 ring-sage/20">
            <div className="text-[11px] uppercase tracking-[0.18em] text-ink-soft">
              Vamos começar
            </div>
            <h3 className="mt-2 font-serif text-2xl text-ink">
              Seu Life OS está pronto para receber sua vida.
            </h3>
            <p className="mt-2 text-sm text-ink-soft">
              Enquanto você não tiver registros próprios, mostramos exemplos para te inspirar.
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
        <Section title="Seu dinheiro este mês" subtitle="Junho · até hoje">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Saldo atual"
              value={brl(useLive ? live.balance : account.balance)}
              hint={useLive ? `${live.accountsCount} conta(s)` : account.bank}
            />
            <StatCard
              label="Receitas"
              value={brl(useLive ? live.income : monthSummary.income)}
              hint={useLive ? "este mês" : "1 entrada"}
              tone="sage"
            />
            <StatCard
              label="Despesas pagas"
              value={brl(useLive ? live.expenses : monthSummary.expenses)}
              hint={useLive ? "este mês" : "conta corrente"}
            />
            <StatCard
              label="Economia do mês"
              value={brl(useLive ? Math.max(0, live.income - live.expenses) : monthSummary.saved)}
              hint={useLive ? "receitas − despesas" : "aporte Japão"}
              tone="gold"
            />
          </div>
        </Section>


        {/* Credit cards preview + projects */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="card-soft lg:col-span-2 p-6">
            <header className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Cartão em aberto
                </div>
                <h3 className="mt-2 font-serif text-2xl">Nubank · fecha em 4 dias</h3>
              </div>
              <Link
                to="/financeiro"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Ver financeiro <ArrowUpRight className="h-3 w-3" />
              </Link>
            </header>

            <div className="mt-5 grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-muted-foreground">Fatura atual</div>
                <div className="mt-1 font-serif text-2xl">{brl(nubankFatura)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Próxima fatura</div>
                <div className="mt-1 font-serif text-2xl">{brl(monthSummary.nextBillTotal)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Limite usado</div>
                <div className="mt-1 font-serif text-2xl">
                  {Math.round((nubank.used / nubank.limit) * 100)}%
                </div>
              </div>
            </div>

            <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-ink"
                style={{ width: `${(nubank.used / nubank.limit) * 100}%` }}
              />
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              Vence dia 12. Melhor dia de compra: <strong className="text-foreground">06</strong>.
            </p>
          </div>

          <div className="card-soft p-6">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Humor da semana
            </div>
            <div className="mt-3 flex items-end gap-2">
              <Smile className="h-6 w-6 text-sky" />
              <span className="font-serif text-3xl">
                {(weekMood.reduce((a, b) => a + b, 0) / weekMood.length).toFixed(1)}
              </span>
              <span className="text-xs text-muted-foreground">/5</span>
            </div>
            <div className="mt-5 grid grid-cols-7 gap-1.5">
              {weekMood.map((m, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-md bg-sky-soft"
                    style={{ height: `${m * 10 + 6}px` }}
                  />
                  <span className="text-[10px] text-muted-foreground">{dayLabels[i]}</span>
                </div>
              ))}
            </div>
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
          <div className="grid gap-4 md:grid-cols-3">
            {projects.map((p) => {
              const pct = p.goalAmount
                ? Math.round(((p.savedAmount ?? 0) / p.goalAmount) * 100)
                : (p.behavioralProgress ?? 0);
              return (
                <Link
                  key={p.id}
                  to="/projetos"
                  className="card-soft block p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-2xl">{p.emoji}</span>
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {p.deadline}
                    </span>
                  </div>
                  <h3 className="mt-3 font-serif text-lg leading-tight">{p.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {p.description}
                  </p>
                  <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sage to-sky"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {p.goalAmount
                        ? `${brl(p.savedAmount ?? 0)} / ${brl(p.goalAmount)}`
                        : p.behavioralGoal}
                    </span>
                    <span className="font-medium">{pct}%</span>
                  </div>
                </Link>
              );
            })}
          </div>
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
            <ul className="mt-4 divide-y divide-border/60">
              {habits.slice(0, 4).map((h) => (
                <li key={h.id} className="flex items-center gap-3 py-3">
                  <span className="text-xl">{h.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{h.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {h.streak} dias seguidos · {h.area}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div
                        key={i}
                        className={
                          i < h.weekDone
                            ? "h-2.5 w-2.5 rounded-full bg-sage"
                            : "h-2.5 w-2.5 rounded-full bg-secondary"
                        }
                      />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
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
            <ul className="mt-4 divide-y divide-border/60">
              {transactions.slice(0, 5).map((t) => {
                const isIncome = t.amount > 0;
                return (
                  <li key={t.id} className="flex items-center gap-3 py-3">
                    <span
                      className={
                        isIncome
                          ? "grid h-8 w-8 place-items-center rounded-full bg-sage-soft text-sage"
                          : t.type === "card"
                            ? "grid h-8 w-8 place-items-center rounded-full bg-secondary text-foreground"
                            : "grid h-8 w-8 place-items-center rounded-full bg-secondary text-foreground"
                      }
                    >
                      {isIncome ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : t.type === "card" ? (
                        <CreditCard className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{t.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.category} ·{" "}
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
          </div>
        </div>

        {/* Other insights */}
        <Section title="Outros sinais que percebi">
          <div className="grid gap-4 md:grid-cols-2">
            {insights.slice(1).map((i) => (
              <InsightCard key={i.id} insight={i} />
            ))}
          </div>
        </Section>
      </PageBody>
    </>
  );
}
