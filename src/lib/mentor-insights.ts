import type {
  Category,
  CreditCard,
  Habit,
  HabitLog,
  JournalEntry,
  Project,
  Transaction,
  WellbeingLog,
} from "./finance-api";
import type { CreditCardInvoice } from "./credit-cards";

export type MentorInsightType =
  "finance" | "category" | "mood" | "projects" | "habits" | "wellbeing" | "suggestion";

export type MentorInsightPresentation = {
  id: string;
  kind: "pattern" | "explanation" | "suggestion" | "question";
  title: string;
  body: string;
  related: string[];
  tone: "sage" | "sky" | "gold" | "clay";
};

export type MentorInsight = MentorInsightPresentation & {
  type: MentorInsightType;
  priority: number;
};

export type MentorIntent = "finance" | "mood" | "habits" | "projects" | "wellbeing" | "unknown";

export type MentorMessage = {
  id: string;
  role: "mentor" | "user";
  body: string;
};

export type MentorSuggestion = {
  id: string;
  label: string;
  intent: Exclude<MentorIntent, "unknown">;
};

export type MentorInsightInput = {
  transactions: readonly Transaction[];
  categories: readonly Category[];
  creditCards: readonly CreditCard[];
  invoices: readonly CreditCardInvoice[];
  projects: readonly Project[];
  habits: readonly Habit[];
  habitLogs: readonly HabitLog[];
  journalEntries: readonly JournalEntry[];
  wellbeingLogs: readonly WellbeingLog[];
  now?: Date;
};

export type MonthlyFinancialSummary = {
  income: number;
  expenses: number;
  incomeCount: number;
  expenseCount: number;
  monthTransactionCount: number;
};

