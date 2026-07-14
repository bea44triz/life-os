import { supabase } from "./supabase";
import type { CreditCard } from "./finance-api";
import {
  getOrCreateInvoice,
  getOrCreateInvoiceByDueDate,
  recalcInvoiceTotal,
} from "./credit-cards";
import {
  parseCSV,
  parseTXT,
  parseXLSX,
  parseOFX,
  detectFileType,
  suggestCategoryName,
  type ParsedLine,
} from "./import-parsers";
import {
  applyHistoricalSuggestionToImportedLine,
  buildClassificationSignature,
  classifyImportedTransaction,
  deriveImportedApprovalPlan,
  findHistoricalSuggestion,
  readImportedLineSelection,
  type ClassificationSignature,
  type ImportedTransactionKind,
  type InvoiceMovementType,
  type PersistedTransactionType,
  type SuggestedTransactionType,
} from "./finance-domain";

export type FileContext = "bank_account" | "credit_card";
export type FileType = "txt" | "csv" | "pdf" | "ofx" | "xlsx";
export type ImportedFileStatus =
  | "uploaded"
  | "processing"
  | "processed"
  | "failed"
  | "approved";

type ImportStage =
  | "file_received"
  | "type_detection"
  | "storage_upload"
  | "storage_upload_completed"
  | "imported_files_insert"
  | "imported_files_insert_completed"
  | "parser_csv"
  | "parser_txt"
  | "parser_xlsx"
  | "parser_ofx"
  | "parser_pdf"
  | "lines_extracted"
  | "imported_lines_insert"
  | "imported_lines_insert_completed"
  | "transactions_insert"
  | "line_status_update"
  | "file_counters_update";

class StageImportError extends Error {
  constructor(
    public readonly stage: ImportStage,
    public readonly originalError: unknown,
  ) {
    super(`Erro na etapa: ${stage}. Detalhe: ${errorMessage(originalError)}`);
    this.name = "StageImportError";
  }
}

export type ImportedFile = {
  id: string;
  user_id: string;
  file_name: string;
  file_type: FileType;
  file_context: FileContext;
  storage_path: string;
  financial_account_id: string | null;
  credit_card_id: string | null;
  status: ImportedFileStatus | string;
  total_lines: number | null;
  processed_lines: number | null;
  approved_lines: number | null;
  error_message?: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type ReviewStatus = "pending" | "approved" | "rejected";

export type ImportedTransactionLine = {
  id: string;
  user_id: string;
  imported_file_id: string;
  raw_text: string | null;
  extracted_date: string | null;
  extracted_description: string | null;
  extracted_amount: number | null;
  suggested_category_id: string | null;
  suggested_subcategory_id: string | null;
  selected_category_id: string | null;
  selected_subcategory_id: string | null;
  selected_project_id: string | null;
  selected_financial_account_id: string | null;
  selected_credit_card_id: string | null;
  selected_credit_card_invoice_id: string | null;
  review_status: ReviewStatus | string;
  generated_transaction_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export const IMPORTS_BUCKET = "life-os-imports";
const approvalsInFlight = new Set<string>();

export type StartImportInput = {
  file: File;
  fileContext: FileContext;
  financialAccountId?: string | null;
  creditCardId?: string | null;
  defaultCategoryId?: string | null;
  defaultProjectId?: string | null;
  invoiceDueDate?: string | null; // YYYY-MM-DD — for credit_card imports
};

export type StartImportResult = {
  fileId: string;
  lineCount: number;
  fileType: FileType;
  detectionWarning?: string;
  status: ImportedFileStatus;
  errorMessage?: string;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: unknown }).message ?? error);
  }
  return String(error);
}

function createStageError(stage: ImportStage, error: unknown): Error {
  if (error instanceof StageImportError) return error;
  console.error("IMPORT_ERROR_STAGE", stage, error);
  return new StageImportError(stage, error);
}

