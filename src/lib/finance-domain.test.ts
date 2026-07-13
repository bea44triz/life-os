import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyImportedTransaction,
  computeInstallmentAmounts,
  computeInvoicePeriod,
  computeUsedCreditLimit,
  deriveInvoiceAmounts,
  deriveInvoiceStatus,
  isGenericDescription,
  normalizeTransactionDescription,
} from "./finance-domain.ts";

test("normalizes accents, punctuation and whitespace for stable matching", () => {
  assert.equal(
    normalizeTransactionDescription("  Pagamento  de FÁTURA — Nubank  "),
    "pagamento de fatura nubank",
  );
});

test("flags descriptions that do not identify the real transaction", () => {
  assert.equal(isGenericDescription("Compra"), true);
  assert.equal(isGenericDescription("LANÇAMENTO 123"), true);
  assert.equal(isGenericDescription("Mercado São Jorge"), false);
});

test("characterizes real Nubank invoice descriptions", () => {
  const cases = [
    ["Pagamento recebido", -1_250, "credit_card_payment", "transfer"],
    ["Crédito em fatura", -25, "invoice_credit", "transfer"],
    ["Estorno de compra - AMAZON", -79.9, "refund", "transfer"],
    ["Crédito de Cashback", -12.5, "cashback", "transfer"],
    ["Juros de atraso", 8.42, "financial_charge", "expense"],
    ["IOF de financiamento", 1.23, "financial_charge", "expense"],
    ["Valor pendente do mês anterior", 320, "previous_balance", "expense"],
    ["Uber *Trip", 24.9, "standard", "expense"],
  ] as const;

  for (const [description, amount, kind, suggestedType] of cases) {
    const actual = classifyImportedTransaction({
      description,
      amount,
      context: "credit_card",
    });
    assert.equal(actual.kind, kind, description);
    assert.equal(actual.suggestedType, suggestedType, description);
  }
});

test("keeps ambiguous negative card lines pending for explicit review", () => {
  assert.deepEqual(
    classifyImportedTransaction({
      description: "Ajuste Nubank",
      amount: -10,
      context: "credit_card",
    }),
    { kind: "standard", suggestedType: null, requiresReview: true },
  );
});

test("classifies bank income, expense and transfers without changing their sign", () => {
  assert.equal(
    classifyImportedTransaction({
      description: "Salário",
      amount: 5000,
      context: "bank_account",
    }).suggestedType,
    "income",
  );
  assert.equal(
    classifyImportedTransaction({
      description: "Supermercado",
      amount: -250,
      context: "bank_account",
    }).suggestedType,
    "expense",
  );
  assert.equal(
    classifyImportedTransaction({
      description: "Pix enviado para João",
      amount: -80,
      context: "bank_account",
    }).kind,
    "bank_transfer",
  );
});

test("derives invoice total, payment, pending balance and excess credit", () => {
  const amounts = deriveInvoiceAmounts([
    { amount: 100, kind: "standard" },
    { amount: 5, kind: "financial_charge" },
    { amount: 20, kind: "refund" },
    { amount: 100, kind: "credit_card_payment" },
  ]);
  assert.deepEqual(amounts, {
    charges: 105,
    credits: 20,
    totalAmount: 85,
    paidAmount: 100,
    pendingAmount: 0,
    excessCredit: 15,
  });
});

test("derives open, closed, paid and overdue invoice statuses", () => {
  const base = { closingDate: "2026-07-20", dueDate: "2026-07-27" };
  assert.equal(
    deriveInvoiceStatus({
      ...base,
      today: "2026-07-15",
      amounts: { totalAmount: 100, pendingAmount: 100, excessCredit: 0 },
    }),
    "open",
  );
  assert.equal(
    deriveInvoiceStatus({
      ...base,
      today: "2026-07-22",
      amounts: { totalAmount: 100, pendingAmount: 100, excessCredit: 0 },
    }),
    "closed",
  );
  assert.equal(
    deriveInvoiceStatus({
      ...base,
      today: "2026-07-28",
      amounts: { totalAmount: 100, pendingAmount: 25, excessCredit: 0 },
    }),
    "overdue",
  );
  assert.equal(
    deriveInvoiceStatus({
      ...base,
      today: "2026-07-28",
      amounts: { totalAmount: 100, pendingAmount: 0, excessCredit: 0 },
    }),
    "paid",
  );
});

test("used credit limit excludes amounts already paid and never becomes negative", () => {
  assert.equal(
    computeUsedCreditLimit([
      { totalAmount: 800, paidAmount: 300 },
      { totalAmount: 250 },
      { totalAmount: 100, paidAmount: 150 },
    ]),
    750,
  );
});

test("computes closing and due dates across month and year boundaries", () => {
  assert.deepEqual(
    computeInvoicePeriod("2026-12-29", { closing_day: 28, due_day: 5 }),
    {
      referenceMonth: "2027-01-01",
      openingDate: "2026-12-29",
      closingDate: "2027-01-28",
      dueDate: "2027-02-05",
      label: "janeiro de 2027",
      belongsToCurrent: false,
    },
  );
  assert.equal(
    computeInvoicePeriod("2026-02-10", { closing_day: 31, due_day: 31 }).closingDate,
    "2026-02-28",
  );
});

test("splits installments in cents and puts the rounding residual in the last one", () => {
  const plan = computeInstallmentAmounts(100, 3);
  assert.deepEqual(plan, [33.33, 33.33, 33.34]);
  assert.equal(plan.reduce((total, amount) => total + amount, 0), 100);
});
