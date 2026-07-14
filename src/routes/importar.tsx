import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  FileText,
  Loader2,
  Pencil,
  RotateCcw,
  Undo2,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader, Section, brl } from "@/components/ui-bits";
import {
  useAccounts,
  useCategories,
  useCreditCards,
  useInvoices,
  useProjects,
} from "@/lib/finance-hooks";
import {
  useApproveLine,
  useImportedFile,
  useImportedFiles,
  useImportedLines,
  useRejectLine,
  useStartImport,
  useUndoLine,
  useUpdateImportedLine,
} from "@/lib/imports-hooks";
import type {
  FileContext,
  ImportedFile,
  ImportedTransactionLine,
} from "@/lib/imports-api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  classifyImportedTransaction,
  chooseInvoiceDestination,
  deriveImportedApprovalPlan,
  getImportedTransactionPresentation,
  isInvoiceCreditMovement,
  readImportedLineSelection,
  validateImportedLineForApproval,
  type ImportedTransactionKind,
  type SuggestedTransactionType,
} from "@/lib/finance-domain";
import { computeInvoicePeriod, type CreditCardInvoice } from "@/lib/credit-cards";

export const Route = createFileRoute("/importar")({
  head: () => ({
    meta: [
      { title: "Importar extrato — Life OS" },
      {
        name: "description",
        content:
          "Importe extratos bancários e faturas de cartão. Revise cada linha antes de virar transação.",
      },
    ],
  }),
  component: ImportarPage,
});

// -------------------- Type helpers --------------------

// User-facing type. The internal transactions.type may still be
// "credit_card_purchase" when file_context === "credit_card" and the
// user picks "expense" — that mapping happens at approval time.
type LineType = SuggestedTransactionType;

const TYPE_LABELS: Record<LineType, string> = {
  income: "Receita",
  expense: "Despesa",
  transfer: "Transferência",
};

function readLineMeta(line: ImportedTransactionLine) {
  const meta = (line.metadata ?? {}) as Record<string, unknown>;
  const { selectedType, destinationAccountId } = readImportedLineSelection(meta);
  return { meta, selectedType, destinationAccountId };
}

function validateLineForApprove(
  line: ImportedTransactionLine,
  file: ImportedFile,
): string | null {
  const { selectedType, destinationAccountId } = readLineMeta(line);
  return validateImportedLineForApproval({
    date: line.extracted_date,
    amount: line.extracted_amount,
    description: line.extracted_description,
    context: file.file_context,
    selectedType,
    financialAccountId:
      line.selected_financial_account_id ?? file.financial_account_id ?? null,
    creditCardId: line.selected_credit_card_id ?? file.credit_card_id ?? null,
    destinationAccountId,
    creditCardInvoiceId: line.selected_credit_card_invoice_id,
    canResolveInvoice: !!line.extracted_date,
  });
}



function ImportarPage() {
  const [reviewingFileId, setReviewingFileId] = useState<string | null>(null);

  if (reviewingFileId) {
    return (
      <ReviewScreen fileId={reviewingFileId} onBack={() => setReviewingFileId(null)} />
    );
  }

  return <ImportHome onOpenReview={setReviewingFileId} />;
}

function ImportHome({ onOpenReview }: { onOpenReview: (id: string) => void }) {
  return (
    <>
      <PageHeader
        eyebrow="Importação"
        title="Importar extrato"
        subtitle="Importe extratos bancários ou faturas de cartão e revise tudo antes de salvar."
      />
      <PageBody>
        <UploadCard onDone={onOpenReview} />
        <HistorySection onContinue={onOpenReview} />
      </PageBody>
    </>
  );
}

// -------------------- Upload --------------------

