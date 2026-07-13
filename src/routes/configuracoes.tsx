import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader, Section } from "@/components/ui-bits";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [{ title: "Ajustes — Life OS" }],
  }),
  component: Config,
});

const sections = [
  {
    title: "Conta",
    items: ["Perfil", "E-mail e senha", "Plano e assinatura", "Excluir conta"],
  },
  {
    title: "Privacidade",
    items: ["Quem vê meu diário", "Dados usados pelo mentor", "Exportar meus dados"],
  },
  {
    title: "Personalização",
    items: ["Áreas que acompanho", "Tom do mentor", "Lembretes diários"],
  },
];

function Config() {
  return (
    <>
      <PageHeader eyebrow="Ajustes" title="Seu espaço, do seu jeito." />
      <PageBody>
        {sections.map((s) => (
          <Section key={s.title} title={s.title}>
            <div className="card-soft divide-y divide-border/60">
              {s.items.map((it) => (
                <button
                  key={it}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center px-5 py-4 text-left text-sm transition hover:bg-secondary/50"
                >
                  <span>{it}</span>
                  <span className="text-muted-foreground">›</span>
                </button>
              ))}
            </div>
          </Section>
        ))}
        <p className="pt-6 text-center text-xs text-muted-foreground">
          Life OS · feito com cuidado para acompanhar uma vida inteira.
        </p>
      </PageBody>
    </>
  );
}
