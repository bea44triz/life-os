import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { Sparkles, Eye, EyeOff } from "lucide-react";

type Mode = "signin" | "signup" | "forgot";

function PasswordField({
  value,
  onChange,
  placeholder,
  label,
  minLength = 6,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      {label && <label className="text-xs text-muted-foreground">{label}</label>}
      <div className="relative mt-1">
        <input
          type={visible ? "text" : "password"}
          required
          minLength={minLength}
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

function humanizeAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials") || m.includes("invalid_credentials")) {
    return "E-mail ou senha incorretos. Confira os dados e tente novamente.";
  }
  if (m.includes("email not confirmed")) {
    return "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.";
  }
  if (m.includes("user already registered") || m.includes("already registered")) {
    return "Este e-mail já está cadastrado. Tente entrar ou recuperar sua senha.";
  }
  if (m.includes("password should be")) {
    return "A senha precisa ter no mínimo 6 caracteres.";
  }
  return "Algo deu errado. Tente novamente em instantes.";
}

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        if (!data.session) {
          setInfo("Enviamos um email para confirmar seu cadastro.");
        }
      } else {
        // forgot
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/redefinir-senha",
        });
        // Do not disclose whether the email exists
        setInfo(
          "Se este e-mail estiver cadastrado, enviaremos um link de recuperação.",
        );
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      setError(humanizeAuthError(raw));
    } finally {
      setLoading(false);
    }
  }

  const title =
    mode === "signin"
      ? "Entre para continuar sua jornada."
      : mode === "signup"
        ? "Vamos construir sua vida com clareza."
        : "Recuperar senha";

  const subtitle =
    mode === "signin"
      ? "Suas finanças, hábitos, humor e projetos — em um só lugar."
      : mode === "signup"
        ? "Crie sua conta e conecte tudo o que importa para você."
        : "Informe seu e-mail e enviaremos um link para você criar uma nova senha.";

  const eyebrow =
    mode === "signin"
      ? "Bem-vindo de volta"
      : mode === "signup"
        ? "Comece agora"
        : "Vamos te ajudar";

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
            {eyebrow}
          </div>
          <h1 className="mt-2 font-serif text-3xl leading-tight text-ink">{title}</h1>
          <p className="mt-2 text-sm text-ink-soft">{subtitle}</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-3">
            {mode === "signup" && (
              <div>
                <label className="text-xs text-muted-foreground">Nome</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-ink/40"
                  placeholder="Como você quer ser chamado"
                />
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-ink/40"
                placeholder="voce@email.com"
              />
            </div>

            {mode !== "forgot" && (
              <PasswordField
                label="Senha"
                value={password}
                onChange={setPassword}
                placeholder="mínimo 6 caracteres"
              />
            )}

            {error && (
              <div className="rounded-xl bg-clay-soft px-3 py-2 text-xs text-clay">{error}</div>
            )}
            {info && (
              <div className="rounded-xl bg-sage-soft px-3 py-2 text-xs text-sage">{info}</div>
            )}

            {mode === "signin" && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="text-xs text-ink-soft underline-offset-4 transition hover:text-ink hover:underline"
                >
                  Esqueci minha senha
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-full bg-ink px-4 py-3 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
            >
              {loading
                ? "Carregando..."
                : mode === "signin"
                  ? "Entrar"
                  : mode === "signup"
                    ? "Criar minha conta"
                    : "Enviar link de recuperação"}
            </button>
          </form>

          {mode === "forgot" ? (
            <button
              onClick={() => switchMode("signin")}
              className="mt-5 w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              Voltar para login
            </button>
          ) : (
            <button
              onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
              className="mt-5 w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              {mode === "signin"
                ? "Ainda não tem conta? Criar agora"
                : "Já tem conta? Entrar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
