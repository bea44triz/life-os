import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth-context";
import {
  createAccount,
  createCategory,
  createTransaction,
  deleteTransaction,
  listAccounts,
  listCategories,
  listCreditCards,
  listProjects,
  listSubcategories,
  listTransactions,
  updateTransaction,
  type TxInput,
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