function logStage(stage: ImportStage, detail?: Record<string, unknown>) {
  const labels: Partial<Record<ImportStage, string>> = {
    file_received: "etapa 1: arquivo recebido",
    type_detection: "etapa 2: tipo detectado",
    storage_upload: "etapa 3: upload no storage iniciado",
    storage_upload_completed: "etapa 4: upload no storage concluído",
    imported_files_insert: "etapa 5: insert em imported_files iniciado",
    imported_files_insert_completed: "etapa 6: insert em imported_files concluído",
    parser_csv: "etapa 7: parser CSV iniciado",
    parser_txt: "etapa 7: parser TXT iniciado",
    parser_xlsx: "etapa 7: parser XLSX iniciado",
    parser_ofx: "etapa 7: parser OFX iniciado",
    parser_pdf: "etapa 7: parser PDF iniciado",
    lines_extracted: "etapa 8: linhas extraídas",
    imported_lines_insert: "etapa 9: insert em imported_transaction_lines iniciado",
    imported_lines_insert_completed: "etapa 10: insert em imported_transaction_lines concluído",
  };
  console.info("IMPORT_STAGE", stage, labels[stage] ?? stage, detail ?? {});
}

function metadataWithError(
  base: Record<string, unknown>,
  stage: ImportStage,
  error: unknown,
) {
  return {
    ...base,
    error: errorMessage(error),
    error_stage: stage,
  };
}

function getCsvHeaderText(text: string) {
  return text.replace(/^\uFEFF/, "").split(/\r?\n/)[0] ?? "";
}

function getCsvDetectedColumns(text: string) {
  const firstLine = getCsvHeaderText(text);
  return firstLine
    .split(/[;,]/)
    .map((s) => s.trim().replace(/^"|"$/g, ""))
    .filter(Boolean)
    .join(", ");
}

async function findCategoryByName(
  userId: string,
  name: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("transaction_categories")
    .select("id")
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .ilike("name", name)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("Supabase error", error);
    return null;
  }
  return (data as { id: string } | null)?.id ?? null;
}

const IMPORTED_TRANSACTION_KINDS = new Set<ImportedTransactionKind>([
  "standard",
  "bank_transfer",
  "credit_card_payment",
  "invoice_credit",
  "refund",
  "cashback",
  "financial_charge",
  "previous_balance",
]);

const INVOICE_MOVEMENT_TYPES = new Set<InvoiceMovementType>([
  "credit_card_payment",
  "invoice_credit",
  "refund",
  "cashback",
  "financial_charge",
  "previous_balance",
]);

function readStoredClassificationSignature(
  metadata: Record<string, unknown> | null,
): ClassificationSignature | null {
  const value = metadata?.classification_signature;
  if (!value || typeof value !== "object") return null;
  const signature = value as Partial<ClassificationSignature>;
  if (
    typeof signature.description_normalized !== "string" ||
    (signature.file_context !== "bank_account" &&
      signature.file_context !== "credit_card") ||
    (signature.visual_type !== "income" &&
      signature.visual_type !== "expense" &&
      signature.visual_type !== "transfer") ||
    (signature.transaction_type !== "income" &&
      signature.transaction_type !== "expense" &&
      signature.transaction_type !== "transfer" &&
      signature.transaction_type !== "credit_card_purchase") ||
    typeof signature.description_original !== "string" ||
    !signature.classification_kind ||
    !IMPORTED_TRANSACTION_KINDS.has(signature.classification_kind) ||
    signature.suggestion_source !== "user_approved" ||
    typeof signature.approved_at !== "string"
  ) {
    return null;
  }
  return signature as ClassificationSignature;
}

