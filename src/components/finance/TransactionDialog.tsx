import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  useAccounts,
  useCategories,
  useCreateCategory,
  useCreateTransaction,
  useProjects,
  useSubcategories,
  useUpdateTransaction,
} from "@/lib/finance-hooks";
import type { Transaction, TxInput } from "@/lib/finance-api";
import {
  MANUAL_TRANSACTION_TYPES,
  type SuggestedTransactionType,
} from "@/lib/finance-domain";

const TYPE_LABELS: Record<SuggestedTransactionType, string> = {
  income: "Receita",
  expense: "Despesa",
  transfer: "Transferência",
};

const PAYMENT_METHODS = [
  { v: "pix", l: "Pix" },
  { v: "debit", l: "Débito" },
  { v: "credit", l: "Crédito" },
  { v: "cash", l: "Dinheiro" },
  { v: "transfer", l: "Transferência" },
  { v: "boleto", l: "Boleto" },
];

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function TransactionDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: Transaction | null;
}) {
  const [type, setType] = useState<SuggestedTransactionType>("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [competence, setCompetence] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [subcategoryId, setSubcategoryId] = useState<string>("");
  const [accountId, setAccountId] = useState<string>("");
  const [destinationAccountId, setDestinationAccountId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentTotal, setInstallmentTotal] = useState("");
  const [installmentNumber, setInstallmentNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  const { data: categories = [] } = useCategories();
  const { data: subcategories = [] } = useSubcategories();
  const { data: accounts = [] } = useAccounts();
  const { data: projects = [] } = useProjects();

  const createTx = useCreateTransaction();
  const updateTx = useUpdateTransaction();
  const createCat = useCreateCategory();

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setType(editing.type === "credit_card_purchase" ? "expense" : editing.type);
      setDescription(editing.description);
      setAmount(String(Math.abs(Number(editing.amount))));
      setDate(editing.transaction_date?.slice(0, 10) ?? todayISO());
      setCompetence(editing.competence_date?.slice(0, 10) ?? "");
      setCategoryId(editing.category_id ?? "");
      setSubcategoryId(editing.subcategory_id ?? "");
      setAccountId(editing.financial_account_id ?? "");
      setDestinationAccountId(
        typeof editing.metadata?.destination_account_id === "string"
          ? editing.metadata.destination_account_id
          : "",
      );
      setProjectId(editing.project_id ?? "");
      setPaymentMethod(editing.payment_method ?? "");
      setIsRecurring(!!editing.is_recurring);
      setIsInstallment(!!editing.is_installment);
      setInstallmentNumber(
        editing.installment_number != null ? String(editing.installment_number) : "",
      );
      setInstallmentTotal(
        editing.installment_total != null ? String(editing.installment_total) : "",
      );
      setNotes(editing.notes ?? "");
      setShowAdvanced(
        !!(editing.project_id || editing.is_recurring || editing.is_installment || editing.notes),
      );
    } else {
      setType("expense");
      setDescription("");
      setAmount("");
      setDate(todayISO());
      setCompetence("");
      setCategoryId("");
      setSubcategoryId("");
      setAccountId("");
      setDestinationAccountId("");
      setProjectId("");
      setPaymentMethod("");
      setIsRecurring(false);
      setIsInstallment(false);
      setInstallmentNumber("");
      setInstallmentTotal("");
      setNotes("");
      setShowAdvanced(false);
    }
  }, [editing, open]);

  const filteredSubs = subcategories.filter((s) => s.category_id === categoryId);
  const needsAccount = true;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      toast.error("Escreva uma descrição para essa movimentação.");
      return;
    }
    const numeric = Number(amount.replace(",", "."));
    if (!Number.isFinite(numeric) || numeric <= 0) {
      toast.error("Informe um valor válido, maior que zero.");
      return;
    }
    if (!accountId) {
      toast.error("Selecione uma conta financeira.");
      return;
    }
    if (type === "transfer") {
      if (!destinationAccountId) {
        toast.error("Selecione a conta de destino da transferência.");
        return;
      }
      if (accountId === destinationAccountId) {
        toast.error("A conta de origem e a conta de destino precisam ser diferentes.");
        return;
      }
    }
    const signed =
      type === "income" ? Math.abs(numeric) : type === "expense" ? -Math.abs(numeric) : -Math.abs(numeric);

    const input: TxInput = {
      type,
      description: description.trim(),
      amount: signed,
      transaction_date: date,
      competence_date: competence || null,
      category_id: categoryId || null,
      subcategory_id: subcategoryId || null,
      financial_account_id: needsAccount ? accountId || null : null,
      credit_card_id: null,
      project_id: projectId || null,
      payment_method: paymentMethod || null,
      is_recurring: isRecurring,
      is_installment: isInstallment,
      installment_number: isInstallment && installmentNumber ? Number(installmentNumber) : null,
      installment_total: isInstallment && installmentTotal ? Number(installmentTotal) : null,
      notes: notes.trim() || null,
      metadata:
        type === "transfer"
          ? {
              destination_account_id: destinationAccountId,
              transfer_direction: "between_accounts",
              affects_income_expense: false,
            }
          : null,
    };

    try {
      if (editing) {
        await updateTx.mutateAsync({ id: editing.id, input });
        toast.success("Movimentação atualizada.");
      } else {
        await createTx.mutateAsync(input);
        toast.success("Movimentação registrada.");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    }
  }

  async function handleCreateCategory() {
    const name = newCatName.trim();
    if (!name) return;
    try {
      const cat = await createCat.mutateAsync(name);
      setCategoryId(cat.id);
      setNewCatName("");
      toast.success(`Categoria "${name}" criada.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar categoria.");
    }
  }

  const saving = createTx.isPending || updateTx.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {editing ? "Editar movimentação" : "Nova movimentação"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Registrar com clareza é o primeiro passo para uma vida financeira alinhada.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-3 gap-2">
            {MANUAL_TRANSACTION_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={
                  type === t
                    ? "rounded-full bg-ink px-3 py-2 text-xs font-medium text-background"
                    : "rounded-full border border-border bg-surface px-3 py-2 text-xs hover:bg-secondary"
                }
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input
                id="amount"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              placeholder="Ex: Mercado, salário, aporte poupança..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-1.5">
                <Input
                  placeholder="Nova categoria"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCreateCategory}
                  disabled={createCat.isPending || !newCatName.trim()}
                >
                  +
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Subcategoria</Label>
              <Select
                value={subcategoryId}
                onValueChange={setSubcategoryId}
                disabled={!categoryId || filteredSubs.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={filteredSubs.length ? "Opcional" : "—"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredSubs.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {needsAccount && (
            <div className="space-y-1.5">
              <Label>Conta financeira</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={accounts.length ? "Selecionar conta" : "Nenhuma conta cadastrada"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                      {a.institution ? ` · ${a.institution}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {type === "transfer" && (
            <div className="space-y-1.5">
              <Label>Conta de destino</Label>
              <Select value={destinationAccountId} onValueChange={setDestinationAccountId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={accounts.length ? "Selecionar destino" : "Nenhuma conta cadastrada"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                      {account.institution ? ` · ${account.institution}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Forma de pagamento</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Opcional" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((p) => (
                  <SelectItem key={p.v} value={p.v}>
                    {p.l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {showAdvanced ? "Ocultar opções avançadas" : "Mostrar opções avançadas"}
          </button>

          {showAdvanced && (
            <div className="space-y-4 rounded-xl border border-border/60 bg-surface-soft p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Data de competência</Label>
                  <Input
                    type="date"
                    value={competence}
                    onChange={(e) => setCompetence(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Projeto vinculado</Label>
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-background/60 px-3 py-2">
                <div>
                  <div className="text-sm">Recorrente</div>
                  <div className="text-xs text-muted-foreground">
                    Se repete todo mês (ex: assinatura, salário).
                  </div>
                </div>
                <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
              </div>

              <div className="rounded-lg bg-background/60 px-3 py-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm">Parcelada</div>
                    <div className="text-xs text-muted-foreground">
                      Ex: compra em 12x no cartão.
                    </div>
                  </div>
                  <Switch checked={isInstallment} onCheckedChange={setIsInstallment} />
                </div>
                {isInstallment && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      min={1}
                      placeholder="Parcela atual"
                      value={installmentNumber}
                      onChange={(e) => setInstallmentNumber(e.target.value)}
                    />
                    <Input
                      type="number"
                      min={1}
                      placeholder="Total de parcelas"
                      value={installmentTotal}
                      onChange={(e) => setInstallmentTotal(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Observações</Label>
                <Textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Algo que você queira lembrar sobre essa movimentação."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : editing ? "Salvar alterações" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
