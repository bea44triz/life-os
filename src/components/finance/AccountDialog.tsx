import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { useCreateAccount } from "@/lib/finance-hooks";

const ACCOUNT_TYPES = [
  { v: "checking", l: "Conta corrente" },
  { v: "savings", l: "Poupança" },
  { v: "investment", l: "Investimentos" },
  { v: "wallet", l: "Carteira digital" },
  { v: "cash", l: "Dinheiro" },
];

export function AccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("checking");
  const [institution, setInstitution] = useState("");
  const [initialBalance, setInitialBalance] = useState("");

  const createAcc = useCreateAccount();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Dê um nome para a conta.");
      return;
    }
    try {
      await createAcc.mutateAsync({
        name: name.trim(),
        type,
        institution: institution.trim() || null,
        initial_balance: Number(initialBalance.replace(",", ".")) || 0,
        currency: "BRL",
      });
      toast.success("Conta criada com sucesso.");
      setName("");
      setInstitution("");
      setInitialBalance("");
      setType("checking");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar conta.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Nova conta financeira</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Onde seu dinheiro realmente está. Você pode ajustar depois.
          </p>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome da conta</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Conta principal"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t.v} value={t.v}>
                      {t.l}
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
                placeholder="Itaú, Nubank..."
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Saldo inicial (R$)</Label>
            <Input
              inputMode="decimal"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              placeholder="0,00"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createAcc.isPending}>
              {createAcc.isPending ? "Salvando..." : "Criar conta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
