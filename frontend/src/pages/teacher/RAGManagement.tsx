import { useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useRAGDocuments } from "@/hooks/useTeacher";
import { Upload, FileText, Trash2, Database, Check, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const fileIcon: Record<string, string> = { pdf: "📄", md: "📝", txt: "📃" };

const RAGManagement = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { documents, isLoading, uploadDocument, isUploading, deleteDocument } = useRAGDocuments();

  const totalChunks = documents.reduce((sum, d) => sum + (d.chunks_count ?? 0), 0);
  const indexedCount = documents.filter((d) => d.status === "indexed").length;
  const lastUpdated = documents.length > 0
    ? new Date(Math.max(...documents.map((d) => new Date(d.uploaded_at).getTime()))).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })
    : "—";

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadDocument({ file });
      toast.success(`${file.name} — Indexation en cours...`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'upload");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string, filename: string) => {
    try {
      await deleteDocument(id);
      toast.success(`${filename} supprimé`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la suppression");
    }
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Base de connaissances RAG</h1>
          <Button className="gradient-primary text-primary-foreground" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Uploader
          </Button>
          <input ref={fileInputRef} type="file" accept=".pdf,.md,.txt" className="hidden" onChange={handleFileChange} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Documents indexés", value: String(indexedCount), icon: FileText },
            { label: "Chunks vectorisés", value: totalChunks.toLocaleString("fr-FR"), icon: Database },
            { label: "Dernière mise à jour", value: lastUpdated, icon: Check },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <s.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Upload zone */}
        <div
          className="border-2 border-dashed border-border rounded-xl p-10 text-center hover:border-primary/50 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">Glissez vos documents ici</p>
          <p className="text-xs text-muted-foreground mt-1">PDF, MD, TXT</p>
        </div>

        {/* Documents grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        ) : documents.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
            Aucun document uploadé. Commencez par ajouter des cours en PDF.
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {documents.map((doc) => (
              <div key={doc.id} className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{fileIcon[doc.file_type] ?? "📎"}</span>
                  <Badge className={`text-xs ${doc.status === "indexed" ? "bg-success/10 text-success border-success/20" : doc.status === "error" ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-warning/10 text-warning border-warning/20"}`}>
                    {doc.status === "indexed" ? (
                      <>Indexé ✓</>
                    ) : doc.status === "error" ? (
                      "Erreur"
                    ) : (
                      <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> En traitement</span>
                    )}
                  </Badge>
                </div>
                <h4 className="text-sm font-medium text-foreground truncate">{doc.filename}</h4>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground uppercase">{doc.file_type}</span>
                </div>
                {doc.chunks_count > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">{doc.chunks_count} chunks</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(doc.uploaded_at).toLocaleDateString("fr-FR")}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full mt-2 h-7 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(doc.id, doc.filename)}
                >
                  <Trash2 className="w-3 h-3 mr-1" /> Supprimer
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default RAGManagement;
