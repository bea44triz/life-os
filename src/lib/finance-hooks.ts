import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth-context";
import {
  createAccount,
  createCategory,
  createHabit,
  createJournalEntry,
  createTransaction,
  createWellbeingLog,
  deleteHabit,
  deleteJournalEntry,
  deleteTransaction,
  deleteWellbeingLog,
  listAccounts,
  listCategories,
  listCreditCards,
  listHabitLogs,
  listHabits,
  listJournalEntries,
  listProjects,
  listRecentJournalEntries,
  listSubcategories,
  listTransactions,
  listWellbeingLogs,
  markHabitCompleted,
  undoHabitCompletion,
  updateHabit,
  updateTransaction,
  type HabitInput,
  type JournalEntryInput,
  type TxInput,
  type WellbeingLogInput,
} from "./finance-api";
import {
  createCardPurchase,
  createCreditCard,
  deleteCreditCard,
  listInvoices,
  updateCreditCard,
  type CardPurchaseInput,
  type CreditCardInput,
} from "./credit-cards";

export function useTransactions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: () => listTransactions(user!.id),
    enabled: !!user,
  });
}

export function useCategories() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["categories", user?.id],
    queryFn: () => listCategories(user!.id),
    enabled: !!user,
  });
}

export function useSubcategories() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["subcategories", user?.id],
    queryFn: () => listSubcategories(user!.id),
    enabled: !!user,
  });
}

export function useAccounts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["accounts", user?.id],
    queryFn: () => listAccounts(user!.id),
    enabled: !!user,
  });
}

export function useCreditCards() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["credit_cards", user?.id],
    queryFn: () => listCreditCards(user!.id),
    enabled: !!user,
  });
}

export function useProjects() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["projects", user?.id],
    queryFn: () => listProjects(user!.id),
    enabled: !!user,
  });
}

export function useHabits() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["habits", user?.id],
    queryFn: () => listHabits(user!.id),
    enabled: !!user,
  });
}

export function useHabitLogs() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["habit_logs", user?.id],
    queryFn: () => listHabitLogs(user!.id),
    enabled: !!user,
  });
}

export function useJournalEntries() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["journal_entries", user?.id],
    queryFn: () => listJournalEntries(user!.id),
    enabled: !!user,
  });
}

export function useRecentJournalEntries(limit = 5) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["journal_entries", user?.id, "recent", limit],
    queryFn: () => listRecentJournalEntries(user!.id, limit),
    enabled: !!user,
  });
}

export function useWellbeingLogs() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["wellbeing_logs", user?.id],
    queryFn: () => listWellbeingLogs(user!.id),
    enabled: !!user,
  });
}

function invalidateFinance(qc: ReturnType<typeof useQueryClient>, userId?: string) {
  qc.invalidateQueries({ queryKey: ["transactions", userId] });
  qc.invalidateQueries({ queryKey: ["accounts", userId] });
  qc.invalidateQueries({ queryKey: ["credit_cards", userId] });
  qc.invalidateQueries({ queryKey: ["invoices", userId] });
  qc.invalidateQueries({ queryKey: ["dashboard", userId] });
}

export function useInvoices() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["invoices", user?.id],
    queryFn: () => listInvoices(user!.id),
    enabled: !!user,
  });
}

export function useCreateCreditCard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreditCardInput) => createCreditCard(user!.id, input),
    onSuccess: () => invalidateFinance(qc, user?.id),
  });
}

export function useUpdateCreditCard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreditCardInput> }) =>
      updateCreditCard(id, input),
    onSuccess: () => invalidateFinance(qc, user?.id),
  });
}

export function useDeleteCreditCard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCreditCard(id),
    onSuccess: () => invalidateFinance(qc, user?.id),
  });
}

export function useCreateCardPurchase() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CardPurchaseInput) => createCardPurchase(user!.id, input),
    onSuccess: () => invalidateFinance(qc, user?.id),
  });
}

export function useCreateTransaction() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TxInput) => createTransaction(user!.id, input),
    onSuccess: () => invalidateFinance(qc, user?.id),
  });
}

export function useUpdateTransaction() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<TxInput> }) =>
      updateTransaction(id, input),
    onSuccess: () => invalidateFinance(qc, user?.id),
  });
}

export function useDeleteTransaction() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: () => invalidateFinance(qc, user?.id),
  });
}

export function useCreateAccount() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createAccount>[1]) =>
      createAccount(user!.id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts", user?.id] });
      qc.invalidateQueries({ queryKey: ["dashboard", user?.id] });
    },
  });
}

export function useCreateCategory() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createCategory(user!.id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories", user?.id] }),
  });
}

export function useCreateHabit() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: HabitInput) => createHabit(user!.id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits", user?.id] });
      qc.invalidateQueries({ queryKey: ["dashboard", user?.id] });
    },
  });
}

export function useUpdateHabit() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<HabitInput> }) =>
      updateHabit(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits", user?.id] });
    },
  });
}

export function useDeleteHabit() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (id: string) => deleteHabit(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits", user?.id] });
    },
  });
}

export function useMarkHabitCompleted() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (habitId: string) => markHabitCompleted(user!.id, habitId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habit_logs", user?.id] });
      qc.invalidateQueries({ queryKey: ["habits", user?.id] });
    },
  });
}

export function useUndoHabitCompletion() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (habitId: string) => undoHabitCompletion(user!.id, habitId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habit_logs", user?.id] });
      qc.invalidateQueries({ queryKey: ["habits", user?.id] });
    },
  });
}

export function useCreateJournalEntry() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: JournalEntryInput) => createJournalEntry(user!.id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journal_entries", user?.id] }),
  });
}

export function useDeleteJournalEntry() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteJournalEntry(user!.id, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journal_entries", user?.id] }),
  });
}

export function useCreateWellbeingLog() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: WellbeingLogInput) => createWellbeingLog(user!.id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wellbeing_logs", user?.id] }),
  });
}

export function useDeleteWellbeingLog() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteWellbeingLog(user!.id, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wellbeing_logs", user?.id] }),
  });
}
