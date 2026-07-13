import { supabase } from "./supabase";
import type { CreditCard } from "./finance-api";

export type CreditCardInput = {
  name: string;
  brand?: string | null;
  institution?: string | null;
  credit_limit?: number | null;
  closing_day: number;
  due_day: number;
  is_active?: boolean;
};

export type CreditCardInvoice = {
  id: string;
  user_id: string;
  credit_card_id: string;
  reference_month: string; // YYYY-MM-01
  opening_date: string | null;
  closing_date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  status: "open" | "closed" | "paid" | "overdue" | string;
  created_at: string;
  updated_at: string;
};

function clampDay(year: number, monthIdx: number, day: number): Date {
  const last = new Date(year, monthIdx + 1, 0).getDate();
  return new Date(year, monthIdx, Math.min(day, last));
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export type InvoicePeriod = {
  referenceMonth: string; // YYYY-MM-01
  openingDate: string;
  closingDate: string;
  dueDate: string;
  label: string; // e.g. "Julho/2026"
  belongsToCurrent: boolean;
};

export function computeInvoicePeriod(
  purchaseISO: string,
  card: Pick<CreditCard, "closing_day" | "due_day">,
): InvoicePeriod {
  const closingDay = card.closing_day ?? 1;
  const dueDay = card.due_day ?? closingDay;
  const [y, m, d] = purchaseISO.split("-").map(Number);
  const purchase = new Date(y, m - 1, d);
  const belongsToCurrent = purchase.getDate() <= closingDay;

  let refYear = purchase.getFullYear();
  let refMonth = purchase.getMonth();
  if (!belongsToCurrent) {
    refMonth += 1;
    if (refMonth > 11) {
      refMonth = 0;
      refYear += 1;
    }
  }

  const closingDate = clampDay(refYear, refMonth, closingDay);
  // Opening is day after previous closing
  const prevMonth = refMonth - 1 < 0 ? 11 : refMonth - 1;
  const prevYear = refMonth - 1 < 0 ? refYear - 1 : refYear;
  const prevClosing = clampDay(prevYear, prevMonth, closingDay);
  const opening = new Date(prevClosing);
  opening.setDate(opening.getDate() + 1);

  // Due date: same reference month, but if due_day < closing_day it lands in following month
  let dueYear = refYear;
  let dueMonth = refMonth;
  if (dueDay < closingDay) {
    dueMonth += 1;
    if (dueMonth > 11) {
      dueMonth = 0;
      dueYear += 1;
    }
  }
  const dueDate = clampDay(dueYear, dueMonth, dueDay);

  const label = closingDate.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return {
    referenceMonth: toISODate(new Date(refYear, refMonth, 1)),
    openingDate: toISODate(opening),
    closingDate: toISODate(closingDate),
    dueDate: toISODate(dueDate),
    label,
    belongsToCurrent,
  };
}

export function bestPurchaseDay(closingDay: number): number {
  const d = (closingDay % 31) + 1;
  return d;
}

// -------- Card CRUD --------

export async function createCreditCard(userId: string, input: CreditCardInput) {
  const { data, error } = await supabase
    .from("credit_cards")
    .insert({
      user_id: userId,
      name: input.name,
      brand: input.brand ?? null,
      institution: input.institution ?? null,
      credit_limit: input.credit_limit ?? null,
      closing_day: input.closing_day,
      due_day: input.due_day,
      is_active: input.is_active ?? true,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as CreditCard;
}

export async function updateCreditCard(id: string, input: Partial<CreditCardInput>) {
  const { data, error } = await supabase
    .from("credit_cards")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as CreditCard;
}

export async function deleteCreditCard(id: string) {
  const { error } = await supabase.from("credit_cards").delete().eq("id", id);
  if (error) throw error;
}

// -------- Invoices --------

export async function listInvoices(userId: string): Promise<CreditCardInvoice[]> {
  const { data, error } = await supabase
    .from("credit_card_invoices")
    .select("*")
    .eq("user_id", userId)
    .order("reference_month", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CreditCardInvoice[];
}

export async function getOrCreateInvoice(
  userId: string,
  card: CreditCard,
  purchaseISO: string,
): Promise<CreditCardInvoice> {
  const period = computeInvoicePeriod(purchaseISO, card);
  const { data: existing, error: e1 } = await supabase
    .from("credit_card_invoices")
    .select("*")
    .eq("user_id", userId)
    .eq("credit_card_id", card.id)
    .eq("reference_month", period.referenceMonth)
    .maybeSingle();
  if (e1) throw e1;
  if (existing) return existing as CreditCardInvoice;

  const { data, error } = await supabase
    .from("credit_card_invoices")
    .insert({
      user_id: userId,
      credit_card_id: card.id,
      reference_month: period.referenceMonth,
      opening_date: period.openingDate,
      closing_date: period.closingDate,
      due_date: period.dueDate,
      total_amount: 0,
      paid_amount: 0,
      status: "open",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as CreditCardInvoice;
}

export async function recalcInvoiceTotal(invoiceId: string) {
  const { data: rows, error } = await supabase
    .from("transactions")
    .select("amount, type, metadata")
    .eq("credit_card_invoice_id", invoiceId);
  if (error) throw error;

  let total = 0;
  let paid = 0;
  for (const r of rows ?? []) {
    const rr = r as {
      amount: number;
      type?: string;
      metadata?: Record<string, unknown> | null;
    };
    const amt = Math.abs(Number(rr.amount ?? 0));
    if (rr.type === "credit_card_purchase") {
      total += amt;
    } else if (rr.type === "transfer") {
      const meta = (rr.metadata ?? {}) as Record<string, unknown>;
      if (meta.movement_type === "credit_card_payment" || meta.invoice_payment === true) {
        paid += amt;
      }
    }
  }

  const { data: inv } = await supabase
    .from("credit_card_invoices")
    .select("status")
    .eq("id", invoiceId)
    .maybeSingle();
  const currentStatus = (inv as { status?: string } | null)?.status ?? "open";
  // Only mark as paid when the invoice actually has charges AND payments cover them.
  const nextStatus =
    total > 0 && paid >= total
      ? "paid"
      : currentStatus === "paid"
        ? "open"
        : currentStatus;

  await supabase
    .from("credit_card_invoices")
    .update({ total_amount: total, paid_amount: paid, status: nextStatus })
    .eq("id", invoiceId);
}

export async function getOrCreateInvoiceByDueDate(
  userId: string,
  card: CreditCard,
  dueDateISO: string,
): Promise<CreditCardInvoice> {
  const { data: existing, error: e1 } = await supabase
    .from("credit_card_invoices")
    .select("*")
    .eq("user_id", userId)
    .eq("credit_card_id", card.id)
    .eq("due_date", dueDateISO)
    .maybeSingle();
  if (e1) throw e1;
  if (existing) return existing as CreditCardInvoice;

  // Anchor a date safely inside the invoice cycle to reuse computeInvoicePeriod.
  const [y, mo, d] = dueDateISO.split("-").map(Number);
  const anchor = new Date(y, mo - 1, d);
  anchor.setDate(anchor.getDate() - 20);
  const anchorISO = toISODate(anchor);
  const period = computeInvoicePeriod(anchorISO, card);

  const { data: byRef, error: e2 } = await supabase
    .from("credit_card_invoices")
    .select("*")
    .eq("user_id", userId)
    .eq("credit_card_id", card.id)
    .eq("reference_month", period.referenceMonth)
    .maybeSingle();
  if (e2) throw e2;
  if (byRef) {
    if ((byRef as CreditCardInvoice).due_date !== dueDateISO) {
      await supabase
        .from("credit_card_invoices")
        .update({ due_date: dueDateISO })
        .eq("id", (byRef as CreditCardInvoice).id);
    }
    return byRef as CreditCardInvoice;
  }

  const { data, error } = await supabase
    .from("credit_card_invoices")
    .insert({
      user_id: userId,
      credit_card_id: card.id,
      reference_month: period.referenceMonth,
      opening_date: period.openingDate,
      closing_date: period.closingDate,
      due_date: dueDateISO,
      total_amount: 0,
      paid_amount: 0,
      status: "open",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as CreditCardInvoice;
}

// -------- Card Purchase --------

export type CardPurchaseInput = {
  card: CreditCard;
  description: string;
  amount: number; // total (positive)
  purchase_date: string; // YYYY-MM-DD
  category_id?: string | null;
  subcategory_id?: string | null;
  project_id?: string | null;
  notes?: string | null;
  installments?: number; // 1 = à vista
};

export type InstallmentPreview = {
  index: number;
  total: number;
  amount: number;
  period: InvoicePeriod;
  transactionDate: string;
};

export function computeInstallmentPlan(input: CardPurchaseInput): InstallmentPreview[] {
  const n = Math.max(1, Math.floor(input.installments ?? 1));
  const per = Math.round((input.amount / n) * 100) / 100;
  const items: InstallmentPreview[] = [];
  const [y, m, d] = input.purchase_date.split("-").map(Number);
  for (let i = 0; i < n; i++) {
    const shifted = new Date(y, m - 1 + i, d);
    const iso = toISODate(shifted);
    items.push({
      index: i + 1,
      total: n,
      amount: i === n - 1 ? +(input.amount - per * (n - 1)).toFixed(2) : per,
      period: computeInvoicePeriod(iso, input.card),
      transactionDate: iso,
    });
  }
  return items;
}

export async function createCardPurchase(userId: string, input: CardPurchaseInput) {
  const plan = computeInstallmentPlan(input);
  const invoiceIds: string[] = [];
  let parentId: string | null = null;

  for (const item of plan) {
    const invoice = await getOrCreateInvoice(userId, input.card, item.transactionDate);
    invoiceIds.push(invoice.id);

    const desc =
      plan.length > 1
        ? `${input.description} (${item.index}/${item.total})`
        : input.description;

    const res: { data: { id: string } | null; error: { message: string } | null } =
      await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          type: "credit_card_purchase",
          description: desc,
          amount: -Math.abs(item.amount),
          transaction_date: item.transactionDate,
          competence_date: input.purchase_date,
          category_id: input.category_id ?? null,
          subcategory_id: input.subcategory_id ?? null,
          credit_card_id: input.card.id,
          credit_card_invoice_id: invoice.id,
          project_id: input.project_id ?? null,
          is_installment: plan.length > 1,
          installment_number: plan.length > 1 ? item.index : null,
          installment_total: plan.length > 1 ? item.total : null,
          parent_transaction_id: parentId,
          notes: input.notes ?? null,
          origin: "manual",
          review_status: "approved",
        })
        .select("id")
        .single();
    if (res.error) throw res.error;
    if (item.index === 1) parentId = res.data?.id ?? null;
  }

  // Recalc totals for touched invoices
  const uniq = Array.from(new Set(invoiceIds));
  await Promise.all(uniq.map(recalcInvoiceTotal));
  return { installments: plan.length };
}
