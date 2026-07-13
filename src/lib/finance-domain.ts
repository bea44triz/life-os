export type ImportContext = "bank_account" | "credit_card";

export type ImportedTransactionKind =
  | "standard"
  | "bank_transfer"
  | "credit_card_payment"
  | "invoice_credit"
  | "refund"
  | "cashback"
  | "financial_charge"
  | "previous_balance";

export type SuggestedTransactionType = "income" | "expense" | "transfer";

export type ImportedTransactionClassification = {
  kind: ImportedTransactionKind;
  suggestedType: SuggestedTransactionType | null;
  requiresReview: boolean;
};

const BANK_TRANSFER_TERMS = [
  "transferencia",
  "pix enviado",
  "pix recebido",
  "ted",
  "doc",
  "resgate",
  "aplicacao",
  "movimentacao entre contas",
];

const CREDIT_CARD_PAYMENT_TERMS = [
  "pagamento recebido",
  "pagamento de fatura",
  "fatura paga",
  "quitacao",
  "debito automatico fatura",
];

const INVOICE_CREDIT_TERMS = [
  "credito em fatura",
  "credito na fatura",
  "ajuste a credito",
];

const REFUND_TERMS = ["estorno", "reembolso", "compra cancelada"];
const CASHBACK_TERMS = ["cashback", "dinheiro de volta"];
const PREVIOUS_BALANCE_TERMS = [
  "valor pendente do mes anterior",
  "saldo anterior",
  "saldo da fatura anterior",
];
const FINANCIAL_CHARGE_TERMS = [
  "juros",
  "iof",
  "multa",
  "encargos",
  "encargo",
  "tarifa",
  "conversao limite",
  "rotativo",
];

const GENERIC_DESCRIPTIONS = new Set([
  "",
  "compra",
  "pagamento",
  "transacao",
  "lancamento",
  "estabelecimento",
  "cartao",
  "nubank",
  "pix",
  "ted",
  "doc",
  "outros",
  "nao informado",
  "sem descricao",
]);

function includesAny(description: string, terms: readonly string[]): boolean {
  return terms.some((term) => description.includes(term));
}

