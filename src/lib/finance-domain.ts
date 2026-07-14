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

export const MANUAL_TRANSACTION_TYPES = ["income", "expense", "transfer"] as const;

export type ImportedTransactionClassification = {
  kind: ImportedTransactionKind;
  suggestedType: SuggestedTransactionType | null;
  requiresReview: boolean;
};

export type ImportedTransactionPresentation = {
  badge: string;
  direction: string;
  tone: "positive" | "negative" | "neutral";
};

export function getImportedTransactionPresentation(input: {
  classification: ImportedTransactionClassification;
  context: ImportContext;
  description?: string | null;
  effectiveType?: SuggestedTransactionType | null;
}): ImportedTransactionPresentation {
  const kind = input.classification.kind;
  if (kind === "credit_card_payment") {
    return { badge: "Pagamento de fatura", direction: "Saída para fatura", tone: "positive" };
  }
  if (kind === "invoice_credit") {
    const normalized = normalizeTransactionDescription(input.description);
    return {
      badge: normalized.includes("estorno") ? "Estorno" : "Crédito na fatura",
      direction: "Crédito na fatura",
      tone: "positive",
    };
  }
  if (kind === "refund") {
    return { badge: "Reembolso", direction: "Crédito na fatura", tone: "positive" };
  }
  if (kind === "cashback") {
    return { badge: "Cashback", direction: "Crédito na fatura", tone: "positive" };
  }
  if (kind === "financial_charge") {
    return { badge: "Encargo financeiro", direction: "Aumenta a fatura", tone: "negative" };
  }
  if (kind === "previous_balance") {
    return { badge: "Saldo anterior", direction: "Aumenta a fatura", tone: "negative" };
  }
  const effectiveType = input.effectiveType ?? input.classification.suggestedType;
  if (kind === "bank_transfer" || effectiveType === "transfer") {
    return { badge: "Transferência", direction: "Entre contas", tone: "neutral" };
  }
  if (input.context === "credit_card") {
    return { badge: "Despesa no cartão", direction: "Aumenta a fatura", tone: "negative" };
  }
  if (effectiveType === "income") {
    return { badge: "Receita", direction: "Entrada", tone: "positive" };
  }
  return { badge: "Despesa", direction: "Saída", tone: "negative" };
}

export function chooseInvoiceDestination(input: {
  selectedInvoiceId?: string | null;
  dueDateInvoiceId?: string | null;
  datedInvoiceId?: string | null;
}): string | null {
  return input.selectedInvoiceId ?? input.dueDateInvoiceId ?? input.datedInvoiceId ?? null;
}

export type ImportedLineSelection = {
  selectedType: SuggestedTransactionType | null;
  destinationAccountId: string | null;
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
  "estorno",
  "compra cancelada",
];

const REFUND_TERMS = ["reembolso"];
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
  "pix recebido",
  "pix enviado",
  "transferencia",
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
  return /^(compra|pagamento|transacao|lancamento|pix|ted|doc)\s+\d+$/.test(normalized);
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

export type InvoiceCreditMovementType =
  "credit_card_payment" | "invoice_credit" | "refund" | "cashback";

export function isInvoiceCreditMovement(
  kind: ImportedTransactionKind,
): kind is InvoiceCreditMovementType {
  return (
    kind === "credit_card_payment" ||
    kind === "invoice_credit" ||
    kind === "refund" ||
    kind === "cashback"
  );
}

export type PersistedTransactionType = "income" | "expense" | "transfer" | "credit_card_purchase";

export type InvoiceMovementType =
  InvoiceCreditMovementType | "financial_charge" | "previous_balance";