export async function loadRecentClassificationHistory(
  userId: string,
  limit = 250,
): Promise<ClassificationSignature[]> {
  const { data: lines, error: linesError } = await supabase
    .from("imported_transaction_lines")
    .select(
      "imported_file_id, extracted_description, extracted_amount, selected_category_id, selected_subcategory_id, selected_project_id, selected_financial_account_id, selected_credit_card_id, selected_credit_card_invoice_id, generated_transaction_id, metadata, updated_at",
    )
    .eq("user_id", userId)
    .eq("review_status", "approved")
    .not("generated_transaction_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (linesError) throw linesError;

  const approvedLines = (lines ?? []) as Array<{
    imported_file_id: string;
    extracted_description: string | null;
    extracted_amount: number | null;
    selected_category_id: string | null;
    selected_subcategory_id: string | null;
    selected_project_id: string | null;
    selected_financial_account_id: string | null;
    selected_credit_card_id: string | null;
    selected_credit_card_invoice_id: string | null;
    generated_transaction_id: string;
    metadata: Record<string, unknown> | null;
    updated_at: string;
  }>;
  const stored = approvedLines
    .map((line) => readStoredClassificationSignature(line.metadata))
    .filter((signature): signature is ClassificationSignature => signature !== null);

  const missing = approvedLines.filter(
    (line) => !readStoredClassificationSignature(line.metadata),
  );
  if (missing.length === 0) return stored;

  const transactionIds = [...new Set(missing.map((line) => line.generated_transaction_id))];
  const fileIds = [...new Set(missing.map((line) => line.imported_file_id))];
  const [{ data: transactions, error: transactionsError }, { data: files, error: filesError }] =
    await Promise.all([
      supabase
        .from("transactions")
        .select(
          "id, type, category_id, subcategory_id, project_id, financial_account_id, credit_card_id, credit_card_invoice_id, metadata",
        )
        .eq("user_id", userId)
        .in("id", transactionIds),
      supabase
        .from("imported_files")
        .select("id, file_context, financial_account_id, credit_card_id")
        .eq("user_id", userId)
        .in("id", fileIds),
    ]);
  if (transactionsError) throw transactionsError;
  if (filesError) throw filesError;

  const txById = new Map(
    ((transactions ?? []) as Array<{
      id: string;
      type: PersistedTransactionType;
      category_id: string | null;
      subcategory_id: string | null;
      project_id: string | null;
      financial_account_id: string | null;
      credit_card_id: string | null;
      credit_card_invoice_id: string | null;
      metadata: Record<string, unknown> | null;
    }>).map((transaction) => [transaction.id, transaction]),
  );
  const fileById = new Map(
    ((files ?? []) as Array<{
      id: string;
      file_context: FileContext;
      financial_account_id: string | null;
      credit_card_id: string | null;
    }>).map((file) => [file.id, file]),
  );

  const derived = missing.flatMap((line) => {
    const transaction = txById.get(line.generated_transaction_id);
    const file = fileById.get(line.imported_file_id);
    if (!transaction || !file) return [];
    const rawMovement = transaction.metadata?.movement_type;
    const movementType =
      typeof rawMovement === "string" &&
      INVOICE_MOVEMENT_TYPES.has(rawMovement as InvoiceMovementType)
        ? (rawMovement as InvoiceMovementType)
        : null;
    const systemClassification = classifyImportedTransaction({
      description: line.extracted_description,
      amount: Number(line.extracted_amount ?? 0),
      context: file.file_context,
    });
    const classificationKind = movementType ?? systemClassification.kind;
    const visualType: SuggestedTransactionType =
      transaction.type === "credit_card_purchase"
        ? "expense"
        : transaction.type;
    const destinationAccountId =
      typeof transaction.metadata?.destination_account_id === "string"
        ? transaction.metadata.destination_account_id
        : null;
    return [
      buildClassificationSignature({
        description: line.extracted_description,
        context: file.file_context,
        visualType,
        transactionType: transaction.type,
        classificationKind,
        movementType,
        categoryId: transaction.category_id ?? line.selected_category_id,
        subcategoryId: transaction.subcategory_id ?? line.selected_subcategory_id,
        projectId: transaction.project_id ?? line.selected_project_id,
        financialAccountId:
          transaction.financial_account_id ??
          line.selected_financial_account_id ??
          file.financial_account_id,
        destinationAccountId,
        creditCardId:
          transaction.credit_card_id ?? line.selected_credit_card_id ?? file.credit_card_id,
        creditCardInvoiceId:
          transaction.credit_card_invoice_id ?? line.selected_credit_card_invoice_id,
        approvedAt: line.updated_at,
      }),
    ];
  });

  return [...stored, ...derived].sort((a, b) =>
    b.approved_at.localeCompare(a.approved_at),
  );
}

export async function startImport(
  userId: string,
  input: StartImportInput,
): Promise<StartImportResult> {
  let stage: ImportStage = "file_received";
  let fileType: FileType | null = null;
  let path = "";
  let baseMetadata: Record<string, unknown> = {
    default_category_id: input.defaultCategoryId ?? null,
    default_project_id: input.defaultProjectId ?? null,
    invoice_due_date:
      input.fileContext === "credit_card" ? input.invoiceDueDate ?? null : null,
  };

  try {
    logStage(stage, {
      name: input.file.name,
      size: input.file.size,
      type: input.file.type,
    });

    stage = "type_detection";
    const detection = await detectFileType(input.file);
    logStage(stage, detection);
    if (detection.type === "unknown") {
      throw new Error(
        "Formato não suportado. Envie CSV, TXT, OFX, XLSX ou PDF.",
      );
    }
    fileType = detection.type;
    baseMetadata = {
      ...baseMetadata,
      original_extension: detection.originalExtension,
      detected_file_type: detection.type,
      detection_warning: detection.warning ?? null,
    };

    const timestamp = Date.now();
    path = `${userId}/${timestamp}_${input.file.name}`;

    stage = "storage_upload";
    logStage(stage, { bucket: IMPORTS_BUCKET, path });
    const { error: upErr } = await supabase.storage
      .from(IMPORTS_BUCKET)
      .upload(path, input.file, {
        contentType: input.file.type || undefined,
        upsert: false,
      });
    if (upErr) {
      console.error("Supabase error", upErr);
      throw upErr;
    }

    stage = "storage_upload_completed";
    logStage(stage, { bucket: IMPORTS_BUCKET, path });

    stage = "imported_files_insert";
    logStage(stage, { status: "processing", total_lines: 0 });
    const { data: fileRow, error: fileErr } = await supabase
      .from("imported_files")
      .insert({
        user_id: userId,
        file_name: input.file.name,
        file_type: fileType,
        file_context: input.fileContext,
        storage_path: path,
        financial_account_id:
          input.fileContext === "bank_account" ? input.financialAccountId ?? null : null,
        credit_card_id:
          input.fileContext === "credit_card" ? input.creditCardId ?? null : null,
        status: "processing",
        total_lines: 0,
        processed_lines: 0,
        approved_lines: 0,
        error_message: null,
        metadata: baseMetadata,
      })
      .select("id")
      .single();
    if (fileErr) {
      console.error("Supabase error", fileErr);
      throw fileErr;
    }

    stage = "imported_files_insert_completed";
    const fileId = (fileRow as { id: string }).id;
    logStage(stage, { fileId });

    let parsed: ParsedLine[] = [];
    try {
      if (fileType === "csv") {
        stage = "parser_csv";
        logStage(stage);
        const text = await input.file.text();
        parsed = parseCSV(text);
        const detectedCols = getCsvDetectedColumns(text);
        if (parsed.length === 0) {
          throw new Error(
            `Não conseguimos ler este arquivo como CSV. Colunas detectadas: ${detectedCols || "nenhuma"}.`,
          );
        }
        const hasUsableLines = parsed.some(
          (p) => p.date != null && p.amount != null && p.description.trim().length > 0,
        );
        if (!hasUsableLines) {
          throw new Error(
            `Não encontramos as colunas esperadas. Detectamos: ${detectedCols || "nenhuma"}.`,
          );
        }
      } else if (fileType === "txt") {
        stage = "parser_txt";
        logStage(stage);
        const text = await input.file.text();
        parsed = parseTXT(text);
        if (parsed.length === 0) {
          throw new Error("Não encontramos linhas com data e valor neste arquivo TXT.");
        }
      } else if (fileType === "xlsx") {
        stage = "parser_xlsx";
        logStage(stage);
        parsed = await parseXLSX(input.file);
        if (parsed.length === 0) {
          throw new Error(
            "Este arquivo parece ser uma planilha, mas não encontramos linhas com data e valor.",
          );
        }
      } else if (fileType === "ofx") {
        stage = "parser_ofx";
        logStage(stage);
        parsed = await parseOFX(input.file);
        if (parsed.length === 0) {
          throw new Error(
            "Não encontramos transações neste arquivo OFX. Ele pode estar vazio ou usa uma estrutura não reconhecida.",
          );
        }
      } else {
        stage = "parser_pdf";
        logStage(stage, { message: "PDF salvo para extração futura." });
      }

      stage = "lines_extracted";
      logStage(stage, { count: parsed.length });
    } catch (error) {
      console.error("IMPORT_ERROR_STAGE", stage, error);
      const { error: updateError } = await supabase
        .from("imported_files")
        .update({
          status: "failed",
          total_lines: 0,
          processed_lines: 0,
          approved_lines: 0,
          error_message: errorMessage(error),
          metadata: metadataWithError(baseMetadata, stage, error),
        })
        .eq("id", fileId);
      if (updateError) {
        console.error("Supabase error", updateError);
        throw createStageError("file_counters_update", updateError);
      }
      throw createStageError(stage, error);
    }

    const status: ImportedFileStatus =
      fileType === "pdf" ? "uploaded" : parsed.length > 0 ? "processed" : "uploaded";

    const { error: statusUpdateError } = await supabase
      .from("imported_files")
      .update({
        status,
        total_lines: parsed.length,
        processed_lines: parsed.length,
        approved_lines: 0,
        error_message: null,
        metadata: baseMetadata,
      })
      .eq("id", fileId);
    if (statusUpdateError) {
      console.error("Supabase error", statusUpdateError);
      throw createStageError("file_counters_update", statusUpdateError);
    }

    if (parsed.length > 0) {
      const cache = new Map<string, string | null>();
      let history: ClassificationSignature[] = [];
      try {
        history = await loadRecentClassificationHistory(userId);
      } catch (historyError) {
        // History is an optional suggestion layer. A read failure must not block
        // the auditable import/review flow.
        console.warn("IMPORT_HISTORY_UNAVAILABLE", historyError);
      }
      const rows = [];
      for (const p of parsed) {
        const classification = classifyImportedTransaction({
          description: p.description,
          amount: Number(p.amount ?? 0),
          context: input.fileContext,
        });
        const historicalSuggestion = findHistoricalSuggestion(history, {
          description: p.description,
          amount: Number(p.amount ?? 0),
          context: input.fileContext,
          financialAccountId:
            input.fileContext === "bank_account" ? input.financialAccountId : null,
          creditCardId: input.fileContext === "credit_card" ? input.creditCardId : null,
        });
        let suggestedId: string | null = null;
        const suggestName = historicalSuggestion
          ? null
          : suggestCategoryName(p.description ?? "");
        if (!historicalSuggestion && suggestName) {
          if (!cache.has(suggestName)) {
            cache.set(suggestName, await findCategoryByName(userId, suggestName));
          }
          suggestedId = cache.get(suggestName) ?? null;
        }
        const fallbackSuggestionSource =
          classification.requiresReview
            ? "needs_review"
            : classification.kind !== "standard" || !!suggestName
              ? "system_keyword"
              : "amount_signal";
        const row = {
          user_id: userId,
          imported_file_id: fileId,
          raw_text: p.raw,
          extracted_date: p.date,
          extracted_description: p.description,
          extracted_amount: p.amount,
          suggested_category_id: suggestedId,
          selected_category_id: suggestedId ?? input.defaultCategoryId ?? null,
          selected_project_id: input.defaultProjectId ?? null,
          selected_financial_account_id:
            input.fileContext === "bank_account" ? input.financialAccountId ?? null : null,
          selected_credit_card_id:
            input.fileContext === "credit_card" ? input.creditCardId ?? null : null,
          review_status: "pending",
          metadata: {
            ...(p.meta ?? {}),
            classification_kind: classification.kind,
            suggestion_source: fallbackSuggestionSource,
            requires_review: classification.requiresReview,
          },
        };
        rows.push(
          historicalSuggestion
            ? applyHistoricalSuggestionToImportedLine(row, historicalSuggestion)
            : row,
        );
      }

      stage = "imported_lines_insert";
      logStage(stage, { count: rows.length });
      const { error: linesErr } = await supabase
        .from("imported_transaction_lines")
        .insert(rows);
      if (linesErr) {
        console.error("Supabase error", linesErr);
        const { error: markFailedError } = await supabase
          .from("imported_files")
          .update({
            status: "failed",
            error_message: errorMessage(linesErr),
            metadata: metadataWithError(baseMetadata, stage, linesErr),
          })
          .eq("id", fileId);
        if (markFailedError) {
          console.error("Supabase error", markFailedError);
        }
        throw linesErr;
      }

      stage = "imported_lines_insert_completed";
      logStage(stage, { count: rows.length });
    }

    return {
      fileId,
      lineCount: parsed.length,
      fileType,
      detectionWarning: detection.warning,
      status,
    };
  } catch (error) {
    throw createStageError(stage, error);
  }
}

export async function listImportedFiles(userId: string): Promise<ImportedFile[]> {
  const { data, error } = await supabase
    .from("imported_files")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Supabase error", error);
    throw error;
  }
  return (data ?? []) as ImportedFile[];
}

