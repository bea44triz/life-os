import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CreditCard as CreditCardIcon,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader, Section, StatCard, brl } from "@/components/ui-bits";
import {
  useCategories,
  useCreditCards,
  useDeleteCreditCard,
  useInvoices,
  useTransactions,
} from "@/lib/finance-hooks";
import {
  bestPurchaseDay,
  computeInvoicePeriod,
  type CreditCardInvoice,
} from "@/lib/credit-cards";
import type { CreditCard } from "@/lib/finance-api";
import { CreditCardDialog } from "@/components/finance/CreditCardDialog";
import { CardPurchaseDialog } from "@/components/finance/CardPurchaseDialog";
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

export const Route = createFileRoute("/cartoes")({
  head: () => ({
    meta: [
      { title: "Cartões — Life OS" },
      {
        name: "description",
        content:
          "Entenda quando cada compra realmente impacta seu mês. Fechamento, vencimento, faturas e parcelamentos organizados com clareza.",
      },
    ],
  }),
  component: Cartoes,
});

function Cartoes() {
  const { data: cards = [], isLoading } = useCreditCards();
  const { data: invoices = [] } = useInvoices();
  const { data: txs = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const deleteCard = useDeleteCreditCard();

  const [cardDialog, setCardDialog] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [purchaseDialog, setPurchaseDialog] = useState(false);
  const [purchaseCardId, setPurchaseCardId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<CreditCard | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  // Summary
  const summary = useMemo(() => {
    let currentTotal = 0;
    let nextTotal = 0;
    let totalLimit = 0;
    let usedNow = 0;
    for (const card of cards) {
      const current = computeInvoicePeriod(today, card);
      const nextDate = shiftMonth(today, 1);
      const next = computeInvoicePeriod(nextDate, card);
      const curInv = findInvoice(invoices, card.id, current.referenceMonth);
      const nextInv = findInvoice(invoices, card.id, next.referenceMonth);
      currentTotal += curInv?.total_amount ?? 0;
      nextTotal += nextInv?.total_amount ?? 0;
      if (card.credit_limit) totalLimit += card.credit_limit;
      // openInvoices sum = "compromisso ativo"
      usedNow += (curInv?.total_amount ?? 0) + (nextInv?.total_amount ?? 0);
    }
    return { currentTotal, nextTotal, totalLimit, usedNow };
  }, [cards, invoices, today]);

  function openNewCard() {
    setEditingCard(null);
    setCardDialog(true);
  }
  function openEditCard(c: CreditCard) {
    setEditingCard(c);
    setCardDialog(true);
  }
  function openPurchase(cardId?: string) {
    setPurchaseCardId(cardId ?? null);
    setPurchaseDialog(true);
  }
  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await deleteCard.mutateAsync(toDelete.id);
      toast.success("Cartão excluído.");
      setToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir.");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Cartões de crédito"
        title="Domine suas faturas"
        subtitle="Cada cartão tem seu ritmo. Aqui você entende o impacto real de cada compra no seu mês."
        action={
          <div className="hidden gap-2 sm:flex">
            <button
              onClick={() => openPurchase()}
              disabled={cards.length === 0}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2.5 text-xs font-medium transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> Compra no cartão
            </button>
            <button
              onClick={openNewCard}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-xs font-medium text-background transition hover:opacity-90"
            >
              <CreditCardIcon className="h-3.5 w-3.5" /> Novo cartão
            </button>
          </div>
        }
      />

      <PageBody>
        {cards.length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Fatura atual" value={brl(summary.currentTotal)} tone="sage" />
            <StatCard
              label="Próxima fatura"
              value={brl(summary.nextTotal)}
              hint="já comprometido"
            />
            <StatCard
              label="Limite total"
              value={summary.totalLimit ? brl(summary.totalLimit) : "—"}
              tone="sky"
            />
            <StatCard
              label="Limite utilizado"
              value={
                summary.totalLimit
                  ? `${Math.round((summary.usedNow / summary.totalLimit) * 100)}%`
                  : "—"
              }
              hint={summary.totalLimit ? brl(summary.usedNow) : "cadastre um limite"}
            />
          </div>
        )}

        {isLoading ? (
          <div className="card-soft py-10 text-center text-sm text-muted-foreground">
            Carregando seus cartões...
          </div>
        ) : cards.length === 0 ? (
          <EmptyCards onCreate={openNewCard} />
        ) : (
          <Section
            title="Seus cartões"
            subtitle="Fechamento, vencimento, melhor dia e fatura em um só lugar."
            action={
              <button
                onClick={openNewCard}
                className="rounded-full bg-ink px-3 py-1.5 text-xs text-background hover:opacity-90 sm:hidden"
              >
                + Cartão
              </button>
            }
          >
            <div className="grid gap-5 md:grid-cols-2">
              {cards.map((c) => (
                <CardTile
                  key={c.id}
                  card={c}
                  invoices={invoices}
                  onEdit={() => openEditCard(c)}
                  onDelete={() => setToDelete(c)}
                  onPurchase={() => openPurchase(c.id)}
                />
              ))}
            </div>
          </Section>
        )}

        {cards.length > 0 && (
          <Section
            title="Análise das faturas"
            subtitle="Onde seu dinheiro do cartão está se concentrando."
          >
            <div className="grid gap-5 lg:grid-cols-2">
              {cards.map((c) => (
                <CardAnalysis
                  key={c.id}
                  card={c}
                  invoices={invoices}
                  txs={txs}
                  categories={categories}
                />
              ))}
            </div>
          </Section>
        )}
      </PageBody>

      <CreditCardDialog
        open={cardDialog}
        onOpenChange={setCardDialog}
        editing={editingCard}
      />
      <CardPurchaseDialog
        open={purchaseDialog}
        onOpenChange={setPurchaseDialog}
        defaultCardId={purchaseCardId}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{toDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir este cartão pode afetar transações e faturas vinculadas. Essa ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleteCard.isPending}>
              {deleteCard.isPending ? "Excluindo..." : "Excluir cartão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// -------- helpers --------

function shiftMonth(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1 + n, d);
  return dt.toISOString().slice(0, 10);
}

function findInvoice(
  invoices: CreditCardInvoice[],
  cardId: string,
  refMonth: string,
): CreditCardInvoice | undefined {
  return invoices.find(
    (i) => i.credit_card_id === cardId && i.reference_month.slice(0, 10) === refMonth,
  );
}

function statusPill(status: string) {
  const map: Record<string, string> = {
    open: "bg-sky-soft text-sky",
    closed: "bg-gold-soft text-ink-soft",
    paid: "bg-sage-soft text-sage",
    overdue: "bg-clay-soft text-clay",
  };
  const label: Record<string, string> = {
    open: "aberta",
    closed: "fechada",
    paid: "paga",
    overdue: "vencida",
  };
  return { cls: map[status] ?? "bg-secondary text-foreground", label: label[status] ?? status };
}

function CardTile({
  card,
  invoices,
  onEdit,
  onDelete,
  onPurchase,
}: {
  card: CreditCard;
  invoices: CreditCardInvoice[];
  onEdit: () => void;
  onDelete: () => void;
  onPurchase: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const current = computeInvoicePeriod(today, card);
  const next = computeInvoicePeriod(shiftMonth(today, 1), card);
  const curInv = findInvoice(invoices, card.id, current.referenceMonth);
  const nextInv = findInvoice(invoices, card.id, next.referenceMonth);
  const best = bestPurchaseDay(card.closing_day ?? 1);
  const limit = card.credit_limit ?? 0;
  const used = (curInv?.total_amount ?? 0) + (nextInv?.total_amount ?? 0);
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;

  return (
    <div className="card-soft overflow-hidden">
      <div className="bg-ink p-5 text-background">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-widest opacity-70">
              {card.brand ?? "Cartão"}
              {card.institution ? ` · ${card.institution}` : ""}
            </div>
            <div className="mt-1 truncate font-serif text-2xl">{card.name}</div>
          </div>
          <div className="text-right text-[11px] leading-tight opacity-80">
            Fecha {String(card.closing_day ?? 0).padStart(2, "0")}
            <br />
            Vence {String(card.due_day ?? 0).padStart(2, "0")}
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div>
            <div className="text-[11px] opacity-70">Fatura atual · {current.label}</div>
            <div className="font-serif text-2xl">{brl(curInv?.total_amount ?? 0)}</div>
            <div className="text-[11px] opacity-70">
              vence {new Date(current.dueDate).toLocaleDateString("pt-BR")}
            </div>
          </div>
          <div>
            <div className="text-[11px] opacity-70">Próxima · {next.label}</div>
            <div className="font-serif text-2xl">{brl(nextInv?.total_amount ?? 0)}</div>
            <div className="text-[11px] opacity-70">
              vence {new Date(next.dueDate).toLocaleDateString("pt-BR")}
            </div>
          </div>
        </div>
        {limit > 0 && (
          <div className="mt-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
              <div className="h-full bg-white/80" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] opacity-80">
              <span>Limite {brl(limit)}</span>
              <span>{pct.toFixed(0)}% comprometido</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {curInv && (
            <span className={`rounded-full px-2 py-0.5 ${statusPill(curInv.status).cls}`}>
              atual · {statusPill(curInv.status).label}
            </span>
          )}
          <span className="rounded-full bg-gold-soft px-2 py-0.5 text-ink-soft">
            melhor compra: dia {best}
          </span>
          {!card.is_active && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">
              inativo
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onPurchase}
            className="rounded-full bg-ink px-3 py-1.5 text-xs text-background hover:opacity-90"
          >
            + Compra
          </button>
          <button
            onClick={onEdit}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Editar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-clay-soft hover:text-clay"
            aria-label="Excluir"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CardAnalysis({
  card,
  invoices,
  txs,
  categories,
}: {
  card: CreditCard;
  invoices: CreditCardInvoice[];
  txs: Array<{
    credit_card_id: string | null;
    credit_card_invoice_id?: string | null;
    amount: number;
    description: string;
    category_id: string | null;
    is_installment: boolean | null;
  }>;
  categories: Array<{ id: string; name: string }>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const current = computeInvoicePeriod(today, card);
  const next = computeInvoicePeriod(shiftMonth(today, 1), card);
  const curInv = findInvoice(invoices, card.id, current.referenceMonth);
  const nextInv = findInvoice(invoices, card.id, next.referenceMonth);

  const invoiceTxs = txs.filter(
    (t) =>
      t.credit_card_id === card.id &&
      (t.credit_card_invoice_id === curInv?.id ||
        t.credit_card_invoice_id === nextInv?.id),
  );

  const byCategory = new Map<string, number>();
  let biggest = { desc: "", amount: 0 };
  let installmentsFuture = 0;

  for (const t of invoiceTxs) {
    const abs = Math.abs(Number(t.amount));
    const catId = t.category_id ?? "sem";
    byCategory.set(catId, (byCategory.get(catId) ?? 0) + abs);
    if (abs > biggest.amount) biggest = { desc: t.description, amount: abs };
    if (t.is_installment && t.credit_card_invoice_id === nextInv?.id) {
      installmentsFuture += abs;
    }
  }

  const topCats = Array.from(byCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, v]) => ({
      name: categories.find((c) => c.id === id)?.name ?? "Sem categoria",
      total: v,
    }));

  const insight = (() => {
    if (!nextInv || nextInv.total_amount === 0) {
      return "A próxima fatura ainda está limpa. É um bom momento para respirar antes da próxima compra planejada.";
    }
    const topName = topCats[0]?.name ?? "compras";
    return `Sua próxima fatura já tem ${brl(nextInv.total_amount)} comprometidos antes mesmo do fechamento. A maior concentração está em ${topName}.`;
  })();

  return (
    <div className="card-soft space-y-4 p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            {card.name}
          </div>
          <div className="font-serif text-xl">
            {brl((curInv?.total_amount ?? 0) + (nextInv?.total_amount ?? 0))}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              comprometido nas próximas duas faturas
            </span>
          </div>
        </div>
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-surface-soft p-3">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Atual
          </div>
          <div className="font-serif text-lg">{brl(curInv?.total_amount ?? 0)}</div>
        </div>
        <div className="rounded-xl bg-surface-soft p-3">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Próxima
          </div>
          <div className="font-serif text-lg">{brl(nextInv?.total_amount ?? 0)}</div>
        </div>
      </div>

      {topCats.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Onde mais pesa
          </div>
          <ul className="mt-2 space-y-1.5 text-sm">
            {topCats.map((c) => (
              <li key={c.name} className="flex items-center justify-between">
                <span>{c.name}</span>
                <span className="text-muted-foreground">{brl(c.total)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {biggest.amount > 0 && (
        <div className="text-xs text-muted-foreground">
          Maior gasto: <span className="text-foreground">{biggest.desc}</span> ·{" "}
          {brl(biggest.amount)}
        </div>
      )}

      {installmentsFuture > 0 && (
        <div className="flex items-start gap-2 rounded-xl bg-clay-soft p-3 text-xs text-ink-soft ring-1 ring-clay/20">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-clay" />
          <span>
            {brl(installmentsFuture)} da próxima fatura já são parcelamentos de compras
            anteriores.
          </span>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl bg-gold-soft p-3 text-xs text-ink-soft ring-1 ring-gold/20">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 text-gold" />
        <span>{insight}</span>
      </div>
    </div>
  );
}

function EmptyCards({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="card-soft bg-gold-soft p-8 text-center ring-1 ring-gold/20">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-background/60">
        <CreditCardIcon className="h-6 w-6 text-ink" />
      </div>
      <h3 className="mt-4 font-serif text-2xl">Cadastre seu primeiro cartão</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
        Cadastre seu primeiro cartão para entender melhor quando seus gastos realmente
        impactam seu mês.
      </p>
      <button
        onClick={onCreate}
        className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs text-background hover:opacity-90"
      >
        <Plus className="h-3.5 w-3.5" /> Cadastrar cartão
      </button>
    </div>
  );
}