export type ClassificationSignature = {
  description_original: string;
  description_normalized: string;
  file_context: ImportContext;
  visual_type: SuggestedTransactionType;
  visual_type_label: "Receita" | "Despesa" | "Transferência";
  transaction_type: PersistedTransactionType;
  classification_kind: ImportedTransactionKind;
  movement_type: InvoiceMovementType | null;
  category_id: string | null;
  subcategory_id: string | null;
  project_id: string | null;
  financial_account_id: string | null;
  destination_account_id: string | null;
  credit_card_id: string | null;
  credit_card_invoice_id: string | null;
  suggestion_source: "user_approved";
  approved_at: string;
};

export type ClassificationSignatureInput = {
  description: string | null | undefined;
  context: ImportContext;
  visualType: SuggestedTransactionType;
  transactionType: PersistedTransactionType;
  classificationKind: ImportedTransactionKind;
  movementType?: InvoiceMovementType | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  projectId?: string | null;
  financialAccountId?: string | null;
  destinationAccountId?: string | null;
  creditCardId?: string | null;
  creditCardInvoiceId?: string | null;
  approvedAt?: string;
};

const VISUAL_TYPE_LABELS: Record<
  SuggestedTransactionType,
  ClassificationSignature["visual_type_label"]
> = {
  income: "Receita",
  expense: "Despesa",
  transfer: "Transferência",
};

export function buildClassificationSignature(
  input: ClassificationSignatureInput,
): ClassificationSignature {
  const original = String(input.description ?? "").trim();
  return {
    description_original: original,
    description_normalized: normalizeTransactionDescription(original),
    file_context: input.context,
    visual_type: input.visualType,
    visual_type_label: VISUAL_TYPE_LABELS[input.visualType],
    transaction_type: input.transactionType,
    classification_kind: input.classificationKind,
    movement_type: input.movementType ?? null,
    category_id: input.categoryId ?? null,
    subcategory_id: input.subcategoryId ?? null,
    project_id: input.projectId ?? null,
    financial_account_id: input.financialAccountId ?? null,
    destination_account_id:
      input.visualType === "transfer" ? (input.destinationAccountId ?? null) : null,
    credit_card_id: input.creditCardId ?? null,
    credit_card_invoice_id: input.creditCardInvoiceId ?? null,
    suggestion_source: "user_approved",
    approved_at: input.approvedAt ?? new Date().toISOString(),
  };
}

export type HistoricalSuggestionInput = {
  description: string | null | undefined;
  context: ImportContext;
  amount: number;
  financialAccountId?: string | null;
  creditCardId?: string | null;
};

function hasSameImportScope(
  signature: ClassificationSignature,
  input: HistoricalSuggestionInput,
): boolean {
  if (input.context === "bank_account") {
    return (
      !!input.financialAccountId && signature.financial_account_id === input.financialAccountId
    );
  }
  return !!input.creditCardId && signature.credit_card_id === input.creditCardId;
}

export function isSafeHistoryMatch(
  signature: ClassificationSignature,
  input: HistoricalSuggestionInput,
): boolean {
  const normalized = normalizeTransactionDescription(input.description);
  if (!normalized || signature.description_normalized !== normalized) return false;
  if (signature.file_context !== input.context) return false;
  if (!hasSameImportScope(signature, input)) return false;

  const current = classifyImportedTransaction({
    description: input.description,
    amount: input.amount,
    context: input.context,
  });
  if (!isGenericDescription(normalized)) return true;

  // Generic labels are only reusable when account/card and the special movement
  // pattern agree. Plain "PAGAMENTO", "TED" or "DOC" remains manual review.
  return (
    current.kind !== "standard" &&
    signature.classification_kind === current.kind &&
    signature.movement_type ===
      (isInvoiceCreditMovement(current.kind) ||
      current.kind === "financial_charge" ||
      current.kind === "previous_balance"
        ? current.kind
        : null)
  );
}

export function findHistoricalSuggestion(
  history: readonly ClassificationSignature[],
  input: HistoricalSuggestionInput,
): ClassificationSignature | null {
  return history.find((signature) => isSafeHistoryMatch(signature, input)) ?? null;
}