export async function getImportedFile(fileId: string): Promise<ImportedFile> {
  const { data, error } = await supabase
    .from("imported_files")
    .select("*")
    .eq("id", fileId)
    .single();
  if (error) {
    console.error("Supabase error", error);
    throw error;
  }
  return data as ImportedFile;
}

export async function listImportedLines(
  fileId: string,
): Promise<ImportedTransactionLine[]> {
  const { data, error } = await supabase
    .from("imported_transaction_lines")
    .select("*")
    .eq("imported_file_id", fileId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Supabase error", error);
    throw error;
  }
  return (data ?? []) as ImportedTransactionLine[];
}

export async function updateImportedLine(
  id: string,
  patch: Partial<ImportedTransactionLine>,
) {
  const { error } = await supabase
    .from("imported_transaction_lines")
    .update(patch)
    .eq("id", id);
  if (error) {
    console.error("Supabase error", error);
    throw error;
  }
}

async function refreshFileCounters(fileId: string) {
  const { data: lines, error: linesError } = await supabase
    .from("imported_transaction_lines")
    .select("review_status")
    .eq("imported_file_id", fileId);
  if (linesError) {
    console.error("Supabase error", linesError);
    throw createStageError("file_counters_update", linesError);
  }
  const total = lines?.length ?? 0;
  const approved = (lines ?? []).filter(
    (l) => (l as { review_status: string }).review_status === "approved",
  ).length;
  const pending = (lines ?? []).filter(
    (l) => (l as { review_status: string }).review_status === "pending",
  ).length;
  const status: ImportedFileStatus = pending === 0 && approved > 0 ? "approved" : "processed";
  const { error } = await supabase
    .from("imported_files")
    .update({
      approved_lines: approved,
      processed_lines: total,
      total_lines: total,
      status,
    })
    .eq("id", fileId);
  if (error) {
    console.error("Supabase error", error);
    throw createStageError("file_counters_update", error);
  }
}