export const mentorSuggestions: MentorSuggestion[] = [
  { id: "finance", label: "Como estão minhas finanças?", intent: "finance" },
  {
    id: "mood",
    label: "Percebi algum padrão entre humor e gastos?",
    intent: "mood",
  },
  { id: "habits", label: "Como estão meus hábitos?", intent: "habits" },
  { id: "projects", label: "Quais projetos estão ativos?", intent: "projects" },
];

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function localDateKey(value: string) {
  if (!value.includes("T")) return value.slice(0, 10);
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isConfirmed(transaction: Transaction) {
  return transaction.review_status !== "pending" && transaction.review_status !== "rejected";
}

function isInvoicePayment(transaction: Transaction) {
  return (
    transaction.metadata?.invoice_payment === true ||
    transaction.metadata?.classification_kind === "credit_card_payment"
  );
}

function isObservedExpense(transaction: Transaction) {
  return (
    isConfirmed(transaction) &&
    !isInvoicePayment(transaction) &&
    (transaction.type === "expense" || transaction.type === "credit_card_purchase")
  );
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function plural(count: number, singular: string, pluralForm: string) {
  return count === 1 ? singular : pluralForm;
}

export function summarizeMonthlyFinances(
  transactions: readonly Transaction[],
  now = new Date(),
): MonthlyFinancialSummary {
  const currentMonth = monthKey(now);
  const monthTransactions = transactions.filter(
    (transaction) =>
      transaction.transaction_date.slice(0, 7) === currentMonth &&
      isConfirmed(transaction) &&
      !isInvoicePayment(transaction),
  );
  const incomes = monthTransactions.filter((transaction) => transaction.type === "income");
  const expenses = monthTransactions.filter((transaction) => transaction.type === "expense");

  return {
    income: incomes.reduce((total, transaction) => total + Math.abs(Number(transaction.amount)), 0),
    expenses: expenses.reduce(
      (total, transaction) => total + Math.abs(Number(transaction.amount)),
      0,
    ),
    incomeCount: incomes.length,
    expenseCount: expenses.length,
    monthTransactionCount: monthTransactions.length,
  };
}

function buildFinancialInsight(input: MentorInsightInput): MentorInsight | null {
  const now = input.now ?? new Date();
  const summary = summarizeMonthlyFinances(input.transactions, now);
  if (summary.incomeCount === 0 && summary.expenseCount === 0) return null;

  const period = `de 1º a ${now.getDate()} de ${now.toLocaleDateString("pt-BR", {
    month: "long",
  })}`;
  const balance = summary.income - summary.expenses;
  const balanceText =
    balance >= 0
      ? `A diferença observada é positiva em ${currency.format(balance)}.`
      : `As despesas observadas estão ${currency.format(Math.abs(balance))} acima das receitas.`;

  return {
    id: "mentor-finance-month",
    type: "finance",
    kind: "explanation",
    title: "Seu mês financeiro em perspectiva",
    body: `${period}, há ${currency.format(summary.income)} em receitas e ${currency.format(summary.expenses)} em despesas confirmadas. ${balanceText} Compras no cartão e pagamentos de fatura ficam separados deste cálculo para evitar dupla contagem.`,
    related: [],
    tone: balance >= 0 ? "sage" : "gold",
    priority: 90,
  };
}

function buildInvoiceInsight(input: MentorInsightInput): MentorInsight | null {
  const unpaid = input.invoices.filter((invoice) => invoice.status !== "paid");
  const activeCardIds = new Set(
    input.creditCards.filter((card) => card.is_active !== false).map((card) => card.id),
  );
  const tracked = unpaid.filter((invoice) => activeCardIds.has(invoice.credit_card_id));
  const considered = tracked.length > 0 ? tracked : unpaid;
  const pendingAmount = considered.reduce(
    (total, invoice) =>
      total + Math.max(Number(invoice.total_amount) - Number(invoice.paid_amount), 0),
    0,
  );
  if (considered.length === 0 || pendingAmount === 0) return null;

  return {
    id: "mentor-open-invoices",
    type: "finance",
    kind: "explanation",
    title: "Faturas acompanhadas separadamente",
    body: `Há ${considered.length} ${plural(considered.length, "fatura não marcada como paga", "faturas não marcadas como pagas")}, com saldo combinado de ${currency.format(pendingAmount)}. Esse valor está separado do resumo mensal para manter a leitura mais clara.`,
    related: considered.map((invoice) => invoice.credit_card_id),
    tone: "sky",
    priority: 75,
  };
}

function buildCategoryInsight(input: MentorInsightInput): MentorInsight | null {
  const now = input.now ?? new Date();
  const expenses = input.transactions.filter(
    (transaction) =>
      transaction.transaction_date.slice(0, 7) === monthKey(now) && isObservedExpense(transaction),
  );
  if (expenses.length < 3) return null;

  const total = expenses.reduce(
    (sum, transaction) => sum + Math.abs(Number(transaction.amount)),
    0,
  );
  if (total <= 0) return null;

  const totals = new Map<string, { amount: number; count: number }>();
  for (const transaction of expenses) {
    if (!transaction.category_id) continue;
    const current = totals.get(transaction.category_id) ?? { amount: 0, count: 0 };
    current.amount += Math.abs(Number(transaction.amount));
    current.count += 1;
    totals.set(transaction.category_id, current);
  }

  const top = [...totals.entries()].sort((a, b) => b[1].amount - a[1].amount)[0];
  if (!top || top[1].count < 2) return null;
  const share = Math.round((top[1].amount / total) * 100);
  if (share < 35) return null;

  const categoryName = input.categories.find((category) => category.id === top[0])?.name;
  if (!categoryName) return null;

  return {
    id: `mentor-category-${top[0]}`,
    type: "category",
    kind: "pattern",
    title: `${categoryName} ganhou mais espaço neste mês`,
    body: `Essa categoria representou ${share}% dos gastos observados em ${expenses.length} compras ou despesas confirmadas. Não significa que esteja errado; pode valer observar se essa distribuição combina com o que importa para você.`,
    related: [top[0]],
    tone: "gold",
    priority: 80,
  };
}

type DailyJournal = { mood: number; anxiety: number; count: number };

function buildMoodInsight(input: MentorInsightInput): MentorInsight | null {
  const now = input.now ?? new Date();
  const cutoff = startOfLocalDay(now);
  cutoff.setDate(cutoff.getDate() - 29);

  const spendingByDay = new Map<string, number>();
  for (const transaction of input.transactions) {
    if (!isObservedExpense(transaction)) continue;
    const key = transaction.transaction_date.slice(0, 10);
    const date = new Date(`${key}T12:00:00`);
    if (date < cutoff || date > now) continue;
    spendingByDay.set(key, (spendingByDay.get(key) ?? 0) + Math.abs(Number(transaction.amount)));
  }

  const journalByDay = new Map<string, DailyJournal>();
  for (const entry of input.journalEntries) {
    const key = localDateKey(entry.created_at);
    const date = new Date(`${key}T12:00:00`);
    if (date < cutoff || date > now || !spendingByDay.has(key)) continue;
    const current = journalByDay.get(key) ?? { mood: 0, anxiety: 0, count: 0 };
    current.mood += Number(entry.mood);
    current.anxiety += Number(entry.anxiety);
    current.count += 1;
    journalByDay.set(key, current);
  }

  const overlap = [...journalByDay.entries()].map(([key, journal]) => ({
    key,
    mood: journal.mood / journal.count,
    anxiety: journal.anxiety / journal.count,
    spending: spendingByDay.get(key) ?? 0,
  }));
  if (overlap.length < 4) return null;

  const comparisons = [
    {
      label: "ansiedade mais alta",
      high: overlap.filter((day) => day.anxiety >= 4),
      other: overlap.filter((day) => day.anxiety < 4),
    },
    {
      label: "humor mais baixo",
      high: overlap.filter((day) => day.mood <= 2),
      other: overlap.filter((day) => day.mood > 2),
    },
  ];

  for (const comparison of comparisons) {
    if (comparison.high.length < 2 || comparison.other.length < 2) continue;
    const average = (days: typeof overlap) =>
      days.reduce((sum, day) => sum + day.spending, 0) / days.length;
    const observedAverage = average(comparison.high);
    const otherAverage = average(comparison.other);
    const lower = Math.min(observedAverage, otherAverage);
    if (lower <= 0) continue;
    const difference = Math.round((Math.abs(observedAverage - otherAverage) / lower) * 100);
    if (difference <= 20) continue;

    const direction = observedAverage > otherAverage ? "maior" : "menor";
    return {
      id: `mentor-mood-${comparison.label.replaceAll(" ", "-")}`,
      type: "mood",
      kind: "pattern",
      title: "Um padrão que pode valer observar",
      body: `Em ${overlap.length} dias com registros comparáveis, a média de gastos nos dias de ${comparison.label} foi ${currency.format(observedAverage)}, ${difference}% ${direction} que nos outros dias (${currency.format(otherAverage)}). Isso apareceu junto nos seus registros e não indica causa; talvez faça sentido apenas observar se o padrão continua.`,
      related: comparison.high.map((day) => day.key),
      tone: "clay",
      priority: 100,
    };
  }

  return null;
}

function buildProjectsInsight(input: MentorInsightInput): MentorInsight | null {
  if (input.projects.length === 0) return null;
  const activeLabels = new Set(["active", "ativo", "in_progress", "em andamento", "ongoing"]);
  const active = input.projects.filter((project) =>
    activeLabels.has((project.status ?? "").trim().toLocaleLowerCase("pt-BR")),
  );
  const statusCounts = new Map<string, number>();
  for (const project of input.projects) {
    const status = project.status?.trim() || "sem status";
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
  }
  const statusText = [...statusCounts.entries()]
    .map(([status, count]) => `${count} ${status}`)
    .join(", ");
  const activeText =
    active.length > 0
      ? `Os que aparecem ativos são: ${active.map((project) => project.name).join(", ")}.`
      : "Nenhum está marcado explicitamente como ativo neste momento.";

  return {
    id: "mentor-projects-status",
    type: "projects",
    kind: "explanation",
    title: "Seus projetos por status",
    body: `Você tem ${input.projects.length} ${plural(input.projects.length, "projeto registrado", "projetos registrados")} (${statusText}). ${activeText} Esta leitura usa somente o status cadastrado, sem estimar prazo ou avanço.`,
    related: input.projects.map((project) => project.id),
    tone: "sky",
    priority: 60,
  };
}

function buildHabitsInsight(input: MentorInsightInput): MentorInsight | null {
  if (input.habits.length === 0 && input.habitLogs.length === 0) return null;
  const now = input.now ?? new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 7);
  const recentCompletions = input.habitLogs.filter((log) => {
    const date = new Date(log.created_at);
    return log.completed === true && date >= cutoff && date <= now;
  });
  const distinctHabitIds = new Set(recentCompletions.map((log) => log.habit_id));

  return {
    id: "mentor-habits-week",
    type: "habits",
    kind: "explanation",
    title: "Pequenos passos dos últimos 7 dias",
    body: `Você registrou ${recentCompletions.length} ${plural(recentCompletions.length, "conclusão", "conclusões")} em ${distinctHabitIds.size} ${plural(distinctHabitIds.size, "hábito diferente", "hábitos diferentes")}. É uma fotografia dos registros recentes, sem transformar isso em sequência ou cobrança.`,
    related: [...distinctHabitIds],
    tone: "sage",
    priority: 70,
  };
}

function buildWellbeingInsight(input: MentorInsightInput): MentorInsight | null {
  if (input.wellbeingLogs.length === 0) return null;
  const latest = [...input.wellbeingLogs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0];
  const latestLabel = new Date(latest.created_at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
  });

  return {
    id: "mentor-wellbeing-notes",
    type: "wellbeing",
    kind: "explanation",
    title: "Seu espaço de bem-estar está ganhando contexto",
    body: `Há ${input.wellbeingLogs.length} ${plural(input.wellbeingLogs.length, "nota registrada", "notas registradas")}, e a mais recente é de ${latestLabel}. Eu considero apenas quantidade e recência, sem interpretar o texto como diagnóstico ou criar pontuação.`,
    related: [latest.id],
    tone: "sage",
    priority: 50,
  };
}

