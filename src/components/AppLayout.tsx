import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Wallet,
  BookHeart,
  Sparkles,
  Target,
  Repeat,
  Settings,
  LogOut,
  CreditCard,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

const nav: NavItem[] = [
  { to: "/", label: "Hoje", icon: LayoutDashboard },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/cartoes", label: "Cartões", icon: CreditCard },
  { to: "/importar", label: "Importar", icon: UploadCloud },
  { to: "/projetos", label: "Projetos", icon: Target },
  { to: "/habitos", label: "Hábitos", icon: Repeat },
  { to: "/diario", label: "Diário", icon: BookHeart },
  { to: "/mentor", label: "Mentor IA", icon: Sparkles },
  { to: "/configuracoes", label: "Ajustes", icon: Settings },
];

// Items shown in the mobile bottom nav (compact set)
const mobileNav = nav.filter(
  (n) => n.to !== "/configuracoes" && n.to !== "/diario" && n.to !== "/habitos",
);

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "Você";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1400px]">
        {/* Sidebar - desktop only */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-1 border-r border-border/60 bg-background/60 px-5 py-8 lg:flex">
          <Link to="/" className="mb-8 flex items-center gap-2 px-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-background">
              <span className="font-serif text-lg italic">L</span>
            </div>
            <div>
              <div className="font-serif text-lg leading-none">Life OS</div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                seu mentor pessoal
              </div>
            </div>
          </Link>

          <nav className="flex flex-col gap-0.5">
            {nav.map((item) => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-2xl border border-border/60 bg-surface-soft p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-ink text-sm text-background">
                {initial}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{displayName}</div>
                <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
              </div>
              <button
                onClick={() => void signOut()}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                title="Sair"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 pb-28 lg:pb-12">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between px-2 py-2">
          {mobileNav.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] transition-colors",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon
                  className={cn("h-5 w-5", active && "stroke-[2]")}
                  strokeWidth={active ? 2 : 1.5}
                />
                <span className="leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