export type HistoryApplicableImportedLine = {
  review_status: string;
  selected_category_id: string | null;
  selected_subcategory_id?: string | null;
  selected_project_id: string | null;
  selected_financial_account_id: string | null;
  selected_credit_card_id: string | null;
  selected_credit_card_invoice_id?: string | null;
  metadata: Record<string, unknown> | null;
};

export function applyHistoricalSuggestionToImportedLine<T extends HistoryApplicableImportedLine>(
  line: T,
  suggestion: ClassificationSignature,
): T {
  return {
    ...line,
    review_status: "pending",
    selected_category_id: suggestion.category_id,
    selected_subcategory_id: suggestion.subcategory_id,
    selected_project_id: suggestion.project_id,
    selected_financial_account_id:
      suggestion.file_context === "bank_account"
        ? suggestion.financial_account_id
        : line.selected_financial_account_id,
    selected_credit_card_id:
      suggestion.file_context === "credit_card"
        ? suggestion.credit_card_id
        : line.selected_credit_card_id,
    // An invoice is period-specific. Keep the new import's destination unresolved
    // so the existing due-date/date logic selects the current invoice.
    selected_credit_card_invoice_id: line.selected_credit_card_invoice_id ?? null,
    metadata: {
      ...(line.metadata ?? {}),
      selected_type: suggestion.visual_type,
      suggested_transaction_type: suggestion.transaction_type,
      classification_kind: suggestion.classification_kind,
      movement_type: suggestion.movement_type,
      destination_account_id:
        suggestion.visual_type === "transfer" ? suggestion.destination_account_id : null,
      suggestion_source: "user_history",
      confidence: "high",
      suggestion_confidence: 1,
      requires_review: false,
      history_signature_approved_at: suggestion.approved_at,
    },
  };
}

export type ImportedApprovalPlan = {
  type: PersistedTransactionType;
  amount: number;
  movementType: InvoiceMovementType | null;
  isInvoiceMovement: boolean;
  requiresFinancialAccount: boolean;
  requiresDestinationAccount: boolean;
  requiresCreditCard: boolean;
  affectsIncomeExpense: boolean;
};

export function deriveImportedApprovalPlan(input: {
  classification: ImportedTransactionClassification;
  context: ImportContext;
  amount: number;
  selectedType: SuggestedTransactionType | null;
}): ImportedApprovalPlan | null {
  const absoluteAmount = Math.abs(input.amount);
  const facingType = input.selectedType ?? input.classification.suggestedType;

  if (input.context === "credit_card") {
    const kind = input.classification.kind;
    if (kind === "financial_charge" || kind === "previous_balance") {
      return {
        type: "credit_card_purchase",
        amount: -absoluteAmount,
        movementType: kind,
        isInvoiceMovement: true,
        requiresFinancialAccount: false,
        requiresDestinationAccount: false,
        requiresCreditCard: true,
        affectsIncomeExpense: true,
      };
    }
    if (isInvoiceCreditMovement(kind)) {
      return {
        type: "transfer",
        amount: -absoluteAmount,
        movementType: kind,
        isInvoiceMovement: true,
        requiresFinancialAccount: kind === "credit_card_payment",
        requiresDestinationAccount: false,
        requiresCreditCard: true,
        affectsIncomeExpense: false,
      };
    }
    if (!facingType) return null;
    if (facingType === "expense") {
      return {
        type: "credit_card_purchase",
        amount: -absoluteAmount,
        movementType: null,
        isInvoiceMovement: true,
        requiresFinancialAccount: false,
        requiresDestinationAccount: false,
        requiresCreditCard: true,
        affectsIncomeExpense: true,
      };
    }
  }

  if (!facingType) return null;
  return {
    type: facingType,
    amount: facingType === "income" ? absoluteAmount : -absoluteAmount,
    movementType: null,
    isInvoiceMovement: false,
    requiresFinancialAccount: true,
    requiresDestinationAccount: facingType === "transfer",
    requiresCreditCard: false,
    affectsIncomeExpense: facingType !== "transfer",
  };
}

