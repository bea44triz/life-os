import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/redefinir-senha")({
  component: RedefinirSenhaPage,
});

function PasswordField({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="relative mt-1">
        <input
          type={visible ? "text" : "password"}
          required
          minLength={6}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 pr-11 text-sm outline-none focus:border-ink/40"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function RedefinirSenhaPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase's detectSessionInUrl handles the recovery token in the URL hash.
    // We just wait for a session to be established (or not) before rendering.
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session) {
        // Give it a beat for detectSessionInUrl
        setTimeout(() => {
          if (!mounted) return;
          setReady(true);
        }, 400);
      } else {
        setReady(true);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      setReady(true);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (password.length < 6) {
      setError("A senha precisa ter no mínimo 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem. Confira e tente novamente.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setInfo("Sua senha foi atualizada com sucesso.");
      setTimeout(() => {
        navigate({ to: "/" });
      }, 1200);
    } catch (err) {
      const raw = err instanceof Error ? err.message.toLowerCase() : "";
      if (raw.includes("session") || raw.includes("expired") || raw.includes("token")) {
        setError(
          "Seu link de recuperação expirou. Solicite um novo link para continuar.",
        );
      } else {
        setError("Não foi possível atualizar sua senha. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen w-full place-items-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-background">
            <span className="font-serif text-lg italic">L</span>
          </div>
          <div>
            <div className="font-serif text-xl leading-none">Life OS</div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
              seu mentor pessoal
            </div>
          </div>
        </div>

        <div className="card-soft p-7">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-ink-soft">
            <Sparkles className="h-3.5 w-3.5" />
            Redefinir acesso
          </div>
          <h1 className="mt-2 font-serif text-3xl leading-tight text-ink">
            Criar nova senha
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            Digite uma nova senha para acessar sua conta.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-3">
            <PasswordField
              label="Nova senha"
              value={password}
              onChange={setPassword}
              placeholder="mínimo 6 caracteres"
            />
            <PasswordField
              label="Confirmar nova senha"
              value={confirm}
              onChange={setConfirm}
              placeholder="repita a nova senha"
            />

            {error && (
              <div className="rounded-xl bg-clay-soft px-3 py-2 text-xs text-clay">
                {error}
              </div>
            )}
            {info && (
              <div className="rounded-xl bg-sage-soft px-3 py-2 text-xs text-sage">
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !ready}
              className="mt-2 w-full rounded-full bg-ink px-4 py-3 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Salvando..." : "Salvar nova senha"}
            </button>
          </form>

          <button
            onClick={() => navigate({ to: "/" })}
            className="mt-5 w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Voltar para login
          </button>
        </div>
      </div>
    </div>
  );
}
