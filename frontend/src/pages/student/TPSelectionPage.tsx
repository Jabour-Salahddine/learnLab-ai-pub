import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useStudentTopics } from "@/hooks/useTopics";
import { useGenerateTP } from "@/hooks/useTP";
import { Search, Loader2, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const DOMAIN_ICONS: Record<string, string> = {
  "Algorithmique": "🔢",
  "Python": "🐍",
  "Data Science": "📊",
  "Machine Learning": "🤖",
};

function niveauColor(n: number): string {
  if (n <= 2) return "bg-success/10 text-success border-success/20";
  if (n <= 3) return "bg-warning/10 text-warning border-warning/20";
  return "bg-destructive/10 text-destructive border-destructive/20";
}

function niveauLabel(n: number): string {
  if (n <= 1) return "Débutant";
  if (n === 2) return "Intermédiaire";
  if (n === 3) return "Avancé";
  return "Expert";
}

const genSteps = [
  { icon: "🔍", label: "Analyse de votre profil..." },
  { icon: "📚", label: "Recherche dans la base RAG..." },
  { icon: "🤖", label: "Génération du TP personnalisé..." },
  { icon: "✅", label: "Votre TP est prêt !" },
];

const TPSelectionPage = () => {
  const navigate = useNavigate();
  const { topics, isLoading } = useStudentTopics();
  const { generateTP, isGenerating } = useGenerateTP();
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState("");
  const [genStep, setGenStep] = useState(0);
  const [showModal, setShowModal] = useState(false);

  const filtered = topics.filter((t) => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (domainFilter && t.domaine !== domainFilter) return false;
    return true;
  });

  const domains = [...new Set(topics.map((t) => t.domaine).filter(Boolean))] as string[];

  const startGeneration = async (topicId: string) => {
    setShowModal(true);
    setGenStep(0);
    try {
      // Animate steps while generating
      const stepInterval = setInterval(() => {
        setGenStep((s) => {
          if (s < 2) return s + 1;
          clearInterval(stepInterval);
          return s;
        });
      }, 1000);

      const tp = await generateTP(topicId);
      clearInterval(stepInterval);
      setGenStep(3);
      setTimeout(() => {
        setShowModal(false);
        navigate(`/student/session/${tp.tp_id}`);
      }, 800);
    } catch (err) {
      setShowModal(false);
      toast.error(err instanceof Error ? err.message : "Erreur lors de la génération du TP");
    }
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Choisir un TP</h1>
          <p className="text-muted-foreground">Sujets disponibles créés par vos enseignants</p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Rechercher un TP..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-10 bg-card" />
          </div>
          <select
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            className="h-10 rounded-lg bg-card border border-border px-3 text-sm text-foreground"
          >
            <option value="">Tous les domaines</option>
            {domains.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
            Aucun TP trouvé. Modifiez vos filtres.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {filtered.map((tp) => (
              <div key={tp.id} className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 hover:-translate-y-0.5 transition-all duration-200 group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{DOMAIN_ICONS[tp.domaine ?? ""] ?? "📝"}</span>
                  <Badge className={`text-xs border ${niveauColor(tp.niveau_min)}`}>
                    {niveauLabel(tp.niveau_min)}
                  </Badge>
                </div>
                <h3 className="font-semibold text-foreground mb-2">{tp.title}</h3>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{tp.description}</p>
                <div className="flex flex-wrap gap-1 mb-4">
                  {tp.tags.slice(0, 3).map((t) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                </div>
                <Button
                  className="w-full gradient-primary text-primary-foreground"
                  size="sm"
                  onClick={() => startGeneration(tp.id)}
                  disabled={isGenerating}
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Générer mon TP
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generation modal */}
      <Dialog open={showModal} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md text-center [&>button]:hidden">
          <div className="p-6 space-y-6">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto animate-pulse">
              <span className="text-3xl">{genSteps[genStep]?.icon}</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground mb-1">Génération en cours...</h3>
              <p className="text-muted-foreground text-sm">{genSteps[genStep]?.label}</p>
            </div>
            <div className="space-y-2">
              {genSteps.map((s, i) => (
                <div key={i} className={`flex items-center gap-3 p-2 rounded-lg transition-all ${i <= genStep ? "bg-primary/5" : "opacity-30"}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${i < genStep ? "bg-success text-white" : i === genStep ? "bg-primary text-white animate-pulse" : "bg-muted text-muted-foreground"}`}>
                    {i < genStep ? <Check className="w-3 h-3" /> : i + 1}
                  </div>
                  <span className="text-sm text-foreground">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default TPSelectionPage;
