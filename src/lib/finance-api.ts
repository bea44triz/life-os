import { supabase } from "./supabase";

export type TxType = "income" | "expense" | "transfer" | "credit_card_purchase";
export type TxOrigin =
  | "manual"
  | "import_txt"
  | "import_csv"
  | "import_pdf"
  | "import_ofx"
  | "import_xlsx"
  | "system";
export type TxReviewStatus = "approved" | "pending" | "rejected";

export type Transaction = {
  id: string;
  user_id: string;
  type: TxType;
  description: string;
  amount: number;
  transaction_date: string;
  competence_date: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  financial_account_id: string | null;
  credit_card_id: string | null;
  credit_card_invoice_id: string | null;
  project_id: string | null;
  payment_method: string | null;
  is_recurring: boolean | null;
  is_installment: boolean | null;
  installment_number: number | null;
  installment_total: number | null;
  notes: string | null;
  origin: TxOrigin | null;
  review_status: TxReviewStatus | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  user_id: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  is_default: boolean | null;
};

export type Subcategory = {
  id: string;
  user_id: string | null;
  category_id: string;
  name: string;
};

export type FinancialAccount = {
  id: string;
  user_id: string;
  name: string;
  type: string | null;
  institution: string | null;
  currency: string | null;
  current_balance: number | null;
  initial_balance: number | null;
  is_active: boolean | null;
};

export type CreditCard = {
  id: string;
  user_id: string;
  name: string;
  institution: string | null;
  brand: string | null;
  credit_limit: number | null;
  closing_day: number | null;
  due_day: number | null;
  is_active: boolean | null;
};

export type Project = {
  id: string;
  user_id: string;
  name: string;
  type: string | null;
  status: string | null;
};

export type ProjectInput = {
  name: string;
  type?: string | null;
  status?: string | null;
};

export type Habit = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  frequency: string | null;
  created_at: string;
  updated_at: string;
};

export type HabitInput = {
  name: string;
  description?: string | null;
  frequency?: string | null;
};

export type HabitLog = {
  id: string;
  habit_id: string;
  user_id: string;
  completed: boolean | null;
  created_at: string;
  updated_at: string;
};

export type JournalEntry = {
  id: string;
  user_id: string;
  mood: number;
  energy: number;
  anxiety: number;
  gratitude: string | null;
  content: string;
  created_at: string;
  updated_at: string;
};

export type JournalEntryInput = {
  mood: number;
  energy: number;
  anxiety: number;
  gratitude?: string | null;
  content: string;
};

