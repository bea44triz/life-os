import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyPersistedInvoiceTransaction,
  classifyImportedTransaction,
  computeInstallmentAmounts,
  computeInvoicePeriod,
  computeUsedCreditLimit,
  deriveImportedApprovalPlan,
  deriveInvoiceBalance,
  deriveInvoiceAmounts,
  deriveInvoiceStatus,
  isGenericDescription,
  normalizeTransactionDescription,
  readImportedLineSelection,
  suggestCategoryName,
  validateImportedLineForApproval,
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
    ["Estorno de compra - AMAZON", -79.9, "invoice_credit", "transfer"],
    ["Reembolso de compra", -45, "refund", "transfer"],
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
    totalAmount: 105,
    paidAmount: 120,
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

test("derives pending balance and excess credit without adding invoice columns", () => {
  assert.deepEqual(deriveInvoiceBalance({ totalAmount: 500, paidAmount: 125 }), {
    totalAmount: 500,
    paidAmount: 125,
    pendingAmount: 375,
    excessCredit: 0,
  });
  assert.deepEqual(deriveInvoiceBalance({ totalAmount: 500, paidAmount: 620 }), {
    totalAmount: 500,
    paidAmount: 620,
    pendingAmount: 0,
    excessCredit: 120,
  });
});

test("does not mark an invoice with only excess credit as paid", () => {
  assert.equal(
    deriveInvoiceStatus({
      closingDate: "2026-07-20",
      dueDate: "2026-07-27",
      today: "2026-07-22",
      amounts: { totalAmount: 0, pendingAmount: 0, excessCredit: 50 },
    }),
    "closed",
  );
});

test("computes closing and due dates across month and year boundaries", () => {
  assert.deepEqual(computeInvoicePeriod("2026-12-29", { closing_day: 28, due_day: 5 }), {
    referenceMonth: "2027-01-01",
    openingDate: "2026-12-29",
    closingDate: "2027-01-28",
    dueDate: "2027-02-05",
    label: "janeiro de 2027",
    belongsToCurrent: false,
  });
  assert.equal(
    computeInvoicePeriod("2026-02-10", { closing_day: 31, due_day: 31 }).closingDate,
    "2026-02-28",
  );
});

test("splits installments in cents and puts the rounding residual in the last one", () => {
  const plan = computeInstallmentAmounts(100, 3);
  assert.deepEqual(plan, [33.33, 33.33, 33.34]);
  assert.equal(
    plan.reduce((total, amount) => total + amount, 0),
    100,
  );
});

test("reads current and legacy import selections in one place", () => {
  assert.deepEqual(
    readImportedLineSelection({
      selected_type: "credit_card_purchase",
      destination_account_id: "account-2",
    }),
    { selectedType: "expense", destinationAccountId: "account-2" },
  );
  assert.equal(
    readImportedLineSelection({
      selected_type: "expense",
      user_selected_type: "transfer",
    }).selectedType,
    "transfer",
  );
});

test("category suggestions share normalized financial classification terms", () => {
  assert.equal(suggestCategoryName("JUROS de atraso Nubank"), "Encargos financeiros");
  assert.equal(suggestCategoryName("Farmácia São Paulo"), "Saúde");
  assert.equal(suggestCategoryName("Pagamento recebido"), null);
});

test("approval validation uses the central classification and keeps review auditable", () => {
  const paymentWithoutAccount = validateImportedLineForApproval({
    date: "2026-07-10",
    amount: -500,
    description: "Pagamento recebido",
    context: "credit_card",
    selectedType: null,
    financialAccountId: null,
    creditCardId: "card-1",
    destinationAccountId: null,
  });
  assert.match(paymentWithoutAccount ?? "", /selecione a conta/i);

  const ambiguousCredit = validateImportedLineForApproval({
    date: "2026-07-10",
    amount: -10,
    description: "Ajuste Nubank",
    context: "credit_card",
    selectedType: null,
    financialAccountId: "account-1",
    creditCardId: "card-1",
    destinationAccountId: null,
  });
  assert.match(ambiguousCredit ?? "", /escolha o tipo/i);
});