export function buildGentleSuggestion(insights: readonly MentorInsight[]): MentorInsight | null {
  const strongest = [...insights].sort((a, b) => b.priority - a.priority)[0];
  if (!strongest) return null;

  const topic =
    strongest.type === "mood"
      ? "esse padrão entre registros do diário e gastos"
      : strongest.type === "category"
        ? "a distribuição dos gastos"
        : strongest.type === "finance"
          ? "o retrato financeiro deste mês"
          : strongest.type === "habits"
            ? "os pequenos registros dos seus hábitos"
            : strongest.type === "projects"
              ? "quais projetos merecem mais atenção agora"
              : "como seus registros de bem-estar estão se formando";

  return {
    id: "mentor-gentle-suggestion",
    type: "suggestion",
    kind: "suggestion",
    title: "Uma reflexão possível",
    body: `Talvez faça sentido acompanhar ${topic} por mais alguns dias, sem precisar mudar tudo de uma vez. Isso faz sentido para você?`,
    related: [strongest.id],
    tone: "sage",
    priority: 10,
  };
}

export function generateMentorInsights(input: MentorInsightInput): MentorInsight[] {
  const insights = [
    buildMoodInsight(input),
    buildFinancialInsight(input),
    buildCategoryInsight(input),
    buildInvoiceInsight(input),
    buildHabitsInsight(input),
    buildProjectsInsight(input),
    buildWellbeingInsight(input),
  ].filter((insight): insight is MentorInsight => insight !== null);
  const suggestion = buildGentleSuggestion(insights);
  return suggestion ? [...insights, suggestion] : insights;
}