export async function approveLine(
  userId: string,
  line: ImportedTransactionLine,
  file: ImportedFile,
): Promise<void> {
  if (approvalsInFlight.has(line.id)) {
    throw new Error("Esta linha já está sendo aprovada. Aguarde a conclusão.");
  }
  approvalsInFlight.add(line.id);
  try {
    await approveLineUnlocked(userId, line, file);
  } finally {
    approvalsInFlight.delete(line.id);
  }
}

async function approveLineUnlocked(
  userId: string,
  line: ImportedTransactionLine,
  file: ImportedFile,
): Promise<void> {
  if (line.generated_transaction_id) {
    throw new Error("Esta linha já foi aprovada e possui uma transação vinculada.");
  }
  const { data: persistedLine, error: persistedLineError } = await supabase
    .from("imported_transaction_lines")
    .select("review_status, generated_transaction_id")
    .eq("id", line.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (persistedLineError) {
    console.error("Supabase error", persistedLineError);
    throw persistedLineError;
  }
  if (!persistedLine) throw new Error("Linha importada não encontrada.");
  const persisted = persistedLine as {
    review_status: string;
    generated_transaction_id: string | null;
  };
  if (persisted.generated_transaction_id || persisted.review_status === "approved") {
    throw new Error("Esta linha já foi aprovada.");
  }
  if (persisted.review_status !== "pending") {
    throw new Error("Somente linhas pendentes podem ser aprovadas.");
  }

  if (!line.extracted_date || line.extracted_amount == null) {
    throw new Error("Data e valor são obrigatórios para aprovar.");
  }
  const amount = Number(line.extracted_amount);
  if (!Number.isFinite(amount)) {
    throw new Error("Valor inválido para aprovar.");
  }
  const description = line.extracted_description ?? "Importado";
  const originMap: Record<FileType, string> = {
    csv: "import_csv",
    txt: "import_txt",
    pdf: "import_pdf",
    ofx: "import_ofx",
    xlsx: "import_xlsx",
  };
  const origin = originMap[file.file_type as FileType] ?? "import_csv";

  const { selectedType: userType, destinationAccountId } =
    readImportedLineSelection(line.metadata);
  const systemClassification = classifyImportedTransaction({
    description: line.extracted_description,
    amount,
    context: file.file_context,
  });
  const learnedKind = line.metadata?.classification_kind;
  const classification =
    line.metadata?.suggestion_source === "user_history" &&
    typeof learnedKind === "string" &&
    IMPORTED_TRANSACTION_KINDS.has(learnedKind as ImportedTransactionKind)
      ? {
          kind: learnedKind as ImportedTransactionKind,
          suggestedType: userType ?? systemClassification.suggestedType,
          requiresReview: false,
        }
      : systemClassification;

  const plan = deriveImportedApprovalPlan({
    classification,
    context: file.file_context,
    amount,
    selectedType: userType,
  });
  if (!plan) {
    throw new Error(
      "Escolha o tipo de lançamento antes de aprovar. Este lançamento parece ser um pagamento ou crédito na fatura.",
    );
  }
  const type = plan.type;

  let invoiceId: string | null = null;
  let cardId: string | null = null;
  let accountId: string | null = null;
  const finalAmount = plan.amount;
  let txMetadata: Record<string, unknown> | null = null;

  // Read invoice_due_date from the imported file's metadata (set on upload).
  const fileMeta = (file.metadata ?? {}) as Record<string, unknown>;
  const invoiceDueDate =
    typeof fileMeta.invoice_due_date === "string" && fileMeta.invoice_due_date
      ? (fileMeta.invoice_due_date as string)
      : null;

  async function resolveInvoice(card: CreditCard): Promise<string> {
    if (line.selected_credit_card_invoice_id) {
      const { data: selectedInvoice, error: selectedInvoiceError } = await supabase
        .from("credit_card_invoices")
        .select("id")
        .eq("id", line.selected_credit_card_invoice_id)
        .eq("user_id", userId)
        .eq("credit_card_id", card.id)
        .maybeSingle();
      if (selectedInvoiceError) throw selectedInvoiceError;
      if (!selectedInvoice) {
        throw new Error("A fatura selecionada não pertence ao cartão desta linha.");
      }
      return (selectedInvoice as { id: string }).id;
    }
    if (invoiceDueDate) {
      const inv = await getOrCreateInvoiceByDueDate(userId, card, invoiceDueDate);
      return inv.id;
    }
    const inv = await getOrCreateInvoice(userId, card, line.extracted_date!);
    return inv.id;
  }

  if (plan.isInvoiceMovement) {
    cardId = line.selected_credit_card_id ?? file.credit_card_id;
    if (!cardId) {
      throw new Error("Movimentos da fatura precisam estar vinculados a um cartão.");
    }
    const { data: card, error: cardErr } = await supabase
      .from("credit_cards")
      .select("*")
      .eq("id", cardId)
      .single();
    if (cardErr) {
      console.error("Supabase error", cardErr);
      throw cardErr;
    }
    invoiceId = await resolveInvoice(card as CreditCard);
    if (type === "transfer") {
      if (plan.requiresFinancialAccount) {
        accountId = line.selected_financial_account_id ?? file.financial_account_id;
        if (!accountId) {
          throw new Error(
            "Para registrar o pagamento da fatura, selecione a conta de onde saiu o dinheiro.",
          );
        }
      }
      txMetadata = {
        movement_type: plan.movementType,
        credit_card_id: cardId,
        invoice_id: invoiceId,
        invoice_payment: plan.movementType === "credit_card_payment",
        affects_income_expense: false,
        source: "credit_card_statement",
      };
    } else if (plan.movementType) {
      txMetadata = {
        movement_type: plan.movementType,
        source: "credit_card_statement",
      };
    }
  } else if (type === "transfer") {
    accountId = line.selected_financial_account_id ?? file.financial_account_id;
    if (!accountId || !destinationAccountId) {
      throw new Error(
        "Para transferências, selecione a conta de origem e a conta de destino.",
      );
    }
    if (accountId === destinationAccountId) {
      throw new Error("A conta de origem e destino precisam ser diferentes.");
    }
    txMetadata = {
      destination_account_id: destinationAccountId,
      transfer_direction: "between_accounts",
      affects_income_expense: false,
    };
  } else if (type === "income") {
    accountId = line.selected_financial_account_id ?? file.financial_account_id;
    if (!accountId) {
      throw new Error("Receitas precisam de uma conta financeira.");
    }
  } else {
    accountId = line.selected_financial_account_id ?? file.financial_account_id;
    if (!accountId) {
      throw new Error("Despesas precisam de uma conta financeira.");
    }
  }

  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      type,
      description,
      amount: finalAmount,
      transaction_date: line.extracted_date,
      competence_date: line.extracted_date,
      category_id: line.selected_category_id ?? null,
      subcategory_id: line.selected_subcategory_id ?? null,
      financial_account_id: accountId,
      credit_card_id: cardId,
      credit_card_invoice_id: invoiceId,
      project_id: line.selected_project_id ?? null,
      origin,
      review_status: "approved",
      metadata: txMetadata,
    })
    .select("id")
    .single();
  if (txErr) {
    console.error("Supabase error", txErr);
    throw createStageError("transactions_insert", txErr);
  }

  const finalVisualType: SuggestedTransactionType =
    userType ?? (type === "credit_card_purchase" ? "expense" : type);
  const classificationSignature = buildClassificationSignature({
    description: line.extracted_description,
    context: file.file_context,
    visualType: finalVisualType,
    transactionType: type,
    classificationKind: classification.kind,
    movementType: plan.movementType,
    categoryId: line.selected_category_id,
    subcategoryId: line.selected_subcategory_id,
    projectId: line.selected_project_id,
    financialAccountId: accountId,
    destinationAccountId,
    creditCardId: cardId,
    creditCardInvoiceId: invoiceId,
  });

  async function rollbackInsertedTransaction() {
    const { error: rollbackError } = await supabase
      .from("transactions")
      .delete()
      .eq("id", (tx as { id: string }).id);
    if (rollbackError) console.error("Failed to rollback imported transaction", rollbackError);
  }

  const { data: updatedLine, error: lineErr } = await supabase
    .from("imported_transaction_lines")
    .update({
      review_status: "approved",
      generated_transaction_id: (tx as { id: string }).id,
      metadata: {
        ...(line.metadata ?? {}),
        classification_signature: classificationSignature,
      },
    })
    .eq("id", line.id)
    .eq("user_id", userId)
    .eq("review_status", "pending")
    .is("generated_transaction_id", null)
    .select("id")
    .maybeSingle();
  if (lineErr) {
    console.error("Supabase error", lineErr);
    await rollbackInsertedTransaction();
    throw createStageError("line_status_update", lineErr);
  }
  if (!updatedLine) {
    await rollbackInsertedTransaction();
    throw new Error("Esta linha já foi aprovada em outra operação.");
  }

  if (invoiceId) await recalcInvoiceTotal(invoiceId);
  await refreshFileCounters(file.id);
}

