import { createFileRoute } from "@tanstack/react-router";
import { FolderKanban, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/ui-bits";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
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
  useCreateProject,
  useDeleteProject,
  useProjects,
  useUpdateProject,
} from "@/lib/finance-hooks";
import type { Project } from "@/lib/finance-api";

export const Route = createFileRoute("/projetos")({
  head: () => ({
    meta: [
      { title: "Projetos \u2014 Life OS" },
      { name: "description", content: "Seus projetos de vida em um s\u00f3 lugar." },
    ],
  }),
  component: Projetos,
});

type ProjectForm = { name: string; type: string; status: string };
const emptyForm: ProjectForm = { name: "", type: "", status: "" };

function ProjectDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
}) {
  const [form, setForm] = useState<ProjectForm>(emptyForm);
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const isPending = createProject.isPending || updateProject.isPending;

  useEffect(() => {
    if (!open) return;
    setForm(
      project
        ? { name: project.name, type: project.type ?? "", status: project.status ?? "" }
        : emptyForm,
    );
  }, [open, project]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      toast.error("Informe o nome do projeto.");
      return;
    }

    const input = {
      name,
      type: form.type.trim() || null,
      status: form.status.trim() || null,
    };

    try {
      if (project) {
        await updateProject.mutateAsync({ id: project.id, input });
        toast.success("Projeto atualizado com sucesso.");
      } else {
        await createProject.mutateAsync(input);
        toast.success("Projeto criado com sucesso.");
      }
      onOpenChange(false);
    } catch (error) {
      const fallback = project
        ? "N\u00e3o foi poss\u00edvel atualizar o projeto."
        : "N\u00e3o foi poss\u00edvel criar o projeto.";
      toast.error(error instanceof Error ? error.message : fallback);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {project ? "Editar projeto" : "Novo projeto"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Use apenas os dados j&aacute; definidos para este projeto.
          </p>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="project-name">Nome do projeto</Label>
            <Input
              id="project-name"
              value={form.name}
              onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))}
              placeholder={"Ex: Organizar a mudan\u00e7a"}
              autoFocus
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-type">Tipo ou categoria</Label>
            <Input
              id="project-type"
              value={form.type}
              onChange={(event) => setForm((value) => ({ ...value, type: event.target.value }))}
              placeholder="Ex: Pessoal"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-status">Status</Label>
            <Input
              id="project-status"
              value={form.status}
              onChange={(event) => setForm((value) => ({ ...value, status: event.target.value }))}
              placeholder="Ex: Em andamento"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Salvando..."
                : project
                  ? "Salvar altera\u00e7\u00f5es"
                  : "Criar projeto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProjectCard({
  project,
  onEdit,
  onDelete,
}: {
  project: Project;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="card-soft p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold-soft text-gold">
          <FolderKanban className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-2xl leading-tight">{project.name}</h2>
          {(project.type || project.status) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {project.type && (
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
                  {project.type}
                </span>
              )}
              {project.status && (
                <span className="rounded-full bg-sage-soft px-2.5 py-1 text-xs text-sage">
                  {project.status}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-2 border-t border-border/50 pt-4">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-2 text-xs font-medium text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" /> Editar
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-2 text-xs font-medium text-foreground"
        >
          <Trash2 className="h-3.5 w-3.5" /> Excluir
        </button>
      </div>
    </article>
  );
}

function Projetos() {
  const projectsQuery = useProjects();
  const deleteProject = useDeleteProject();
  const projects = projectsQuery.data ?? [];
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  function openCreate() {
    setEditingProject(null);
    setDialogOpen(true);
  }

  function openEdit(project: Project) {
    setEditingProject(project);
    setDialogOpen(true);
  }

  async function confirmDelete() {
    if (!projectToDelete) return;
    try {
      await deleteProject.mutateAsync(projectToDelete.id);
      toast.success("Projeto exclu\u00eddo com sucesso.");
      setProjectToDelete(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "N\u00e3o foi poss\u00edvel excluir o projeto.",
      );
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Projetos"
        title={"O que d\u00e1 dire\u00e7\u00e3o \u00e0 sua vida."}
        subtitle="Organize seus projetos com os dados que realmente existem hoje."
        action={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-xs font-medium text-background"
          >
            <Plus className="h-3.5 w-3.5" /> Novo projeto
          </button>
        }
      />
      <PageBody>
        {projectsQuery.isLoading ? (
          <div className="card-soft p-6 text-center text-sm text-muted-foreground">
            Carregando seus projetos...
          </div>
        ) : projectsQuery.isError ? (
          <div className="card-soft p-6 text-center">
            <h2 className="font-serif text-2xl">
              N&atilde;o foi poss&iacute;vel carregar seus projetos
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Verifique sua conex&atilde;o e tente novamente.
            </p>
            <button
              type="button"
              onClick={() => projectsQuery.refetch()}
              className="mt-4 rounded-full bg-secondary px-4 py-2.5 text-xs font-medium text-foreground"
            >
              Tentar novamente
            </button>
          </div>
        ) : projects.length === 0 ? (
          <div className="card-soft p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-soft text-gold">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div className="mt-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Sem projetos ainda
            </div>
            <h2 className="mt-3 font-serif text-2xl">Nenhum projeto encontrado</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Crie seu primeiro projeto para come&ccedil;ar a organizar o que importa.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 rounded-full bg-ink px-4 py-2.5 text-xs font-medium text-background"
            >
              Criar primeiro projeto
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onEdit={() => openEdit(project)}
                onDelete={() => setProjectToDelete(project)}
              />
            ))}
          </div>
        )}
      </PageBody>
      <ProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} project={editingProject} />
      <AlertDialog
        open={projectToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleteProject.isPending) setProjectToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              {projectToDelete
                ? 'O projeto "' +
                  projectToDelete.name +
                  '" ser\u00e1 exclu\u00eddo. Esta a\u00e7\u00e3o n\u00e3o pode ser desfeita.'
                : "Esta a\u00e7\u00e3o n\u00e3o pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProject.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
              disabled={deleteProject.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteProject.isPending ? "Excluindo..." : "Excluir projeto"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
