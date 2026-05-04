import { useRef, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useRAGDocuments } from "@/hooks/useTeacher";
import { Upload, FileText, Trash2, Database, Check, Loader2, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const fileIcon: Record<string, string> = { pdf: "📄", md: "📝", txt: "📃" };

const RAGManagement = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [visibleToStudents, setVisibleToStudents] = useState(false);
  const {
    documents,
    isLoading,
    uploadDocument,
    isUploading,
    deleteDocument,
    updateDocumentVisibility,
  } = useRAGDocuments();

  const totalChunks = documents.reduce((sum, d) => sum + (d.chunks_count ?? 0), 0);
  const indexedCount = documents.filter((d) => d.status === "indexed").length;
  const lastUpdated =
    documents.length > 0
      ? new Date(
          Math.max(...documents.map((d) => new Date(d.uploaded_at).getTime()))
        ).toLocaleString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
          day: "2-digit",
          month: "short",
        })
      : "—";

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadDocument({ file, visibleToStudents });
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

  const handleToggleVisibility = async (id: string, currentVisible: boolean, filename: string) => {
    try {
      await updateDocumentVisibility({ id, visible: !currentVisible });
      toast.success(
        !currentVisible
          ? `${filename} — maintenant visible par les étudiants`
          : `${filename} — masqué aux étudiants`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la mise à jour");
    }
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Base de connaissances RAG</h1>
          <Button
            className="gradient-primary text-primary-foreground"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Uploader
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.md,.txt"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Documents indexés", value: String(indexedCount), icon: FileText },
            { label: "Chunks vectorisés", value: totalChunks.toLocaleString("fr-FR"), icon: Database },
            { label: "Dernière mise à jour", value: lastUpdated, icon: Check },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-3"
            >
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

        {/* Upload zone with visibility toggle */}
        <div
          className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">Glissez vos documents ici</p>
          <p className="text-xs text-muted-foreground mt-1">PDF, MD, TXT — max 10 MB</p>

          {/* Visibility toggle (stop propagation to avoid triggering file picker) */}
          <div
            className="mt-4 flex items-center justify-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setVisibleToStudents((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                visibleToStudents ? "bg-success" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  visibleToStudents ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span className="text-sm text-muted-foreground">
              {visibleToStudents ? (
                <span className="text-success font-medium">Visible par les étudiants</span>
              ) : (
                "Réservé à la RAG (non visible)"
              )}
            </span>
          </div>
          {visibleToStudents && (
            <p className="text-xs text-success/80 mt-1">
              Les étudiants pourront consulter et télécharger ce document
            </p>
          )}
        </div>

        {/* Documents grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-52 rounded-xl" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
            Aucun document uploadé. Commencez par ajouter des cours en PDF.
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{fileIcon[doc.file_type ?? ""] ?? "📎"}</span>
                  <div className="flex flex-col items-end gap-1">
                    <Badge
                      className={`text-xs ${
                        doc.status === "indexed"
                          ? "bg-success/10 text-success border-success/20"
                          : doc.status === "error"
                          ? "bg-destructive/10 text-destructive border-destructive/20"
                          : "bg-warning/10 text-warning border-warning/20"
                      }`}
                    >
                      {doc.status === "indexed" ? (
                        <>Indexé ✓</>
                      ) : doc.status === "error" ? (
                        "Erreur"
                      ) : (
                        <span className="flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> En traitement
                        </span>
                      )}
                    </Badge>
                    {doc.visible_to_students && (
                      <Badge className="text-xs bg-success/10 text-success border-success/20">
                        👁 Visible étudiants
                      </Badge>
                    )}
                  </div>
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

                {/* Toggle visibility button */}
                <Button
                  size="sm"
                  variant="ghost"
                  className={`w-full mt-2 h-7 text-xs ${
                    doc.visible_to_students
                      ? "text-success hover:text-success/80"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => handleToggleVisibility(doc.id, doc.visible_to_students, doc.filename)}
                >
                  {doc.visible_to_students ? (
                    <>
                      <Eye className="w-3 h-3 mr-1" /> Masquer aux étudiants
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3 h-3 mr-1" /> Rendre visible
                    </>
                  )}
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full mt-1 h-7 text-xs text-muted-foreground hover:text-destructive"
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