function UploadCard({ onDone }: { onDone: (fileId: string) => void }) {
  const { data: accounts = [] } = useAccounts();
  const { data: cards = [] } = useCreditCards();
  const { data: categories = [] } = useCategories();
  const { data: projects = [] } = useProjects();
  const startImport = useStartImport();

  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [context, setContext] = useState<FileContext>("bank_account");
  const [accountId, setAccountId] = useState<string>("");
  const [cardId, setCardId] = useState<string>("");
  const [invoiceDueDate, setInvoiceDueDate] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");

  // Auto-suggest invoice due date from filename (YYYY-MM-DD or DD-MM-YYYY).
  function suggestDueFromFilename(name: string): string | null {
    const iso = name.match(/(\d{4})[-_.](\d{2})[-_.](\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const br = name.match(/(\d{2})[-_.](\d{2})[-_.](\d{4})/);
    if (br) return `${br[3]}-${br[2]}-${br[1]}`;
    return null;
  }

  function onPickFile(f: File | null) {
    setFile(f);
    if (f && context === "credit_card" && !invoiceDueDate) {
      const suggested = suggestDueFromFilename(f.name);
      if (suggested) setInvoiceDueDate(suggested);
    }
  }

  const ext = file?.name.split(".").pop()?.toLowerCase();
  const supported =
    ext === "csv" || ext === "txt" || ext === "pdf" || ext === "ofx" || ext === "xlsx" || ext === "xls";

  async function submit() {
    if (!file) return toast.error("Selecione um arquivo primeiro.");
    if (!supported)
      return toast.error("Formato não suportado. Envie CSV, TXT, OFX, XLSX ou PDF.");
    if (context === "bank_account" && !accountId)
      return toast.error("Selecione a conta financeira do extrato.");
    if (context === "credit_card" && !cardId)
      return toast.error("Selecione o cartão da fatura.");

    try {
      const result = await startImport.mutateAsync({
        file,
        fileContext: context,
        financialAccountId: accountId || null,
        creditCardId: cardId || null,
        defaultCategoryId: categoryId || null,
        defaultProjectId: projectId || null,
        invoiceDueDate: context === "credit_card" ? invoiceDueDate || null : null,
      });
      if (result.detectionWarning) {
        toast.message(result.detectionWarning);
      }
      if (result.fileType === "pdf") {
        toast.success(
          "PDF recebido com sucesso. A extração automática pode exigir processamento adicional.",
        );
      } else if (result.lineCount === 0) {
        toast.message("Arquivo enviado, mas nenhuma linha foi identificada.", {
          description: "Você pode revisar no histórico e ajustar manualmente.",
        });
      } else {
        toast.success(`Encontramos ${result.lineCount} possíveis transações para revisão.`);
        onDone(result.fileId);
      }
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao importar arquivo.";
      const showTechnicalDetail = import.meta.env.DEV;
      toast.error(
        showTechnicalDetail
          ? msg
          : "Não conseguimos importar este arquivo agora. Verifique o histórico e tente novamente.",
      );
    }
  }

  return (
    <div className="card-soft space-y-6 p-6">
      <div className="rounded-2xl bg-gold-soft p-4 ring-1 ring-gold/20">
        <div className="text-[11px] uppercase tracking-[0.18em] text-ink-soft">
          Sua tranquilidade primeiro
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          Nenhuma transação será criada automaticamente. Você sempre revisa antes de aprovar.
        </p>
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Origem do arquivo
        </label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <ContextChip
            active={context === "bank_account"}
            onClick={() => setContext("bank_account")}
            label="Extrato bancário"
            hint="Conta corrente, poupança, digital"
          />
          <ContextChip
            active={context === "credit_card"}
            onClick={() => setContext("credit_card")}
            label="Fatura de cartão"
            hint="Cartão de crédito"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {context === "bank_account" ? (
          <Field label="Conta financeira">
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Selecione uma conta" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : (
          <Field label="Cartão de crédito">
            <Select value={cardId} onValueChange={setCardId}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Selecione um cartão" />
              </SelectTrigger>
              <SelectContent>
                {cards.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {context === "credit_card" && (
          <Field label="Vencimento da fatura">
            <Input
              type="date"
              value={invoiceDueDate}
              onChange={(e) => setInvoiceDueDate(e.target.value)}
            />
            <div className="mt-1 text-[11px] text-muted-foreground">
              Use o vencimento da fatura que este arquivo representa. Isso ajuda o
              Life OS a separar o que já foi pago do que ainda está pendente.
            </div>
          </Field>
        )}


        <Field label="Categoria padrão (opcional)">
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Sem categoria padrão" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Projeto (opcional)">
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Sem projeto" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Arquivo
        </label>
        <div
          className="mt-2 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-surface-soft px-6 py-10 text-center transition hover:bg-secondary/50"
          onClick={() => inputRef.current?.click()}
          role="button"
        >
          <UploadCloud className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
          {file ? (
            <>
              <div className="text-sm font-medium">{file.name}</div>
              <div className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB · {ext?.toUpperCase()}
              </div>
            </>
          ) : (
            <>
              <div className="font-serif text-lg">Arraste ou clique para escolher</div>
              <div className="text-xs text-muted-foreground">
                Formatos aceitos: CSV, TXT, OFX, XLSX e PDF — até 20MB
              </div>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.txt,.pdf,.ofx,.xlsx,.xls"
            className="hidden"
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        {file && (
          <button
            onClick={() => {
              setFile(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="rounded-full border border-border px-4 py-2 text-xs hover:bg-secondary"
          >
            Limpar
          </button>
        )}
        <button
          onClick={submit}
          disabled={!file || startImport.isPending}
          className="inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-xs font-medium text-background transition hover:opacity-90 disabled:opacity-50"
        >
          {startImport.isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando…
            </>
          ) : (
            <>
              <UploadCloud className="h-3.5 w-3.5" /> Enviar arquivo
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function ContextChip({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-4 text-left transition",
        active
          ? "border-ink bg-secondary"
          : "border-border bg-surface hover:bg-secondary/50",
      )}
    >
      <div className="text-sm font-medium">{label}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

// -------------------- History --------------------

function HistorySection({ onContinue }: { onContinue: (id: string) => void }) {
  const { data: files = [], isLoading } = useImportedFiles();

  return (
    <Section
      title="Histórico de importações"
      subtitle="Acompanhe seus envios e continue revisões pendentes."
    >
      <div className="card-soft divide-y divide-border/60">
        {isLoading && (
          <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
        )}
        {!isLoading && files.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground">
            Você ainda não importou nenhum arquivo.
          </div>
        )}
        {files.map((f) => (
          <button
            key={f.id}
            onClick={() => onContinue(f.id)}
            className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-secondary/40"
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface-soft">
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{f.file_name}</div>
              <div className="text-xs text-muted-foreground">
                {f.file_type?.toUpperCase()} ·{" "}
                {f.file_context === "credit_card" ? "Cartão" : "Conta"} ·{" "}
                {new Date(f.created_at).toLocaleDateString("pt-BR")}
              </div>
            </div>
            <div className="hidden text-right text-xs text-muted-foreground sm:block">
              <div>
                {f.approved_lines ?? 0} aprovadas / {f.total_lines ?? 0} linhas
              </div>
              <StatusBadge status={String(f.status)} />
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    </Section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; tone: string }> = {
    uploaded: { label: "Enviado", tone: "bg-secondary text-foreground" },
    processing: { label: "Processando", tone: "bg-sky/15 text-sky" },
    processed: { label: "Pronto para revisão", tone: "bg-gold-soft text-ink" },
    approved: { label: "Aprovado", tone: "bg-sage/15 text-sage" },
    failed: { label: "Falhou", tone: "bg-clay/15 text-clay" },
  };
  const s = map[status] ?? { label: status, tone: "bg-secondary text-foreground" };
  return (
    <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-[10px]", s.tone)}>
      {s.label}
    </span>
  );
}

// -------------------- Review --------------------

function ReviewScreen({ fileId, onBack }: { fileId: string; onBack: () => void }) {
  const { data: file } = useImportedFile(fileId);
  const { data: lines = [], isLoading } = useImportedLines(fileId);
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const { data: cards = [] } = useCreditCards();
  const { data: invoices = [] } = useInvoices();
  const { data: projects = [] } = useProjects();

  const approve = useApproveLine();
  const reject = useRejectLine();
  const undo = useUndoLine();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);

  const summary = useMemo(() => {
    const pending = lines.filter((l) => l.review_status === "pending").length;
    const approved = lines.filter((l) => l.review_status === "approved").length;
    const rejected = lines.filter((l) => l.review_status === "rejected").length;
    return { pending, approved, rejected };
  }, [lines]);

  const catName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? "—";

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulk(action: "approve" | "reject") {
    if (!file) return;
    const targets = lines.filter(
      (l) => selected.has(l.id) && l.review_status === "pending",
    );
    if (targets.length === 0) return toast.error("Nenhuma linha pendente selecionada.");

    if (action === "reject") {
      let ok = 0;
      for (const line of targets) {
        try {
          await reject.mutateAsync({ line, file });
          ok++;
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Erro em uma linha.");
        }
      }
      setSelected(new Set());
      toast.success(`${ok} linha(s) rejeitada(s).`);
      return;
    }

    const valid = targets.filter((l) => validateLineForApprove(l, file) === null);
    const invalid = targets.length - valid.length;

    let ok = 0;
    for (const line of valid) {
      try {
        await approve.mutateAsync({ line, file });
        ok++;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro em uma linha.");
      }
    }
    setSelected(new Set());
    if (invalid > 0) {
      toast.message(
        `${ok} linha(s) foram aprovadas. ${invalid} precisa(m) de revisão.`,
      );
    } else {
      toast.success(`${ok} transação(ões) importada(s) com sucesso.`);
    }
  }

  if (!file) {
    return (
      <PageBody>
        <div className="card-soft p-6 text-sm text-muted-foreground">Carregando…</div>
      </PageBody>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Revisar importação"
        title={file.file_name}
        subtitle="Confira os dados antes de transformar em transações reais."
        action={
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-xs hover:bg-secondary"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </button>
        }
      />
      <PageBody>
        <div className="card-soft flex flex-wrap items-center gap-4 p-4 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-soft px-3 py-1 text-ink">
            {summary.pending} pendentes
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sage/15 px-3 py-1 text-sage">
            {summary.approved} aprovadas
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-clay/15 px-3 py-1 text-clay">
            {summary.rejected} rejeitadas
          </span>
          <div className="ml-auto text-muted-foreground">
            Revise antes de salvar. Nenhuma transação será criada sem sua aprovação.
          </div>
        </div>

        {file.file_type === "pdf" && lines.length === 0 && (
          <div className="card-soft bg-gold-soft p-5 ring-1 ring-gold/20">
            <div className="text-[11px] uppercase tracking-[0.18em] text-ink-soft">
              PDF recebido
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              O arquivo foi salvo com sucesso. A extração automática de PDF pode exigir
              processamento adicional por Edge Function ou n8n. Assim que estiver pronto,
              as linhas aparecerão aqui para revisão.
            </p>
          </div>
        )}

        {file.status === "failed" && (
          <div className="card-soft bg-clay/10 p-5 ring-1 ring-clay/20">
            <div className="text-[11px] uppercase tracking-[0.18em] text-clay">
              Importação falhou
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              {file.error_message ||
                (typeof file.metadata?.error === "string"
                  ? file.metadata.error
                  : "Não foi possível processar este arquivo. Tente enviar novamente.")}
            </p>
          </div>
        )}

        {selected.size > 0 && (
          <div className="sticky top-2 z-10 flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs text-background shadow-lg">
            <span>{selected.size} selecionada(s)</span>
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => bulk("approve")}
                className="rounded-full bg-background/10 px-3 py-1 hover:bg-background/20"
              >
                Aprovar
              </button>
              <button
                onClick={() => bulk("reject")}
                className="rounded-full bg-background/10 px-3 py-1 hover:bg-background/20"
              >
                Rejeitar
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="rounded-full bg-background/10 px-3 py-1 hover:bg-background/20"
              >
                Limpar
              </button>
            </div>
          </div>
        )}

        <Section title="Linhas encontradas">
          <div className="card-soft divide-y divide-border/60">
            {isLoading && (
              <div className="p-6 text-sm text-muted-foreground">Carregando linhas…</div>
            )}
            {!isLoading && lines.length === 0 && file.file_type !== "pdf" && (
              <div className="p-6 text-sm text-muted-foreground">
                Nenhuma linha identificada neste arquivo.
              </div>
            )}
            {lines.map((line) => (
              <LineRow
                key={line.id}
                line={line}
                file={file}
                editing={editingId === line.id}
                selected={selected.has(line.id)}
                onSelect={() => toggle(line.id)}
                onEdit={() => setEditingId(line.id)}
                onCloseEdit={() => setEditingId(null)}
                onApprove={async () => {
                  const err = validateLineForApprove(line, file);
                  if (err) {
                    toast.error(err);
                    return;
                  }
                  try {
                    await approve.mutateAsync({ line, file });
                    toast.success("Transação importada com sucesso.");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Erro ao aprovar.");
                  }
                }}
                onReject={async () => {
                  await reject.mutateAsync({ line, file });
                  toast.message("Linha rejeitada.");
                }}
                onUndo={async () => {
                  await undo.mutateAsync({ line, file });
                  toast.message("Status revertido.");
                }}
                categoryName={catName}
                categories={categories}
                accounts={accounts}
                cards={cards}
                invoices={invoices}
                projects={projects}
              />
            ))}
          </div>
        </Section>
      </PageBody>
    </>
  );
}

function LineRow({
  line,
  file,
  editing,
  selected,
  onSelect,
  onEdit,
  onCloseEdit,
  onApprove,
  onReject,
  onUndo,
  categoryName,
  categories,
  accounts,
  cards,
  invoices,
  projects,
}: {
  line: ImportedTransactionLine;
  file: ImportedFile;
  editing: boolean;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onCloseEdit: () => void;
  onApprove: () => void;
  onReject: () => void;
  onUndo: () => void;
  categoryName: (id: string | null) => string;
  categories: Array<{ id: string; name: string }>;
  accounts: Array<{ id: string; name: string }>;
  cards: Array<{
    id: string;
    name: string;
    closing_day: number | null;
    due_day: number | null;
  }>;
  invoices: CreditCardInvoice[];
  projects: Array<{ id: string; name: string }>;
}) {
  const updateLine = useUpdateImportedLine();

  const { selectedType: persistedType, destinationAccountId: persistedDest, meta } =
    readLineMeta(line);
  const amountNum = Number(line.extracted_amount ?? 0);
  const systemClassification = classifyImportedTransaction({
    description: line.extracted_description,
    amount: amountNum,
    context: file.file_context,
  });
  const historyKinds: readonly ImportedTransactionKind[] = [
    "standard",
    "bank_transfer",
    "credit_card_payment",
    "invoice_credit",
    "refund",
    "cashback",
    "financial_charge",
    "previous_balance",
  ];
  const historyKind =
    meta.suggestion_source === "user_history" &&
    typeof meta.classification_kind === "string" &&
    historyKinds.includes(meta.classification_kind as ImportedTransactionKind)
      ? (meta.classification_kind as ImportedTransactionKind)
      : null;
  const classification = historyKind
    ? { ...systemClassification, kind: historyKind, requiresReview: false }
    : systemClassification;
  const suggested = classification.suggestedType;
  const currentType: LineType | "" = persistedType ?? suggested ?? "";
  const isSuggestion = !persistedType && suggested !== null;
  const approvalPlan = deriveImportedApprovalPlan({
    classification,
    context: file.file_context,
    amount: amountNum,
    selectedType: persistedType,
  });
  const presentation = getImportedTransactionPresentation({
    classification,
    context: file.file_context,
    description: line.extracted_description,
    effectiveType: currentType || null,
  });

  const resolvedCardId =
    line.selected_credit_card_id ?? file.credit_card_id ?? null;
  const fileDueDate =
    typeof file.metadata?.invoice_due_date === "string"
      ? file.metadata.invoice_due_date
      : null;
  const dueDateInvoiceId = invoices.find(
    (invoice) =>
      invoice.credit_card_id === resolvedCardId &&
      !!fileDueDate &&
      invoice.due_date.slice(0, 10) === fileDueDate.slice(0, 10),
  )?.id;
  const cardForPeriod = cards.find((card) => card.id === resolvedCardId);
  const datedReference =
    cardForPeriod && line.extracted_date
      ? computeInvoicePeriod(line.extracted_date, cardForPeriod).referenceMonth
      : null;
  const datedInvoiceId = invoices.find(
    (invoice) =>
      invoice.credit_card_id === resolvedCardId &&
      !!datedReference &&
      invoice.reference_month.slice(0, 10) === datedReference,
  )?.id;
  const defaultInvoiceId = chooseInvoiceDestination({
    selectedInvoiceId: line.selected_credit_card_invoice_id,
    dueDateInvoiceId,
    datedInvoiceId,
  });

  const [date, setDate] = useState(line.extracted_date ?? "");
  const [desc, setDesc] = useState(line.extracted_description ?? "");
  const [amount, setAmount] = useState(
    line.extracted_amount != null ? String(line.extracted_amount) : "",
  );
  const [categoryId, setCategoryId] = useState(line.selected_category_id ?? "");
  const [projectId, setProjectId] = useState(line.selected_project_id ?? "");
  const [accountId, setAccountId] = useState(line.selected_financial_account_id ?? "");
  const [destAccountId, setDestAccountId] = useState(persistedDest ?? "");
  const [cardId, setCardId] = useState(
    line.selected_credit_card_id ?? file.credit_card_id ?? "",
  );
  const [invoiceId, setInvoiceId] = useState(line.selected_credit_card_invoice_id ?? "");
  const [editType, setEditType] = useState<LineType | "">(currentType);

  async function persistMeta(patch: Record<string, unknown>) {
    const nextMeta = { ...meta, ...patch };
    await updateLine.mutateAsync({
      id: line.id,
      fileId: file.id,
      patch: { metadata: nextMeta },
    });
  }

  async function handleTypeChange(next: LineType) {
    try {
      await persistMeta({
        user_selected_type: next,
        selected_type: next,
        ...(meta.suggestion_source === "user_history"
          ? {
              suggestion_source: "user_override",
              classification_kind: systemClassification.kind,
              movement_type: null,
            }
          : {}),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar tipo.");
    }
  }

  async function handleDestChange(next: string) {
    try {
      await persistMeta({ destination_account_id: next || null });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar destino.");
    }
  }

  async function save() {
    try {
      const nextMeta = {
        ...meta,
        user_selected_type: editType || null,
        selected_type: editType || null,
        ...(meta.suggestion_source === "user_history" && editType !== persistedType
          ? {
              suggestion_source: "user_override",
              classification_kind: systemClassification.kind,
              movement_type: null,
            }
          : {}),
        destination_account_id:
          editType === "transfer" ? destAccountId || null : meta.destination_account_id ?? null,
      };
      await updateLine.mutateAsync({
        id: line.id,
        fileId: file.id,
        patch: {
          extracted_date: date || null,
          extracted_description: desc,
          extracted_amount: amount ? Number(amount) : null,
          selected_category_id: categoryId || null,
          selected_project_id: projectId || null,
          selected_financial_account_id: accountId || null,
          selected_credit_card_id: cardId || null,
          selected_credit_card_invoice_id: invoiceId || defaultInvoiceId || null,
          metadata: nextMeta,
        },
      });
      toast.success("Linha atualizada.");
      onCloseEdit();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    }
  }

  const statusPill =
    line.review_status === "approved" ? (
      <span className="rounded-full bg-sage/15 px-2 py-0.5 text-[10px] text-sage">
        aprovada
      </span>
    ) : line.review_status === "rejected" ? (
      <span className="rounded-full bg-clay/15 px-2 py-0.5 text-[10px] text-clay">
        rejeitada
      </span>
    ) : (
      <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[10px] text-ink">
        pendente
      </span>
    );

  const isCredit = file.file_context === "credit_card";
  const isPending = line.review_status === "pending";
  const invoiceMovement = isInvoiceCreditMovement(classification.kind);
  const isActualPayment = classification.kind === "credit_card_payment";
  const editApprovalPlan = deriveImportedApprovalPlan({
    classification,
    context: file.file_context,
    amount: Number(amount || amountNum),
    selectedType: editType || null,
  });
  const needsReview =
    isPending &&
    meta.suggestion_source !== "user_history" &&
    (meta.requires_review === true || (!persistedType && classification.requiresReview));
  const effectiveInvoiceId = invoiceId || defaultInvoiceId || "";
  const targetInvoice = invoices.find((invoice) => invoice.id === effectiveInvoiceId);
  const invoiceOptions = invoices.filter(
    (invoice) => invoice.credit_card_id === (cardId || resolvedCardId),
  );
  const badgeTone =
    presentation.tone === "positive"
      ? "bg-sage/15 text-sage"
      : presentation.tone === "negative"
        ? "bg-clay/15 text-clay"
        : "bg-secondary text-muted-foreground";
  const suggestionSource =
    typeof meta.suggestion_source === "string" ? meta.suggestion_source : null;
  const historySuggested = suggestionSource === "user_history";
  const keywordSuggested = suggestionSource === "system_keyword";
  const confidence =
    typeof meta.suggestion_confidence === "number" ? meta.suggestion_confidence : null;
  const trnType = typeof meta.trntype === "string" ? meta.trntype : null;
  const fitId = typeof meta.fitid === "string" ? meta.fitid : null;

  return (
    <div className={cn("p-4", selected && "bg-secondary/40")}>
      <div className="flex items-start gap-3">
        {isPending && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelect}
            className="mt-1 h-4 w-4 accent-foreground"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <div className="font-medium">
              {line.extracted_description || "Sem descrição"}
            </div>
            {statusPill}
            <span className={cn("rounded-full px-2 py-0.5 text-[10px]", badgeTone)}>
              {presentation.badge}
            </span>
            {historySuggested && (
              <span className="rounded-full bg-sage/15 px-2 py-0.5 text-[10px] text-sage">
                Sugerido pelo histórico
              </span>
            )}
            {keywordSuggested && (
              <span className="rounded-full bg-sky/15 px-2 py-0.5 text-[10px] text-sky">
                Sugerido por palavra-chave
              </span>
            )}
            {needsReview && (
              <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[10px] text-ink">
                Precisa revisão
              </span>
            )}
            {line.suggested_category_id && !line.selected_category_id && (
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                sugestão: {categoryName(line.suggested_category_id)}
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
            <span>
              {line.extracted_date
                ? new Date(line.extracted_date).toLocaleDateString("pt-BR")
                : "sem data"}
            </span>
            <span
              className={cn(
                "font-medium",
                presentation.tone === "positive"
                  ? "text-sage"
                  : presentation.tone === "negative"
                    ? "text-clay"
                    : "text-muted-foreground",
              )}
            >
              {brl(Math.abs(amountNum))}
            </span>
            {line.selected_category_id && (
              <span>Categoria: {categoryName(line.selected_category_id)}</span>
            )}
            <span>{presentation.direction}</span>
            {isCredit && (
              <span>
                {cards.find((card) => card.id === resolvedCardId)?.name ?? "Cartão pendente"}
              </span>
            )}
            {!isCredit && (
              <span>
                {accounts.find(
                  (account) =>
                    account.id ===
                    (line.selected_financial_account_id ?? file.financial_account_id),
                )?.name ?? "Conta pendente"}
              </span>
            )}
            {targetInvoice && (
              <span>
                Fatura vence{" "}
                {new Date(`${targetInvoice.due_date.slice(0, 10)}T12:00:00`).toLocaleDateString(
                  "pt-BR",
                )}
              </span>
            )}
            {approvalPlan?.isInvoiceMovement && !targetInvoice && (
              <span>Fatura será resolvida pelo vencimento/data</span>
            )}
          </div>

          {(suggestionSource || confidence != null || trnType || fitId) && (
            <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
              {suggestionSource === "amount_signal" && <span>Origem: sinal do valor</span>}
              {confidence != null && <span>Confiança: {Math.round(confidence * 100)}%</span>}
              {trnType && <span className="rounded-full bg-secondary px-2 py-0.5">OFX {trnType}</span>}
              {fitId && <span className="rounded-full bg-secondary px-2 py-0.5">FITID {fitId}</span>}
            </div>
          )}

          {isPending && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="min-w-[180px]">
                <Select
                  value={currentType || undefined}
                  onValueChange={(v) => handleTypeChange(v as LineType)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Escolher tipo…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Receita</SelectItem>
                    <SelectItem value="expense">Despesa</SelectItem>
                    <SelectItem value="transfer">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isCredit &&
                currentType === "expense" &&
                classification.kind === "standard" && (
                <span className="rounded-full bg-clay/15 px-2 py-0.5 text-[10px] text-clay">
                  Despesa no cartão
                </span>
              )}
              {isSuggestion && currentType && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  sugestão: {TYPE_LABELS[currentType as LineType]}
                  {invoiceMovement ? ` (${presentation.badge.toLowerCase()})` : ""}
                </span>
              )}
              {currentType === "transfer" && !approvalPlan?.isInvoiceMovement && (
                <div className="min-w-[200px]">
                  <Select
                    value={persistedDest ?? undefined}
                    onValueChange={handleDestChange}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Conta de destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts
                        .filter(
                          (a) =>
                            a.id !==
                            (line.selected_financial_account_id ?? file.financial_account_id),
                        )
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {isActualPayment && currentType === "transfer" && !line.selected_financial_account_id && !file.financial_account_id && (
                <span className="text-[10px] text-clay">
                  Selecione a conta de origem no editor para aprovar.
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isPending && (
            <>
              <button
                onClick={onEdit}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                title="Editar"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onApprove}
                className="grid h-8 w-8 place-items-center rounded-lg text-sage hover:bg-sage/10"
                title="Aprovar"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={onReject}
                className="grid h-8 w-8 place-items-center rounded-lg text-clay hover:bg-clay/10"
                title="Rejeitar"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          )}
          {!isPending && (
            <button
              onClick={onUndo}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground hover:bg-secondary"
              title="Desfazer"
            >
              {line.review_status === "approved" ? (
                <Undo2 className="h-3 w-3" />
              ) : (
                <RotateCcw className="h-3 w-3" />
              )}
              Desfazer
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-4 grid gap-3 rounded-xl bg-surface-soft p-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Tipo de lançamento">
            <Select
              value={editType || undefined}
              onValueChange={(v) => setEditType(v as LineType)}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Escolher tipo…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Receita</SelectItem>
                <SelectItem value="expense">Despesa</SelectItem>
                <SelectItem value="transfer">Transferência</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Data">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Descrição">
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
          </Field>
          <Field label="Valor">
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Categoria">
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Sem categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Projeto">
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Sem projeto" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {editApprovalPlan?.isInvoiceMovement ? (
            <>
              {isActualPayment && (
                <Field label="Conta de origem (pagamento)">
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
              <Field label="Cartão">
                <Select
                  value={cardId}
                  onValueChange={(nextCardId) => {
                    setCardId(nextCardId);
                    setInvoiceId("");
                  }}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {cards.map((card) => (
                      <SelectItem key={card.id} value={card.id}>
                        {card.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Fatura de destino">
                <Select value={effectiveInvoiceId} onValueChange={setInvoiceId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Resolver pela data" />
                  </SelectTrigger>
                  <SelectContent>
                    {invoiceOptions.map((invoice) => (
                      <SelectItem key={invoice.id} value={invoice.id}>
                        Vence{" "}
                        {new Date(
                          `${invoice.due_date.slice(0, 10)}T12:00:00`,
                        ).toLocaleDateString("pt-BR")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </>
          ) : editType === "transfer" ? (
            <>
              <Field label="Conta de origem">
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Conta de destino">
                <Select value={destAccountId} onValueChange={setDestAccountId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts
                      .filter((account) => account.id !== accountId)
                      .map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
            </>
          ) : (
            <Field label="Conta">
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <div className="col-span-full flex justify-end gap-2">
            <button
              onClick={onCloseEdit}
              className="rounded-full border border-border px-4 py-2 text-xs hover:bg-secondary"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={updateLine.isPending}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs text-background hover:opacity-90 disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Salvar linha
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
