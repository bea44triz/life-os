import assert from "node:assert/strict";
import test from "node:test";
import type { Habit, HabitLog, JournalEntry, Project, Transaction } from "./finance-api.ts";
import {
  buildMentorResponse,
  createInitialMentorMessage,
  generateMentorInsights,
  summarizeMonthlyFinances,
  type MentorInsightInput,
} from "./mentor-insights.ts";

const now = new Date("2026-07-16T12:00:00.000Z");

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: crypto.randomUUID(),
    user_id: "user-1",
    type: "expense",
    description: "Compra",
    amount: 100,
    transaction_date: "2026-07-10",
    competence_date: null,
    category_id: null,
    subcategory_id: null,
    financial_account_id: null,
    credit_card_id: null,
    credit_card_invoice_id: null,
    project_id: null,
    payment_method: null,
    is_recurring: null,
    is_installment: null,
    installment_number: null,
    installment_total: null,
    notes: null,
    origin: "manual",
    review_status: "approved",
    metadata: null,
    created_at: "2026-07-10T12:00:00.000Z",
    updated_at: "2026-07-10T12:00:00.000Z",
    ...overrides,
  };
}

function journal(day: number, anxiety: number, mood = 3): JournalEntry {
  const date = `2026-07-${String(day).padStart(2, "0")}T12:00:00.000Z`;
  return {
    id: `journal-${day}`,
    user_id: "user-1",
    mood,
    energy: 3,
    anxiety,
    gratitude: null,
    content: "Registro do dia",
    created_at: date,
    updated_at: date,
  };
}

function habit(id: string): Habit {
  return {
    id,
    user_id: "user-1",
    name: `Hábito ${id}`,
    description: null,
    frequency: "diária",
    created_at: "2026-07-01T12:00:00.000Z",
    updated_at: "2026-07-01T12:00:00.000Z",
  };
}

function habitLog(id: string, habitId: string, createdAt: string, completed = true): HabitLog {
  return {
    id,
    habit_id: habitId,
    user_id: "user-1",
    completed,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

function input(overrides: Partial<MentorInsightInput> = {}): MentorInsightInput {
  return {
    transactions: [],
    categories: [],
    creditCards: [],
    invoices: [],
    projects: [],
    habits: [],
    habitLogs: [],
    journalEntries: [],
    wellbeingLogs: [],
    now,
    ...overrides,
  };
}

test("does not generate a mood/spending pattern with fewer than four overlapping days", () => {
  const insights = generateMentorInsights(
    input({
      transactions: [8, 9, 10].map((day) =>
        transaction({ transaction_date: `2026-07-${String(day).padStart(2, "0")}` }),
      ),
      journalEntries: [journal(8, 5), journal(9, 5), journal(10, 2)],
    }),
  );

  assert.equal(
    insights.some((insight) => insight.type === "mood"),
    false,
  );
});

test("generates a mood/spending pattern only when both comparison groups meet the minimum", () => {
  const insights = generateMentorInsights(
    input({
      transactions: [
        transaction({ id: "t8", amount: 200, transaction_date: "2026-07-08" }),
        transaction({ id: "t9", amount: 220, transaction_date: "2026-07-09" }),
        transaction({ id: "t10", amount: 50, transaction_date: "2026-07-10" }),
        transaction({ id: "t11", amount: 60, transaction_date: "2026-07-11" }),
      ],
      journalEntries: [journal(8, 5), journal(9, 4), journal(10, 2), journal(11, 3)],
    }),
  );

  const moodInsight = insights.find((insight) => insight.type === "mood");
  assert.ok(moodInsight);
  assert.match(moodInsight.body, /apareceu junto/i);
  assert.match(moodInsight.body, /não indica causa/i);
});

test("describes projects only from their recorded statuses", () => {
  const projects: Project[] = [
    { id: "p1", user_id: "user-1", name: "Viagem", type: "pessoal", status: "ativo" },
    { id: "p2", user_id: "user-1", name: "Curso", type: "estudo", status: "pausado" },
  ];
  const insight = generateMentorInsights(input({ projects })).find(
    (candidate) => candidate.type === "projects",
  );

  assert.ok(insight);
  assert.match(insight.body, /status cadastrado/i);
  assert.doesNotMatch(insight.body, /\d+%/);
  assert.doesNotMatch(insight.body, /prazo estimado/i);
});

test("counts completions and distinct habits from the last seven days", () => {
  const insight = generateMentorInsights(
    input({
      habits: [habit("h1"), habit("h2")],
      habitLogs: [
        habitLog("l1", "h1", "2026-07-15T12:00:00.000Z"),
        habitLog("l2", "h2", "2026-07-12T12:00:00.000Z"),
        habitLog("l3", "h1", "2026-07-08T11:00:00.000Z"),
        habitLog("l4", "h2", "2026-07-14T12:00:00.000Z", false),
      ],
    }),
  ).find((candidate) => candidate.type === "habits");

  assert.ok(insight);
  assert.match(insight.body, /2 conclusões/);
  assert.match(insight.body, /2 hábitos diferentes/);
  assert.doesNotMatch(insight.body, /streak|sequência de \d/i);
});

test("monthly summary excludes invoice payments and card purchases from income and expenses", () => {
  const summary = summarizeMonthlyFinances(
    [
      transaction({ id: "income", type: "income", amount: 1_000 }),
      transaction({ id: "expense", type: "expense", amount: 200 }),
      transaction({
        id: "invoice-payment",
        type: "expense",
        amount: 500,
        metadata: { invoice_payment: true },
      }),
      transaction({ id: "card-purchase", type: "credit_card_purchase", amount: 300 }),
      transaction({ id: "pending", type: "expense", amount: 900, review_status: "pending" }),
    ],
    now,
  );

  assert.equal(summary.income, 1_000);
  assert.equal(summary.expenses, 200);
  assert.equal(summary.incomeCount, 1);
  assert.equal(summary.expenseCount, 1);
});

test("returns a safe and transparent message when there is not enough data", () => {
  const initial = createInitialMentorMessage([], "Ana");
  const financeResponse = buildMentorResponse("finance", []);
  const unknownResponse = buildMentorResponse("unknown", []);

  assert.match(initial.body, /não há dados suficientes/i);
  assert.match(initial.body, /sem julgamento/i);
  assert.match(financeResponse, /não há dados suficientes/i);
  assert.match(unknownResponse, /nesta primeira versão/i);
});