function normalizeQuestion(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export function detectMentorIntent(question: string): MentorIntent {
  const normalized = normalizeQuestion(question);
  if (/bem-estar|bem estar|corpo|mente|nota/.test(normalized)) return "wellbeing";
  if (/humor|ansiedade|diario|sentimento/.test(normalized)) return "mood";
  if (/habito|rotina/.test(normalized)) return "habits";
  if (/projeto|meta/.test(normalized)) return "projects";
  if (/financa|dinheiro|gasto|despesa|receita|fatura|cartao/.test(normalized)) return "finance";
  return "unknown";
}

const intentTypes: Record<Exclude<MentorIntent, "unknown">, MentorInsightType[]> = {
  finance: ["finance", "category"],
  mood: ["mood"],
  habits: ["habits"],
  projects: ["projects"],
  wellbeing: ["wellbeing"],
};

export function buildMentorResponse(
  intent: MentorIntent,
  insights: readonly MentorInsight[],
): string {
  if (intent === "unknown") {
    return "Nesta primeira versão, eu consigo analisar finanças, projetos, hábitos, diário e notas de bem-estar com base nos dados já registrados.";
  }
  const matches = insights.filter((insight) => intentTypes[intent].includes(insight.type));
  if (matches.length === 0) {
    const topic = {
      finance: "finanças",
      mood: "diário e gastos nos mesmos dias",
      habits: "hábitos",
      projects: "projetos",
      wellbeing: "notas de bem-estar",
    }[intent];
    return `Ainda não há dados suficientes sobre ${topic} para uma leitura segura. Conforme você registra mais, pode valer voltar a observar esse tema, sem pressão.`;
  }
  return `${matches.map((insight) => insight.body).join(" ")} Isso faz sentido para você?`;
}

export function createInitialMentorMessage(
  insights: readonly MentorInsight[],
  displayName?: string,
): MentorMessage {
  const greeting = displayName ? `Bom te ver, ${displayName}. ` : "Bom te ver. ";
  const strongest = insights
    .filter((insight) => insight.type !== "suggestion")
    .sort((a, b) => b.priority - a.priority)[0];
  return {
    id: "mentor-initial",
    role: "mentor",
    body: strongest
      ? `${greeting}Cruzei os registros disponíveis e encontrei uma leitura que pode valer observar: ${strongest.body} Isso faz sentido para você?`
      : `${greeting}Ainda não há dados suficientes para identificar um padrão com segurança. Seus próximos registros podem ajudar a construir uma leitura útil, sem pressa e sem julgamento.`,
  };
}