export function readImportedLineSelection(
  metadata: Record<string, unknown> | null | undefined,
): ImportedLineSelection {
  const meta = metadata ?? {};
  const rawType =
    typeof meta.user_selected_type === "string"
      ? meta.user_selected_type
      : typeof meta.selected_type === "string"
        ? meta.selected_type
        : null;
  const normalizedType = rawType === "credit_card_purchase" ? "expense" : rawType;
  const selectedType =
    normalizedType === "income" || normalizedType === "expense" || normalizedType === "transfer"
      ? normalizedType
      : null;
  const destinationAccountId =
    typeof meta.destination_account_id === "string" && meta.destination_account_id
      ? meta.destination_account_id
      : null;
  return { selectedType, destinationAccountId };
}

export function validateImportedLineForApproval(input: {
  date: string | null;
  amount: number | null;
  description: string | null;
  context: ImportContext;
  selectedType: SuggestedTransactionType | null;
  financialAccountId: string | null;
  creditCardId: string | null;
  creditCardInvoiceId?: string | null;
  canResolveInvoice?: boolean;
  destinationAccountId: string | null;
}): string | null {
  if (!input.date || input.amount == null || !Number.isFinite(input.amount)) {
    return "Preencha data e valor antes de aprovar.";
  }
  const classification = classifyImportedTransaction({
    description: input.description,
    amount: input.amount,
    context: input.context,
  });
  const plan = deriveImportedApprovalPlan({
    classification,
    context: input.context,
    amount: input.amount,
    selectedType: input.selectedType,
  });
  if (!plan) return "Escolha o tipo de lançamento antes de aprovar.";
  if (plan.requiresCreditCard && !input.creditCardId) {
    return plan.type === "credit_card_purchase"
      ? "Compras no cartão precisam estar vinculadas a um cartão."
      : "Movimentos da fatura precisam estar vinculados a um cartão.";
  }
  if (plan.isInvoiceMovement && !input.creditCardInvoiceId && !input.canResolveInvoice) {
    return "Selecione ou resolva a fatura de destino antes de aprovar.";
  }
  if (plan.requiresFinancialAccount && !input.financialAccountId) {
    if (plan.movementType === "credit_card_payment") {
      return "Para registrar o pagamento da fatura, selecione a conta de onde saiu o dinheiro.";
    }
    if (plan.type === "transfer") {
      return "Para transferências, selecione a conta de origem e a conta de destino.";
    }
    return `${plan.type === "income" ? "Receita" : "Despesa"} precisa de uma conta financeira.`;
  }
  if (plan.requiresDestinationAccount && !input.destinationAccountId) {
    return "Para transferências, selecione a conta de origem e a conta de destino.";
  }
  if (plan.requiresDestinationAccount && input.financialAccountId === input.destinationAccountId) {
    return "A conta de origem e destino precisam ser diferentes.";
  }
  return null;
}

const CATEGORY_RULES: ReadonlyArray<{ keywords: readonly string[]; name: string }> = [
  {
    name: "Alimentação",
    keywords: [
      "ifood",
      "uber eats",
      "restaurante",
      "mercado",
      "supermercado",
      "padaria",
      "lanchonete",
      "delivery",
      "rappi",
    ],
  },
  {
    name: "Transporte",
    keywords: ["uber", "99app", "99 ", "combustivel", "posto", "estacionamento", "gasolina"],
  },
  {
    name: "Assinaturas",
    keywords: ["netflix", "spotify", "assinatura", "prime", "apple", "youtube", "hbo", "disney"],
  },
  {
    name: "Saúde",
    keywords: ["farmacia", "drogaria", "medico", "academia", "laboratorio", "hospital"],
  },
  {
    name: "Compras",
    keywords: ["amazon", "shopping", "loja", "magazine", "magalu", "mercadolivre", "shopee"],
  },
  {
    name: "Educação",
    keywords: ["escola", "curso", "faculdade", "livro", "livraria", "udemy", "alura"],
  },
  {
    name: "Viagens",
    keywords: [
      "hotel",
      "passagem",
      "airbnb",
      "latam",
      "gol linhas",
      "azul viagens",
      "booking",
      "decolar",
    ],
  },
  {
    name: "Receita",
    keywords: [
      "salario",
      "pix recebido",
      "transferencia recebida",
      "credito recebido",
      "rendimento",
    ],
  },
  {
    name: "Encargos financeiros",
    keywords: [...FINANCIAL_CHARGE_TERMS, ...PREVIOUS_BALANCE_TERMS, "atraso"],
  },
  {
    name: "Impostos",
    keywords: ["imposto", "darf", "iptu", "ipva", "receita federal"],
  },
];