test("maps bank approvals to income, expense and auditable transfers", () => {
  const bankPlan = (
    description: string,
    amount: number,
    selectedType: "income" | "expense" | "transfer" | null = null,
  ) =>
    deriveImportedApprovalPlan({
      classification: classifyImportedTransaction({
        description,
        amount,
        context: "bank_account",
      }),
      context: "bank_account",
      amount,
      selectedType,
    });

  assert.deepEqual(bankPlan("Salário", 5000), {
    type: "income",
    amount: 5000,
    movementType: null,
    isInvoiceMovement: false,
    requiresFinancialAccount: true,
    requiresDestinationAccount: false,
    requiresCreditCard: false,
    affectsIncomeExpense: true,
  });
  assert.equal(bankPlan("Supermercado", -100)?.type, "expense");
  assert.deepEqual(
    {
      type: bankPlan("Pix enviado", -100)?.type,
      destination: bankPlan("Pix enviado", -100)?.requiresDestinationAccount,
      affectsIncomeExpense: bankPlan("Pix enviado", -100)?.affectsIncomeExpense,
    },
    { type: "transfer", destination: true, affectsIncomeExpense: false },
  );
});

test("maps each special card movement to its persisted type and metadata kind", () => {
  const cardPlan = (description: string, amount: number) => {
    const classification = classifyImportedTransaction({
      description,
      amount,
      context: "credit_card",
    });
    return deriveImportedApprovalPlan({
      classification,
      context: "credit_card",
      amount,
      selectedType: null,
    });
  };

  const cases = [
    ["Compra Nubank", 100, "credit_card_purchase", null, false],
    ["Juros de atraso", 10, "credit_card_purchase", "financial_charge", false],
    ["Saldo anterior", 200, "credit_card_purchase", "previous_balance", false],
    ["Pagamento recebido", -300, "transfer", "credit_card_payment", true],
    ["Estorno de compra", -50, "transfer", "invoice_credit", false],
    ["Crédito em fatura", -25, "transfer", "invoice_credit", false],
    ["Reembolso", -40, "transfer", "refund", false],
    ["Cashback", -12, "transfer", "cashback", false],
  ] as const;

  for (const [description, amount, type, movementType, requiresAccount] of cases) {
    const actual = cardPlan(description, amount);
    assert.equal(actual?.type, type, description);
    assert.equal(actual?.movementType, movementType, description);
    assert.equal(actual?.requiresFinancialAccount, requiresAccount, description);
  }
});

test("invoice credits validate without a bank account while payments still require one", () => {
  const base = {
    date: "2026-07-10",
    amount: -50,
    context: "credit_card" as const,
    selectedType: null,
    financialAccountId: null,
    creditCardId: "card-1",
    destinationAccountId: null,
  };
  for (const description of ["Estorno de compra", "Crédito em fatura", "Reembolso", "Cashback"]) {
    assert.equal(validateImportedLineForApproval({ ...base, description }), null, description);
  }
  assert.match(
    validateImportedLineForApproval({ ...base, description: "Pagamento recebido" }) ?? "",
    /selecione a conta/i,
  );
});

test("maps persisted invoice transactions and excludes unrelated transfers", () => {
  assert.equal(
    classifyPersistedInvoiceTransaction({
      type: "credit_card_purchase",
      metadata: { movement_type: "financial_charge" },
    }),
    "financial_charge",
  );
  assert.equal(
    classifyPersistedInvoiceTransaction({
      type: "transfer",
      metadata: { movement_type: "cashback" },
    }),
    "cashback",
  );
  assert.equal(
    classifyPersistedInvoiceTransaction({
      type: "transfer",
      metadata: { destination_account_id: "account-2" },
    }),
    null,
  );
});

test("derives a real Nubank invoice with purchases, charges, previous balance and credits", () => {
  const amounts = deriveInvoiceAmounts([
    { amount: 1200, kind: "standard" },
    { amount: 300, kind: "standard" },
    { amount: 10, kind: "financial_charge" },
    { amount: 2, kind: "financial_charge" },
    { amount: 5, kind: "financial_charge" },
    { amount: 100, kind: "previous_balance" },
    { amount: 1000, kind: "credit_card_payment" },
    { amount: 50, kind: "invoice_credit" },
    { amount: 100, kind: "refund" },
    { amount: 20, kind: "cashback" },
  ]);
  assert.deepEqual(amounts, {
    charges: 1617,
    credits: 170,
    totalAmount: 1617,
    paidAmount: 1170,
    pendingAmount: 447,
    excessCredit: 0,
  });
  assert.equal(
    computeUsedCreditLimit([{ totalAmount: amounts.totalAmount, paidAmount: amounts.paidAmount }]),
    447,
  );
});