export function normalizeTransactionDescription(description: string | null | undefined): string {
  return String(description ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function isGenericDescription(description: string | null | undefined): boolean {
  const normalized = normalizeTransactionDescription(description);
  if (GENERIC_DESCRIPTIONS.has(normalized)) return true;
  return /^(compra|pagamento|transacao|lancamento|pix|ted|doc)\s+\d+$/.test(
    normalized,
  );
}

export function classifyImportedTransaction(input: {
  description: string | null | undefined;
  amount: number;
  context: ImportContext;
}): ImportedTransactionClassification {
  const description = normalizeTransactionDescription(input.description);
  const generic = isGenericDescription(description);

  if (input.context === "credit_card") {
    if (includesAny(description, CASHBACK_TERMS)) {
      return { kind: "cashback", suggestedType: "transfer", requiresReview: generic };
    }
    if (includesAny(description, REFUND_TERMS)) {
      return { kind: "refund", suggestedType: "transfer", requiresReview: generic };
    }
    if (includesAny(description, CREDIT_CARD_PAYMENT_TERMS)) {
      return {
        kind: "credit_card_payment",
        suggestedType: "transfer",
        requiresReview: generic,
      };
    }
    if (includesAny(description, INVOICE_CREDIT_TERMS)) {
      return { kind: "invoice_credit", suggestedType: "transfer", requiresReview: generic };
    }
    if (includesAny(description, PREVIOUS_BALANCE_TERMS)) {
      return { kind: "previous_balance", suggestedType: "expense", requiresReview: generic };
    }
    if (includesAny(description, FINANCIAL_CHARGE_TERMS)) {
      return { kind: "financial_charge", suggestedType: "expense", requiresReview: generic };
    }
    if (includesAny(description, BANK_TRANSFER_TERMS)) {
      return { kind: "bank_transfer", suggestedType: "transfer", requiresReview: generic };
    }

    return {
      kind: "standard",
      suggestedType: input.amount >= 0 ? "expense" : null,
      requiresReview: generic || input.amount < 0,
    };
  }

  if (includesAny(description, BANK_TRANSFER_TERMS)) {
    return { kind: "bank_transfer", suggestedType: "transfer", requiresReview: generic };
  }

  return {
    kind: "standard",
    suggestedType: input.amount >= 0 ? "income" : "expense",
    requiresReview: generic,
  };
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export type InvoiceAmounts = {
  charges: number;
  credits: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  excessCredit: number;
};

export function deriveInvoiceAmounts(
  entries: ReadonlyArray<{
    amount: number;
    kind: ImportedTransactionKind;
  }>,
): InvoiceAmounts {
  let charges = 0;
  let credits = 0;
  let payments = 0;

  for (const entry of entries) {
    const amount = Math.abs(Number(entry.amount) || 0);
    if (entry.kind === "credit_card_payment") payments += amount;
    else if (
      entry.kind === "invoice_credit" ||
      entry.kind === "refund" ||
      entry.kind === "cashback"
    ) {
      credits += amount;
    } else if (entry.kind !== "bank_transfer") {
      charges += amount;
    }
  }

  charges = roundCurrency(charges);
  credits = roundCurrency(credits);
  const totalAmount = roundCurrency(Math.max(charges - credits, 0));
  const creditBalance = roundCurrency(Math.max(credits - charges, 0));
  const paidAmount = roundCurrency(payments);
  const pendingAmount = roundCurrency(Math.max(totalAmount - paidAmount, 0));
  const excessCredit = roundCurrency(
    Math.max(paidAmount + creditBalance - totalAmount, 0),
  );

  return { charges, credits, totalAmount, paidAmount, pendingAmount, excessCredit };
}

export type InvoiceStatus = "open" | "closed" | "paid" | "overdue";

export function deriveInvoiceStatus(input: {
  amounts: Pick<InvoiceAmounts, "totalAmount" | "pendingAmount" | "excessCredit">;
  closingDate: string;
  dueDate: string;
  today: string;
}): InvoiceStatus {
  const hasSettlement = input.amounts.totalAmount > 0 || input.amounts.excessCredit > 0;
  if (hasSettlement && input.amounts.pendingAmount <= 0) return "paid";
  if (input.amounts.pendingAmount > 0 && input.today > input.dueDate) return "overdue";
  if (input.today > input.closingDate) return "closed";
  return "open";
}

export function computeUsedCreditLimit(
  invoices: ReadonlyArray<{ totalAmount: number; paidAmount?: number }>,
): number {
  return roundCurrency(
    invoices.reduce(
      (used, invoice) =>
        used + Math.max(Number(invoice.totalAmount) - Number(invoice.paidAmount ?? 0), 0),
      0,
    ),
  );
}

function clampDay(year: number, monthIdx: number, day: number): Date {
  const last = new Date(year, monthIdx + 1, 0).getDate();
  return new Date(year, monthIdx, Math.min(day, last));
}

function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type InvoicePeriod = {
  referenceMonth: string;
  openingDate: string;
  closingDate: string;
  dueDate: string;
  label: string;
  belongsToCurrent: boolean;
};

export function computeInvoicePeriod(
  purchaseISO: string,
  card: { closing_day: number | null; due_day: number | null },
): InvoicePeriod {
  const closingDay = card.closing_day ?? 1;
  const dueDay = card.due_day ?? closingDay;
  const [year, month, day] = purchaseISO.split("-").map(Number);
  const purchase = new Date(year, month - 1, day);
  const belongsToCurrent = purchase.getDate() <= closingDay;

  let referenceYear = purchase.getFullYear();
  let referenceMonth = purchase.getMonth();
  if (!belongsToCurrent) {
    referenceMonth += 1;
    if (referenceMonth > 11) {
      referenceMonth = 0;
      referenceYear += 1;
    }
  }

  const closingDate = clampDay(referenceYear, referenceMonth, closingDay);
  const previousMonth = referenceMonth === 0 ? 11 : referenceMonth - 1;
  const previousYear = referenceMonth === 0 ? referenceYear - 1 : referenceYear;
  const openingDate = clampDay(previousYear, previousMonth, closingDay);
  openingDate.setDate(openingDate.getDate() + 1);

  let dueYear = referenceYear;
  let dueMonth = referenceMonth;
  if (dueDay < closingDay) {
    dueMonth += 1;
    if (dueMonth > 11) {
      dueMonth = 0;
      dueYear += 1;
    }
  }
  const dueDate = clampDay(dueYear, dueMonth, dueDay);

  return {
    referenceMonth: toISODate(new Date(referenceYear, referenceMonth, 1)),
    openingDate: toISODate(openingDate),
    closingDate: toISODate(closingDate),
    dueDate: toISODate(dueDate),
    label: closingDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    belongsToCurrent,
  };
}

export function computeInstallmentAmounts(totalAmount: number, installments: number): number[] {
  const count = Math.max(1, Math.floor(installments));
  const perInstallment = roundCurrency(totalAmount / count);
  return Array.from({ length: count }, (_, index) =>
    index === count - 1
      ? roundCurrency(totalAmount - perInstallment * (count - 1))
      : perInstallment,
  );
}
