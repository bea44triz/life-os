import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useAuth } from "./auth-context";

export type DashboardData = {
  balance: number;
  income: number;
  expenses: number;
  accountsCount: number;
  cardsCount: number;
  projectsCount: number;
  hasAnyData: boolean;
  loading: boolean;
};

export function useDashboardData(): DashboardData {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["dashboard", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

      const [accountsRes, cardsRes, projectsRes, txRes] = await Promise.all([
        supabase.from("financial_accounts").select("current_balance").eq("user_id", user!.id),
        supabase.from("credit_cards").select("id").eq("user_id", user!.id),
        supabase.from("projects").select("id").eq("user_id", user!.id),
        supabase
          .from("transactions")
          .select("amount, type, transaction_date")
          .eq("user_id", user!.id)
          .gte("transaction_date", monthStart)
          .lt("transaction_date", monthEnd),
      ]);

      const balance =
        accountsRes.data?.reduce(
          (a, r) => a + Number((r as { current_balance: number }).current_balance ?? 0),
          0,
        ) ?? 0;

      let income = 0;
      let expenses = 0;
      for (const t of (txRes.data ?? []) as Array<{ amount: number; type?: string }>) {
        const v = Number(t.amount);
        if (t.type === "income") income += Math.abs(v);
        else if (t.type === "expense") expenses += Math.abs(v);
        // transfers and credit_card_purchase are intentionally excluded here
      }

      const accountsCount = accountsRes.data?.length ?? 0;
      const cardsCount = cardsRes.data?.length ?? 0;
      const projectsCount = projectsRes.data?.length ?? 0;

      return {
        balance,
        income,
        expenses,
        accountsCount,
        cardsCount,
        projectsCount,
        hasAnyData:
          accountsCount > 0 ||
          cardsCount > 0 ||
          projectsCount > 0 ||
          (txRes.data?.length ?? 0) > 0,
      };
    },
  });

  return {
    balance: query.data?.balance ?? 0,
    income: query.data?.income ?? 0,
    expenses: query.data?.expenses ?? 0,
    accountsCount: query.data?.accountsCount ?? 0,
    cardsCount: query.data?.cardsCount ?? 0,
    projectsCount: query.data?.projectsCount ?? 0,
    hasAnyData: query.data?.hasAnyData ?? false,
    loading: query.isLoading,
  };
}
