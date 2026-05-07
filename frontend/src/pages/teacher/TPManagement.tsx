import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useTeacherTopics } from "@/hooks/useTopics";
import { Plus, Edit, Archive, ArchiveRestore, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { CreateTopicRequest, TopicResponse } from "@/types/api";

const NIVEAU_LABELS: Record<number, string> = {
  1: "Débutant",
  2: "Intermédiaire",
  3: "Avancé",
  4: "Expert",
  5: "Expert+",
};

const difficultyColor: Record<string, string> = {
  "Débutant": "bg-success/10 text-success border-success/20",
  "Intermédiaire": "bg-warning/10 text-warning border-warning/20",
  "Avancé": "bg-destructive/10 text-destructive border-destructive/20",
  "Expert": "bg-destructive/10 text-destructive border-destructive/20",
  "Expert+": "bg-destructive/10 text-destructive border-destructive/20",
};

const DOMAIN_ICONS: Record<string, string> = {
  "Algorithmique": "🔢",
  "Python": "🐍",
  "Data Science": "📊",
  "Machine Learning": "🤖",
};

const DOMAINS = [
  "Algorithmique", "Python", "Data Science", "Machine Learning",
  "Structures de données", "Java", "Réseaux", "Bases de données",
];

interface TopicFormState {
  title: string;
  domaine: string;
  description: string;
  niveauMin: number;
}

function emptyForm(): TopicFormState {
  return { title: "", domaine: "", description: "", niveauMin: 3 };
}

function topicToForm(t: TopicResponse): TopicFormState {
  return {
    title: t.title,
    domaine: t.domaine ?? "",
    description: t.description ?? "",
    niveauMin: t.niveau_min,
  };
}

const TopicForm = ({
  form,
  setForm,
  onSubmit,
  isPending,
  submitLabel,
}: {
  form: TopicFormState;
  setForm: (f: TopicFormState) => void;
  onSubmit: () => void;
  isPending: boolean;
  submitLabel: string;
}) => (
  <div className="space-y-4 mt-4">
    <Input
      placeholder="Titre *"
      className="bg-muted/50"
      value={form.title}
      onChange={(e) => setForm({ ...form, title: e.target.value })}
    />
    <select
      className="w-full h-10 rounded-lg bg-muted/50 border border-border px-3 text-sm text-foreground"
      value={form.domaine}
      onChange={(e) => setForm({ ...form, domaine: e.target.value })}
    >
      <option value="">Domaine</option>
      {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
    </select>
    <div>
      <label className="text-sm text-muted-foreground">Niveau minimum : {form.niveauMin}/5</label>
      <input
        type="range"
        min={1}
        max={5}
        value={form.niveauMin}
        onChange={(e) => setForm({ ...form, niveauMin: Number(e.target.value) })}
        className="w-full accent-primary"
      />
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>Débutant</span><span>Expert+</span>
      </div>
    </div>
    <textarea
      placeholder="Description (optionnel)"
      rows={3}
      value={form.description}
      onChange={(e) => setForm({ ...form, description: e.target.value })}
      className="w-full rounded-lg bg-muted/50 border border-border px-3 py-2 text-sm text-foreground resize-none"
    />
    <Button
      className="w-full gradient-primary text-primary-foreground"
      onClick={onSubmit}
      disabled={isPending}
    >
      {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
      {submitLabel}
    </Button>
  </div>
);

const TPManagement = () => {
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<TopicFormState>(emptyForm());

  const [editOpen, setEditOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<TopicResponse | null>(null);
  const [editForm, setEditForm] = useState<TopicFormState>(emptyForm());

  const { topics, isLoading, createTopic, isCreating, updateTopic } = useTeacherTopics();

  const handleCreate = async () => {
    if (!createForm.title.trim()) {
      toast.error("Le titre est obligatoire");
      return;
    }
    try {
      const body: CreateTopicRequest = {
        title: createForm.title,
        description: createForm.description || undefined,
        domaine: createForm.domaine || undefined,
        niveau_min: createForm.niveauMin,
        is_active: true,
      };
      await createTopic(body);
      toast.success("Sujet créé avec succès");
      setCreateOpen(false);
      setCreateForm(emptyForm());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la création");
    }
  };

  const handleOpenEdit = (t: TopicResponse) => {
    setEditingTopic(t);
    setEditForm(topicToForm(t));
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingTopic) return;
    if (!editForm.title.trim()) {
      toast.error("Le titre est obligatoire");
      return;
    }
    try {
      await updateTopic({
        id: String(editingTopic.id),
        title: editForm.title,
        description: editForm.description || undefined,
        domaine: editForm.domaine || undefined,
        niveau_min: editForm.niveauMin,
      });
      toast.success("Sujet mis à jour");
      setEditOpen(false);
      setEditingTopic(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la modification");
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await updateTopic({ id, is_active: !currentActive });
      toast.success(currentActive ? "Sujet archivé" : "Sujet réactivé");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };



  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Gestion des sujets de TP</h1>

          {/* Create Dialog */}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" /> Créer un sujet
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Nouveau sujet de TP</DialogTitle>
              </DialogHeader>
              <TopicForm
                form={createForm}
                setForm={setCreateForm}
                onSubmit={handleCreate}
                isPending={isCreating}
                submitLabel="Créer"
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) setEditingTopic(null); }}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">Modifier le sujet</DialogTitle>
            </DialogHeader>
            <TopicForm
              form={editForm}
              setForm={setEditForm}
              onSubmit={handleSaveEdit}
              isPending={false}
              submitLabel="Enregistrer"
            />
          </DialogContent>
        </Dialog>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["Titre", "Domaine", "Niveau", "Statut", "Créé le", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : topics.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    Aucun sujet créé. Créez votre premier sujet de TP.
                  </td>
                </tr>
              ) : (
                topics.map((t) => {
                  const niveauLabel = NIVEAU_LABELS[t.niveau_min] ?? `Niveau ${t.niveau_min}`;
                  return (
                    <tr key={String(t.id)} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span>{DOMAIN_ICONS[t.domaine ?? ""] ?? "📝"}</span>
                          <span className="text-sm font-medium text-foreground">{t.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{t.domaine ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs border ${difficultyColor[niveauLabel] ?? "bg-muted text-muted-foreground"}`}>
                          {niveauLabel}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${t.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                          {t.is_active ? "Actif" : "Archivé"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(t.created_at).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => handleOpenEdit(t)}
                          >
                            <Edit className="w-3 h-3 mr-1" /> Modifier
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-muted-foreground hover:text-foreground"
                            title={t.is_active ? "Archiver" : "Réactiver"}
                            onClick={() => handleToggleActive(String(t.id), t.is_active)}
                          >
                            {t.is_active
                              ? <Archive className="w-3 h-3" />
                              : <ArchiveRestore className="w-3 h-3" />
                            }
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
};

export default TPManagement;