export function suggestCategoryName(description: string): string | null {
  const normalized = normalizeTransactionDescription(description);
  for (const rule of CATEGORY_RULES) {
    if (includesAny(normalized, rule.keywords)) return rule.name;
  }
  return null;
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

export type InvoiceBalance = Pick<
  InvoiceAmounts,
  "totalAmount" | "paidAmount" | "pendingAmount" | "excessCredit"
>;

export function deriveInvoiceBalance(input: {
  totalAmount: number;
  paidAmount: number;
}): InvoiceBalance {
  const totalAmount = roundCurrency(Math.max(Number(input.totalAmount) || 0, 0));
  const paidAmount = roundCurrency(Math.max(Number(input.paidAmount) || 0, 0));
  return {
    totalAmount,
    paidAmount,
    pendingAmount: roundCurrency(Math.max(totalAmount - paidAmount, 0)),
    excessCredit: roundCurrency(Math.max(paidAmount - totalAmount, 0)),
  };
}

export function classifyPersistedInvoiceTransaction(input: {
  type: string;
  metadata?: Record<string, unknown> | null;
}): ImportedTransactionKind | null {
  const movementType = input.metadata?.movement_type;
  if (input.type === "credit_card_purchase") {
    if (movementType === "financial_charge" || movementType === "previous_balance") {
      return movementType;
    }
    return "standard";
  }
  if (input.type !== "transfer") return null;
  if (
    movementType === "credit_card_payment" ||
    movementType === "invoice_credit" ||
    movementType === "refund" ||
    movementType === "cashback"
  ) {
    return movementType;
  }
  if (input.metadata?.invoice_payment === true) return "credit_card_payment";
  return null;
}

export type InvoiceAnalysisBucket = "purchase" | "financial_charge" | "previous_balance";

export function classifyInvoiceAnalysisBucket(input: {
  type: string;
  metadata?: Record<string, unknown> | null;
}): InvoiceAnalysisBucket | null {
  if (input.type !== "credit_card_purchase") return null;
  if (input.metadata?.movement_type === "financial_charge") return "financial_charge";
  if (input.metadata?.movement_type === "previous_balance") return "previous_balance";
  return "purchase";
}

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
  const totalAmount = charges;
  const paidAmount = roundCurrency(payments + credits);
  const { pendingAmount, excessCredit } = deriveInvoiceBalance({
    totalAmount,
    paidAmount,
  });

  return { charges, credits, totalAmount, paidAmount, pendingAmount, excessCredit };
}

export type InvoiceStatus = "open" | "closed" | "paid" | "overdue";

export function deriveInvoiceStatus(input: {
  amounts: Pick<InvoiceAmounts, "totalAmount" | "pendingAmount" | "excessCredit">;
  closingDate: string;
  dueDate: string;
  today: string;
}): InvoiceStatus {
  if (input.amounts.totalAmount > 0 && input.amounts.pendingAmount <= 0) return "paid";
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
        used +
        deriveInvoiceBalance({
          totalAmount: invoice.totalAmount,
          paidAmount: invoice.paidAmount ?? 0,
        }).pendingAmount,
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
