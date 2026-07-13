import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader, Section, StatCard, brl } from "@/components/ui-bits";
import { creditCards as mockCards, monthSummary, transactions as mockTx } from "@/lib/mockData";
import {
  useAccounts,
  useCategories,
  useCreditCards,
  useDeleteTransaction,
  useProjects,
  useTransactions,
} from "@/lib/finance-hooks";
import { useDashboardData } from "@/lib/use-dashboard-data";
import { TransactionDialog } from "@/components/finance/TransactionDialog";
import { AccountDialog } from "@/components/finance/AccountDialog";
import type { Transaction, TxType } from "@/lib/finance-api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Life OS" },
      {
        name: "description",
        content:
          "Cadastre, edite e organize suas movimentações com clareza. Contas, cartões e projetos conectados.",
      },
    ],
  }),
  component: Financeiro,
});

const TYPE_LABEL: Record<TxType, string> = {
  income: "Receita",
  expense: "Despesa",
  transfer: "Transferência",
  credit_card_purchase: "Despesa no cartão",
};

function periodStart(period: string): Date | null {
  const now = new Date();
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "30d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d;
  }
  if (period === "year") return new Date(now.getFullYear(), 0, 1);
  return null;
}

function Financeiro() {
  const { data: txs = [], isLoading } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const { data: cards = [] } = useCreditCards();
  const { data: projects = [] } = useProjects();
  const dashboard = useDashboardData();
  const deleteTx = useDeleteTransaction();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [accountDialog, setAccountDialog] = useState(false);
  const [toDelete, setToDelete] = useState<Transaction | null>(null);

  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("all");
  const [fType, setFType] = useState("all");
  const [fCategory, setFCategory] = useState("all");
  const [fAccount, setFAccount] = useState("all");
  const [fCard, setFCard] = useState("all");
  const [fProject, setFProject] = useState("all");
  const [fOrigin, setFOrigin] = useState("all");
  const [fStatus, setFStatus] = useState("all");

  const hasReal = txs.length > 0;

  const filtered = useMemo(() => {
    const start = periodStart(period);
    return txs.filter((t) => {
      if (start && new Date(t.transaction_date) < start) return false;
      if (fType !== "all" && t.type !== fType) return false;
      if (fCategory !== "all" && t.category_id !== fCategory) return false;
      if (fAccount !== "all" && t.financial_account_id !== fAccount) return false;
      if (fCard !== "all" && t.credit_card_id !== fCard) return false;
      if (fProject !== "all" && t.project_id !== fProject) return false;
      if (fOrigin !== "all" && (t.origin ?? "manual") !== fOrigin) return false;
      if (fStatus !== "all" && (t.review_status ?? "approved") !== fStatus) return false;
      if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [txs, period, fType, fCategory, fAccount, fCard, fProject, fOrigin, fStatus, search]);

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Sem categoria";
  const accName = (id: string | null) => accounts.find((a) => a.id === id)?.name;
  const cardName = (id: string | null) => cards.find((c) => c.id === id)?.name;
  const projName = (id: string | null) => projects.find((p) => p.id === id)?.name;

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(t: Transaction) {
    setEditing(t);
    setDialogOpen(true);
  }
  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await deleteTx.mutateAsync(toDelete.id);
      toast.success("Movimentação excluída.");
      setToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir.");
    }
  }

  const useLive = dashboard.hasAnyData || hasReal;
  const balance = useLive ? dashboard.balance : mockTx.reduce((a, b) => a + 0, 0);

  return (
    <>
      <PageHeader
        eyebrow={new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        title="Seu dinheiro com clareza"
        subtitle="Registre, revise e conecte cada movimentação ao que importa na sua vida."
        action={
          <div className="hidden gap-2 sm:flex">
            <button
              onClick={() => setAccountDialog(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2.5 text-xs font-medium transition hover:bg-secondary"
            >
              <Wallet className="h-3.5 w-3.5" /> Nova conta
            </button>
            <button
              onClick={openNew}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-xs font-medium text-background transition hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" /> Lançamento
            </button>
          </div>
        }
      />

      <PageBody>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label="Saldo"
            value={brl(useLive ? balance : 0)}
            hint={useLive ? `${dashboard.accountsCount} conta(s)` : "sem contas ainda"}
          />
          <StatCard
            label="Receitas do mês"
            value={brl(useLive ? dashboard.income : monthSummary.income)}
            tone="sage"
          />
          <StatCard
            label="Despesas do mês"
            value={brl(useLive ? dashboard.expenses : monthSummary.expenses)}
          />
          <StatCard
            label="Movimentações"
            value={String(txs.length)}
            hint={hasReal ? "registradas por você" : "comece agora"}
            tone="sky"
          />
        </div>

        {accounts.length === 0 && (
          <div className="card-soft bg-gold-soft p-5 ring-1 ring-gold/20">
            <div className="text-[11px] uppercase tracking-[0.18em] text-ink-soft">
              Primeiro passo
            </div>
            <h3 className="mt-2 font-serif text-xl text-ink">
              Cadastre sua primeira conta financeira
            </h3>
            <p className="mt-1 text-sm text-ink-soft">
              Para registrar receitas, despesas e transferências você precisa de pelo menos uma conta.
              Leva menos de um minuto.
            </p>
            <button
              onClick={() => setAccountDialog(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs text-background hover:opacity-90"
            >
              <Wallet className="h-3.5 w-3.5" /> Cadastrar minha primeira conta
            </button>
          </div>
        )}

        <Section
          title="Movimentações"
          subtitle="Ordenadas pelas mais recentes. Clique em uma para editar."
          action={
            <button
              onClick={openNew}
              className="rounded-full bg-ink px-3 py-1.5 text-xs text-background hover:opacity-90 sm:hidden"
            >
              + Lançamento
            </button>
          }
        >
          <div className="card-soft space-y-3 p-4">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 xl:grid-cols-8">
              <Input
                placeholder="Buscar por descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="col-span-2 h-9 text-xs xl:col-span-2"
              />
              <Filter value={period} onChange={setPeriod} label="Período" options={[
                { v: "all", l: "Todo o período" },
                { v: "month", l: "Este mês" },
                { v: "30d", l: "Últimos 30 dias" },
                { v: "year", l: "Este ano" },
              ]} />
              <Filter value={fType} onChange={setFType} label="Tipo" options={[
                { v: "all", l: "Todos os tipos" },
                { v: "income", l: "Receitas" },
                { v: "expense", l: "Despesas" },
                { v: "transfer", l: "Transferências" },
                { v: "credit_card_purchase", l: "Cartão" },
              ]} />
              <Filter value={fCategory} onChange={setFCategory} label="Categoria" options={[
                { v: "all", l: "Todas as categorias" },
                ...categories.map((c) => ({ v: c.id, l: c.name })),
              ]} />
              <Filter value={fAccount} onChange={setFAccount} label="Conta" options={[
                { v: "all", l: "Todas as contas" },
                ...accounts.map((a) => ({ v: a.id, l: a.name })),
              ]} />
              <Filter value={fCard} onChange={setFCard} label="Cartão" options={[
                { v: "all", l: "Todos os cartões" },
                ...cards.map((c) => ({ v: c.id, l: c.name })),
              ]} />
              <Filter value={fProject} onChange={setFProject} label="Projeto" options={[
                { v: "all", l: "Todos os projetos" },
                ...projects.map((p) => ({ v: p.id, l: p.name })),
              ]} />
              <Filter value={fOrigin} onChange={setFOrigin} label="Origem" options={[
                { v: "all", l: "Toda origem" },
                { v: "manual", l: "Manual" },
                { v: "import_txt", l: "TXT" },
                { v: "import_csv", l: "CSV" },
                { v: "import_pdf", l: "PDF" },
                { v: "import_ofx", l: "OFX" },
                { v: "import_xlsx", l: "XLSX" },
                { v: "system", l: "Sistema" },
              ]} />
              <Filter value={fStatus} onChange={setFStatus} label="Revisão" options={[
                { v: "all", l: "Todos os status" },
                { v: "approved", l: "Aprovadas" },
                { v: "pending", l: "Pendentes" },
                { v: "rejected", l: "Rejeitadas" },
              ]} />
            </div>

            {isLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Carregando suas movimentações...
              </div>
            ) : filtered.length === 0 ? (
              hasReal ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Nada encontrado com esses filtros.
                </div>
              ) : (
                <EmptyState onCreate={openNew} />
              )
            ) : (
              <ul className="divide-y divide-border/60">
                {filtered.map((t) => {
                  const value = Number(t.amount);
                  const isIncome = t.type === "income";
                  const isTransfer = t.type === "transfer";
                  const meta =
                    t.metadata && typeof t.metadata === "object"
                      ? (t.metadata as Record<string, unknown>)
                      : {};
                  const isInvoicePayment =
                    isTransfer && meta.movement_type === "credit_card_payment";
                  const destinationAccountId =
                    isTransfer && !isInvoicePayment
                      ? meta.destination_account_id
                      : null;
                  const destAccountName =
                    typeof destinationAccountId === "string"
                      ? accName(destinationAccountId)
                      : null;
                  return (
                    <li
                      key={t.id}
                      className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3.5 sm:grid-cols-[80px_minmax(0,1fr)_auto_auto]"
                    >
                      <div className="hidden text-xs text-muted-foreground sm:block">
                        {new Date(t.transaction_date).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm">{t.description}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="rounded-full bg-secondary px-1.5 py-0.5">
                            {isInvoicePayment ? "Pagamento de fatura" : TYPE_LABEL[t.type]}
                          </span>
                          <span>{catName(t.category_id)}</span>
                          {t.credit_card_id && (
                            <>
                              <span>·</span>
                              <span>{cardName(t.credit_card_id)}</span>
                            </>
                          )}
                          {isTransfer && t.financial_account_id && destAccountName ? (
                            <>
                              <span>·</span>
                              <span>
                                {accName(t.financial_account_id)} → {destAccountName}
                              </span>
                            </>
                          ) : (
                            t.financial_account_id && (
                              <>
                                <span>·</span>
                                <span>{accName(t.financial_account_id)}</span>
                              </>
                            )
                          )}
                          {t.project_id && (
                            <span className="rounded-full bg-sky-soft px-1.5 py-0.5 text-sky">
                              {projName(t.project_id)}
                            </span>
                          )}
                          {t.is_installment && t.installment_total && (
                            <span className="rounded-full bg-secondary px-1.5 py-0.5">
                              {t.installment_number ?? "?"}/{t.installment_total}
                            </span>
                          )}
                          {t.origin && t.origin !== "manual" && (
                            <span className="rounded-full bg-gold-soft px-1.5 py-0.5 text-ink-soft">
                              {t.origin}
                            </span>
                          )}
                        </div>
                      </div>
                      <div
                        className={
                          isTransfer
                            ? "text-right text-sm font-medium text-muted-foreground"
                            : isIncome
                              ? "text-right text-sm font-medium text-sage"
                              : "text-right text-sm font-medium"
                        }
                      >
                        {brl(value)}
                      </div>

                      <div className="flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                        <button
                          onClick={() => openEdit(t)}
                          className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                          aria-label="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setToDelete(t)}
                          className="rounded-full p-1.5 text-muted-foreground hover:bg-clay-soft hover:text-clay"
                          aria-label="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Section>

        {!hasReal && cards.length === 0 && (
          <Section
            title="Cartões de crédito"
            subtitle="Enquanto você não cadastra os seus, mostramos exemplos para você visualizar."
            action={
              <a
                href="/cartoes"
                className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs hover:bg-secondary"
              >
                Ir para Cartões
              </a>
            }
          >
            <div className="grid gap-5 md:grid-cols-2">
              {mockCards.map((c) => {
                const pct = (c.used / c.limit) * 100;
                return (
                  <div key={c.id} className="card-soft overflow-hidden opacity-70">
                    <div className="p-5 text-background" style={{ background: c.color }}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-[11px] uppercase tracking-wider opacity-80">
                            {c.brand}
                          </div>
                          <div className="mt-1 font-serif text-2xl">{c.name}</div>
                        </div>
                        <div className="text-right text-xs opacity-80">
                          Fecha {String(c.closingDay).padStart(2, "0")}
                          <br />
                          Vence {String(c.dueDay).padStart(2, "0")}
                        </div>
                      </div>
                      <div className="mt-6">
                        <div className="text-xs opacity-80">Fatura atual (exemplo)</div>
                        <div className="font-serif text-3xl">{brl(c.used)}</div>
                      </div>
                      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                        <div className="h-full rounded-full bg-white/80" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        <Section
          title="Importar extrato"
          subtitle="Em breve: TXT, CSV ou PDF. Nada será salvo sem sua revisão."
        >
          <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
            <div className="card-soft flex flex-col items-center justify-center gap-3 border-2 border-dashed border-border bg-surface-soft p-10 text-center opacity-70">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-surface shadow-soft">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <div className="font-serif text-lg">Importação chega em breve</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Por enquanto, adicione manualmente para ter máximo controle.
                </div>
              </div>
            </div>
            <div className="card-soft p-5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileText className="h-3.5 w-3.5" /> Como será
              </div>
              <div className="mt-2 font-serif text-lg">Você sempre revisa antes de salvar</div>
              <ul className="mt-4 space-y-2 text-sm">
                <li className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-sage" /> Sugestão de categoria automática
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-sage" /> Detecção de duplicados
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <AlertCircle className="h-4 w-4 text-clay" /> Você aprova cada linha
                </li>
              </ul>
            </div>
          </div>
        </Section>
      </PageBody>

      <TransactionDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <AccountDialog open={accountDialog} onOpenChange={setAccountDialog} />

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir movimentação?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. A movimentação "{toDelete?.description}" será
              removida definitivamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleteTx.isPending}>
              {deleteTx.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Filter({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: { v: string; l: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 text-xs">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.v} value={o.v} className="text-xs">
            {o.l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-secondary">
        <Plus className="h-5 w-5" />
      </div>
      <div>
        <div className="font-serif text-lg">Nenhuma movimentação ainda</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Comece registrando sua última despesa ou receita. É rápido.
        </p>
      </div>
      <button
        onClick={onCreate}
        className="mt-2 rounded-full bg-ink px-4 py-2 text-xs text-background hover:opacity-90"
      >
        Registrar primeira movimentação
      </button>
    </div>
  );
}