export async function rejectLine(line: ImportedTransactionLine, file: ImportedFile) {
  const { error } = await supabase
    .from("imported_transaction_lines")
    .update({ review_status: "rejected" })
    .eq("id", line.id);
  if (error) {
    console.error("Supabase error", error);
    throw createStageError("line_status_update", error);
  }
  await refreshFileCounters(file.id);
}

export async function undoLineStatus(line: ImportedTransactionLine, file: ImportedFile) {
  if (line.generated_transaction_id) {
    const { data: tx, error: txReadError } = await supabase
      .from("transactions")
      .select("credit_card_invoice_id")
      .eq("id", line.generated_transaction_id)
      .maybeSingle();
    if (txReadError) {
      console.error("Supabase error", txReadError);
      throw txReadError;
    }
    const invoiceId =
      (tx as { credit_card_invoice_id: string | null } | null)?.credit_card_invoice_id ??
      null;
    const { error: deleteError } = await supabase
      .from("transactions")
      .delete()
      .eq("id", line.generated_transaction_id);
    if (deleteError) {
      console.error("Supabase error", deleteError);
      throw createStageError("transactions_insert", deleteError);
    }
    if (invoiceId) await recalcInvoiceTotal(invoiceId);
  }
  const { error } = await supabase
    .from("imported_transaction_lines")
    .update({ review_status: "pending", generated_transaction_id: null })
    .eq("id", line.id);
  if (error) {
    console.error("Supabase error", error);
    throw createStageError("line_status_update", error);
  }
  await refreshFileCounters(file.id);
}