export type WellbeingLog = {
  id: string;
  user_id: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type WellbeingLogInput = {
  notes: string;
};

export type TxInput = {
  type: TxType;
  description: string;
  amount: number;
  transaction_date: string;
  competence_date?: string | null;
  category_id?: string | null;
  subcategory_id?: string | null;
  financial_account_id?: string | null;
  credit_card_id?: string | null;
  project_id?: string | null;
  payment_method?: string | null;
  is_recurring?: boolean;
  is_installment?: boolean;
  installment_number?: number | null;
  installment_total?: number | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function listTransactions(userId: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Transaction[];
}

export async function listJournalEntries(userId: string): Promise<JournalEntry[]> {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("id, user_id, mood, energy, anxiety, gratitude, content, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as JournalEntry[];
}

export async function listRecentJournalEntries(userId: string, limit = 5): Promise<JournalEntry[]> {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("id, user_id, mood, energy, anxiety, gratitude, content, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as JournalEntry[];
}

export async function createJournalEntry(
  userId: string,
  input: JournalEntryInput,
): Promise<JournalEntry> {
  const { data, error } = await supabase
    .from("journal_entries")
    .insert({
      user_id: userId,
      mood: input.mood,
      energy: input.energy,
      anxiety: input.anxiety,
      gratitude: input.gratitude ?? null,
      content: input.content,
    })
    .select("id, user_id, mood, energy, anxiety, gratitude, content, created_at, updated_at")
    .single();
  if (error) throw error;
  return data as JournalEntry;
}

export async function deleteJournalEntry(userId: string, id: string) {
  const { error } = await supabase
    .from("journal_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function listWellbeingLogs(userId: string): Promise<WellbeingLog[]> {
  const { data, error } = await supabase
    .from("wellbeing_logs")
    .select("id, user_id, notes, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as WellbeingLog[];
}

export async function createWellbeingLog(
  userId: string,
  input: WellbeingLogInput,
): Promise<WellbeingLog> {
  const { data, error } = await supabase
    .from("wellbeing_logs")
    .insert({ user_id: userId, notes: input.notes })
    .select("id, user_id, notes, created_at, updated_at")
    .single();
  if (error) throw error;
  return data as WellbeingLog;
}

export async function deleteWellbeingLog(userId: string, id: string) {
  const { error } = await supabase
    .from("wellbeing_logs")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function createTransaction(userId: string, input: TxInput) {
  const payload = {
    ...input,
    user_id: userId,
    origin: "manual" as TxOrigin,
    review_status: "approved" as TxReviewStatus,
  };
  const { data, error } = await supabase
    .from("transactions")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data as Transaction;
}

export async function updateTransaction(id: string, input: Partial<TxInput>) {
  // Fetch existing to detect credit-card impact
  const { data: prev, error: prevErr } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .single();
  if (prevErr) throw prevErr;
  const prevTx = prev as Transaction;

  const patch: Partial<TxInput> & { credit_card_invoice_id?: string | null } = {
    ...input,
  };

  const isCardPurchase =
    (input.type ?? prevTx.type) === "credit_card_purchase";

  // If date or card changed on a card purchase, reassign invoice
  if (isCardPurchase) {
    const newCardId = input.credit_card_id ?? prevTx.credit_card_id;
    const newDate = input.transaction_date ?? prevTx.transaction_date;
    const dateChanged =
      input.transaction_date && input.transaction_date !== prevTx.transaction_date;
    const cardChanged =
      input.credit_card_id !== undefined &&
      input.credit_card_id !== prevTx.credit_card_id;
    if (newCardId && (dateChanged || cardChanged)) {
      const { getOrCreateInvoice } = await import("./credit-cards");
      const { data: card, error: cardErr } = await supabase
        .from("credit_cards")
        .select("*")
        .eq("id", newCardId)
        .single();
      if (cardErr) throw cardErr;
      const invoice = await getOrCreateInvoice(
        prevTx.user_id,
        card as CreditCard,
        newDate,
      );
      patch.credit_card_invoice_id = invoice.id;
    }
  }

  const { data, error } = await supabase
    .from("transactions")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;

  // Recalc affected invoices (old + new if different)
  const affected = new Set<string>();
  if (prevTx.credit_card_invoice_id) affected.add(prevTx.credit_card_invoice_id);
  const newInvoiceId =
    (data as Transaction).credit_card_invoice_id ?? null;
  if (newInvoiceId) affected.add(newInvoiceId);
  if (affected.size > 0) {
    const { recalcInvoiceTotal } = await import("./credit-cards");
    await Promise.all(Array.from(affected).map(recalcInvoiceTotal));
  }

  return data as Transaction;
}

export async function deleteTransaction(id: string) {
  const { data: prev, error: prevErr } = await supabase
    .from("transactions")
    .select("credit_card_invoice_id, type")
    .eq("id", id)
    .single();
  if (prevErr) throw prevErr;
  const invoiceId = (prev as { credit_card_invoice_id: string | null })
    .credit_card_invoice_id;

  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw error;

  if (invoiceId) {
    const { recalcInvoiceTotal } = await import("./credit-cards");
    await recalcInvoiceTotal(invoiceId);
  }
}

export async function listCategories(userId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from("transaction_categories")
    .select("*")
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .order("name");
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function createCategory(userId: string, name: string): Promise<Category> {
  const { data, error } = await supabase
    .from("transaction_categories")
    .insert({ user_id: userId, name, is_default: false })
    .select("*")
    .single();
  if (error) throw error;
  return data as Category;
}

export async function listSubcategories(userId: string): Promise<Subcategory[]> {
  const { data, error } = await supabase
    .from("transaction_subcategories")
    .select("*")
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .order("name");
  if (error) throw error;
  return (data ?? []) as Subcategory[];
}

export async function listAccounts(userId: string): Promise<FinancialAccount[]> {
  const { data, error } = await supabase
    .from("financial_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("name");
  if (error) throw error;
  return (data ?? []) as FinancialAccount[];
}

export async function createAccount(
  userId: string,
  input: {
    name: string;
    type: string;
    institution?: string | null;
    initial_balance: number;
    currency?: string;
  },
): Promise<FinancialAccount> {
  const { data, error } = await supabase
    .from("financial_accounts")
    .insert({
      user_id: userId,
      name: input.name,
      type: input.type,
      institution: input.institution ?? null,
      initial_balance: input.initial_balance,
      current_balance: input.initial_balance,
      currency: input.currency ?? "BRL",
      is_active: true,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as FinancialAccount;
}

export async function listCreditCards(userId: string): Promise<CreditCard[]> {
  const { data, error } = await supabase
    .from("credit_cards")
    .select("*")
    .eq("user_id", userId)
    .order("name");
  if (error) throw error;
  return (data ?? []) as CreditCard[];
}

export async function listHabits(userId: string): Promise<Habit[]> {
  const { data, error } = await supabase
    .from("habits")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Habit[];
}

export async function createHabit(userId: string, input: HabitInput): Promise<Habit> {
  const payload = {
    user_id: userId,
    name: input.name,
    description: input.description ?? null,
    frequency: input.frequency ?? "diária",
  };
  const { data, error } = await supabase
    .from("habits")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data as Habit;
}

export async function updateHabit(id: string, input: Partial<HabitInput>): Promise<Habit> {
  const { data, error } = await supabase
    .from("habits")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Habit;
}

export async function deleteHabit(id: string) {
  const { error } = await supabase.from("habits").delete().eq("id", id);
  if (error) throw error;
}

export async function listHabitLogs(userId: string): Promise<HabitLog[]> {
  const { data, error } = await supabase
    .from("habit_logs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as HabitLog[];
}

function isSameDay(value: string, compareDate = new Date()) {
  const date = new Date(value);
  return (
    date.getFullYear() === compareDate.getFullYear() &&
    date.getMonth() === compareDate.getMonth() &&
    date.getDate() === compareDate.getDate()
  );
}

export async function markHabitCompleted(userId: string, habitId: string): Promise<HabitLog> {
  const { data: existing, error: existingError } = await supabase
    .from("habit_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("habit_id", habitId)
    .order("created_at", { ascending: false });
  if (existingError) throw existingError;

  const todayEntry = (existing ?? []).find((entry) => entry.completed && isSameDay(entry.created_at));
  if (todayEntry) return todayEntry as HabitLog;

  const { data, error } = await supabase
    .from("habit_logs")
    .insert({ user_id: userId, habit_id: habitId, completed: true })
    .select("*")
    .single();
  if (error) throw error;
  return data as HabitLog;
}

export async function undoHabitCompletion(userId: string, habitId: string) {
  const { data, error } = await supabase
    .from("habit_logs")
    .select("id, created_at, completed")
    .eq("user_id", userId)
    .eq("habit_id", habitId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const idsToDelete = (data ?? [])
    .filter((entry) => entry.completed !== false && isSameDay(entry.created_at))
    .map((entry) => entry.id);

  if (idsToDelete.length === 0) return;

  const { error: deleteError } = await supabase.from("habit_logs").delete().in("id", idsToDelete);
  if (deleteError) throw deleteError;
}

export async function listProjects(userId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("name");
  if (error) throw error;
  return (data ?? []) as Project[];
}

export async function createProject(userId: string, input: ProjectInput): Promise<Project> {
  const payload = {
    user_id: userId,
    name: input.name,
    type: input.type ?? null,
    status: input.status ?? null,
  };

  if (import.meta.env.DEV) {
    console.debug("[projects] Creating project", payload);
  }

  const { data, error } = await supabase
    .from("projects")
    .insert(payload)
    .select("*")
    .single();
  if (error) {
    console.error("[projects] Supabase createProject failed", {
      payload,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      },
    });
    throw new Error(error.message, { cause: error });
  }
  return data as Project;
}

export async function updateProject(
  userId: string,
  projectId: string,
  input: Partial<ProjectInput>,
): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .update(input)
    .eq("id", projectId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Project;
}

export async function deleteProject(userId: string, projectId: string): Promise<void> {
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", userId);
  if (error) throw error;
}
