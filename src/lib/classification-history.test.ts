import assert from "node:assert/strict";
import test from "node:test";
import {
  applyHistoricalSuggestionToImportedLine,
  buildClassificationSignature,
  classifyImportedTransaction,
  deriveImportedApprovalPlan,
  findHistoricalSuggestion,
  normalizeTransactionDescription,
  type ClassificationSignature,
} from "./finance-domain.ts";

const approvedAt = "2026-07-14T12:00:00.000Z";

function signature(
  patch: Partial<Parameters<typeof buildClassificationSignature>[0]> = {},
): ClassificationSignature {
  return buildClassificationSignature({
    description: "Pg *Odontomedica Vila",
    context: "bank_account",
    visualType: "expense",
    transactionType: "expense",
    classificationKind: "standard",
    categoryId: "category-health",
    subcategoryId: "subcategory-dentist",
    projectId: "project-care",
    financialAccountId: "account-1",
    approvedAt,
    ...patch,
  });
}

function pendingLine() {
  return {
    review_status: "pending",
    selected_category_id: null,
    selected_subcategory_id: null,
    selected_project_id: null,
    selected_financial_account_id: "account-1",
    selected_credit_card_id: null,
    selected_credit_card_invoice_id: null,
    metadata: { fitid: "ofx-1" } as Record<string, unknown>,
  };
}

test("normalizes equivalent merchant descriptions for history", () => {
  const variants = ["Pg *Odontomedica Vila", "PG ODONTOMEDICA VILA", "Pg Odontomedica Vila"];
  assert.deepEqual(
    variants.map(normalizeTransactionDescription),
    Array(3).fill("pg odontomedica vila"),
  );
});

test("finds an exact approved history suggestion in the same account", () => {
  const learned = signature();
  assert.equal(
    findHistoricalSuggestion([learned], {
      description: "PG ODONTOMEDICA VILA",
      context: "bank_account",
      amount: -180,
      financialAccountId: "account-1",
    }),
    learned,
  );
});

test("does not apply plain generic history automatically", () => {
  const learned = signature({
    description: "PAGAMENTO",
    categoryId: "category-bills",
  });
  assert.equal(
    findHistoricalSuggestion([learned], {
      description: "pagamento",
      context: "bank_account",
      amount: -90,
      financialAccountId: "account-1",
    }),
    null,
  );
});

test("reapplies the learned category, subcategory and project", () => {
  const line = applyHistoricalSuggestionToImportedLine(pendingLine(), signature());
  assert.equal(line.selected_category_id, "category-health");
  assert.equal(line.selected_subcategory_id, "subcategory-dentist");
  assert.equal(line.selected_project_id, "project-care");
});

test("reapplies the learned movement type with high confidence", () => {
  const learned = signature({
    description: "Cashback da campanha",
    context: "credit_card",
    visualType: "transfer",
    transactionType: "transfer",
    classificationKind: "cashback",
    movementType: "cashback",
    financialAccountId: null,
    creditCardId: "card-1",
  });
  const line = applyHistoricalSuggestionToImportedLine(
    { ...pendingLine(), selected_financial_account_id: null, selected_credit_card_id: "card-1" },
    learned,
  );
  assert.equal(line.metadata?.movement_type, "cashback");
  assert.equal(line.metadata?.confidence, "high");
  assert.equal(line.metadata?.suggestion_source, "user_history");
});

test("historical suggestions always keep the imported line pending", () => {
  const line = applyHistoricalSuggestionToImportedLine(
    { ...pendingLine(), review_status: "approved" },
    signature(),
  );
  assert.equal(line.review_status, "pending");
});

test("learns a recurring card purchase without reusing the old invoice", () => {
  const learned = signature({
    description: "Spotify Premium",
    context: "credit_card",
    visualType: "expense",
    transactionType: "credit_card_purchase",
    financialAccountId: null,
    creditCardId: "card-1",
    creditCardInvoiceId: "old-invoice",
  });
  const found = findHistoricalSuggestion([learned], {
    description: "SPOTIFY PREMIUM",
    context: "credit_card",
    amount: 21.9,
    creditCardId: "card-1",
  });
  assert.ok(found);
  const line = applyHistoricalSuggestionToImportedLine(
    { ...pendingLine(), selected_financial_account_id: null, selected_credit_card_id: "card-1" },
    found,
  );
  assert.equal(line.metadata?.selected_type, "expense");
  assert.equal(line.metadata?.suggested_transaction_type, "credit_card_purchase");
  assert.equal(line.selected_credit_card_invoice_id, null);
});

test("learned card payment remains a transfer and never becomes income", () => {
  const learned = signature({
    description: "Pagamento recebido",
    context: "credit_card",
    visualType: "transfer",
    transactionType: "transfer",
    classificationKind: "credit_card_payment",
    movementType: "credit_card_payment",
    creditCardId: "card-1",
  });
  const line = applyHistoricalSuggestionToImportedLine(
    { ...pendingLine(), selected_credit_card_id: "card-1" },
    learned,
  );
  const plan = deriveImportedApprovalPlan({
    classification: {
      ...classifyImportedTransaction({
        description: "Pagamento recebido",
        amount: -500,
        context: "credit_card",
      }),
      kind: line.metadata?.classification_kind as "credit_card_payment",
    },
    context: "credit_card",
    amount: -500,
    selectedType: line.metadata?.selected_type as "transfer",
  });
  assert.equal(plan?.type, "transfer");
  assert.equal(plan?.movementType, "credit_card_payment");
});

test("learns a recurring bank expense in the same account", () => {
  const learned = signature({ description: "Condominio Residencial" });
  const found = findHistoricalSuggestion([learned], {
    description: "CONDOMÍNIO RESIDENCIAL",
    context: "bank_account",
    amount: -650,
    financialAccountId: "account-1",
  });
  assert.ok(found);
  const line = applyHistoricalSuggestionToImportedLine(pendingLine(), found);
  assert.equal(line.metadata?.selected_type, "expense");
  assert.equal(line.selected_financial_account_id, "account-1");
});
