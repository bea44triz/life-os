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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useCreateCreditCard, useUpdateCreditCard } from "@/lib/finance-hooks";
import type { CreditCard } from "@/lib/finance-api";
import { bestPurchaseDay } from "@/lib/credit-cards";

const BRANDS = ["Visa", "Mastercard", "Elo", "American Express", "Hipercard", "Outro"];

export function CreditCardDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: CreditCard | null;
}) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("Mastercard");
  const [institution, setInstitution] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [closingDay, setClosingDay] = useState("5");
  const [dueDay, setDueDay] = useState("12");
  const [isActive, setIsActive] = useState(true);

  const create = useCreateCreditCard();
  const update = useUpdateCreditCard();

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setBrand(editing.brand ?? "Mastercard");
      setInstitution(editing.institution ?? "");
      setCreditLimit(editing.credit_limit != null ? String(editing.credit_limit) : "");
      setClosingDay(String(editing.closing_day ?? 5));
      setDueDay(String(editing.due_day ?? 12));
      setIsActive(editing.is_active ?? true);
    } else {
      setName("");
      setBrand("Mastercard");
      setInstitution("");
      setCreditLimit("");
      setClosingDay("5");
      setDueDay("12");
      setIsActive(true);
    }
  }, [open, editing]);

  const cd = Number(closingDay) || 1;
  const dd = Number(dueDay) || 1;
  const best = bestPurchaseDay(cd);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Dê um nome para o cartão.");
      return;
    }
    if (cd < 1 || cd > 31 || dd < 1 || dd > 31) {
      toast.error("Os dias de fechamento e vencimento devem estar entre 1 e 31.");
      return;
    }
    const payload = {
      name: name.trim(),
      brand: brand || null,
      institution: institution.trim() || null,
      credit_limit: creditLimit ? Number(creditLimit.replace(",", ".")) : null,
      closing_day: cd,
      due_day: dd,
      is_active: isActive,
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, input: payload });
        toast.success("Cartão atualizado.");
      } else {
        await create.mutateAsync(payload);
        toast.success("Cartão cadastrado.");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    }
  }

  const saving = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {editing ? "Editar cartão" : "Novo cartão de crédito"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Entender quando fecha e quando vence é o primeiro passo para dominar o seu cartão.
          </p>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome do cartão</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Nubank, XP Visa Infinite..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Bandeira</Label>
              <Select value={brand} onValueChange={setBrand}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BRANDS.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Instituição</Label>
              <Input
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="Nubank, Itaú..."
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Limite (R$)</Label>
            <Input
              inputMode="decimal"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              placeholder="0,00"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fecha no dia</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={closingDay}
                onChange={(e) => setClosingDay(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Vence no dia</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="rounded-xl bg-gold-soft px-3 py-2.5 text-xs text-ink-soft ring-1 ring-gold/20">
            Melhor dia para compras planejadas:{" "}
            <span className="font-medium text-ink">dia {best}</span>. Compras nesse dia entram
            na fatura mais distante, dando o máximo de fôlego até o vencimento.
          </div>

          <div className="flex items-center justify-between rounded-lg bg-surface-soft px-3 py-2">
            <div>
              <div className="text-sm">Cartão ativo</div>
              <div className="text-xs text-muted-foreground">
                Desative para pausar sem excluir o histórico.
              </div>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar cartão"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
