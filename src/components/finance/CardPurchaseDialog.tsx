import { useEffect, useMemo, useState } from "react";
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
  useCategories,
  useCreateCardPurchase,
  useCreditCards,
  useProjects,
  useSubcategories,
} from "@/lib/finance-hooks";
import { computeInstallmentPlan, computeInvoicePeriod } from "@/lib/credit-cards";
import { brl } from "@/components/ui-bits";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function CardPurchaseDialog({
  open,
  onOpenChange,
  defaultCardId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultCardId?: string | null;
}) {
  const { data: cards = [] } = useCreditCards();
  const { data: categories = [] } = useCategories();
  const { data: subcategories = [] } = useSubcategories();
  const { data: projects = [] } = useProjects();
  const createPurchase = useCreateCardPurchase();

  const [cardId, setCardId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(todayISO());
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [isInstallment, setIsInstallment] = useState(false);
  const [installments, setInstallments] = useState("2");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setCardId(defaultCardId ?? cards[0]?.id ?? "");
    setDescription("");
    setAmount("");
    setPurchaseDate(todayISO());
    setCategoryId("");
    setSubcategoryId("");
    setProjectId("");
    setIsInstallment(false);
    setInstallments("2");
    setNotes("");
  }, [open, defaultCardId, cards]);

  const card = cards.find((c) => c.id === cardId);
  const filteredSubs = subcategories.filter((s) => s.category_id === categoryId);

  const preview = useMemo(() => {
    if (!card) return null;
    const numeric = Number(String(amount).replace(",", "."));
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return computeInstallmentPlan({
      card,
      description: description || "Compra",
      amount: numeric,
      purchase_date: purchaseDate,
      installments: isInstallment ? Number(installments) || 1 : 1,
    });
  }, [card, amount, description, purchaseDate, isInstallment, installments]);

  const firstPeriod = card ? computeInvoicePeriod(purchaseDate, card) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!card) return toast.error("Selecione um cartão.");
    if (!description.trim()) return toast.error("Descreva a compra.");
    const numeric = Number(String(amount).replace(",", "."));
    if (!Number.isFinite(numeric) || numeric <= 0)
      return toast.error("Informe um valor válido.");
    const n = isInstallment ? Math.max(1, Math.floor(Number(installments) || 1)) : 1;
    try {
      await createPurchase.mutateAsync({
        card,
        description: description.trim(),
        amount: numeric,
        purchase_date: purchaseDate,
        category_id: categoryId || null,
        subcategory_id: subcategoryId || null,
        project_id: projectId || null,
        notes: notes.trim() || null,
        installments: n,
      });
      toast.success(
        n > 1
          ? `Compra parcelada em ${n}x registrada com sucesso.`
          : "Compra registrada no cartão.",
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Nova compra no cartão</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Vamos calcular em qual fatura essa compra entra antes de salvar.
          </p>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Cartão</Label>
            <Select value={cardId} onValueChange={setCardId}>
              <SelectTrigger>
                <SelectValue
                  placeholder={cards.length ? "Selecionar cartão" : "Cadastre um cartão primeiro"}
                />
              </SelectTrigger>
              <SelectContent>
                {cards.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.brand ? ` · ${c.brand}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor total (R$)</Label>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data da compra</Label>
              <Input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Mercado, notebook, jantar..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          <div className="rounded-xl bg-surface-soft px-3 py-2.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm">Parcelada</div>
                <div className="text-xs text-muted-foreground">
                  Dividimos o valor pelas parcelas e distribuímos entre as próximas faturas.
                </div>
              </div>
              <Switch checked={isInstallment} onCheckedChange={setIsInstallment} />
            </div>
            {isInstallment && (
              <div className="mt-3">
                <Label className="text-xs">Número de parcelas</Label>
                <Input
                  type="number"
                  min={2}
                  max={48}
                  value={installments}
                  onChange={(e) => setInstallments(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          {card && firstPeriod && (
            <div className="rounded-xl border border-border/60 bg-background/60 p-3">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Impacto previsto
              </div>
              {preview && preview.length === 1 ? (
                <p className="mt-1 text-sm text-ink">
                  Essa compra entra na fatura{" "}
                  <span className="font-medium">{firstPeriod.label}</span>, com vencimento em{" "}
                  <span className="font-medium">
                    {new Date(firstPeriod.dueDate).toLocaleDateString("pt-BR")}
                  </span>
                  .{" "}
                  {firstPeriod.belongsToCurrent
                    ? "Ela cai na fatura atual do cartão."
                    : "Como foi após o fechamento, ela cai na próxima fatura."}
                </p>
              ) : preview ? (
                <div className="mt-2 space-y-1.5">
                  <p className="text-sm text-ink">
                    Total {brl(Number(amount.replace(",", ".")))} em {preview.length}x — uma
                    parcela por fatura:
                  </p>
                  <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-ink-soft">
                    {preview.map((p) => (
                      <li key={p.index} className="flex items-center justify-between">
                        <span>
                          {p.index}/{p.total} · {brl(p.amount)}
                        </span>
                        <span className="text-muted-foreground">
                          fatura {p.period.label} · vence{" "}
                          {new Date(p.period.dueDate).toLocaleDateString("pt-BR")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Preencha o valor para ver em qual fatura essa compra entra.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createPurchase.isPending || !card}>
              {createPurchase.isPending ? "Salvando..." : "Registrar compra"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
