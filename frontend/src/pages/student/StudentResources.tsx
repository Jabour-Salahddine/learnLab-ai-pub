import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import type { StudentResource } from "@/types/api";
import { BookOpen, Download, Eye, FileText } from "lucide-react";

const fileIcon: Record<string, string> = { pdf: "📄", md: "📝", txt: "📃" };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const StudentResources = () => {
  const [previewDoc, setPreviewDoc] = useState<{ filename: string; chunks: string[] } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const { data: resources = [], isLoading } = useQuery<StudentResource[]>({
    queryKey: ["student-resources"],
    queryFn: () => api.get<StudentResource[]>("/rag/documents/student-resources"),
    staleTime: 60_000,
  });

  const handlePreview = async (docId: string, filename: string) => {
    setPreviewLoading(true);
    try {
      const data = await api.get<{ chunks: Array<{ text: string; chunk_index: number }> }>(
        `/rag/documents/${docId}/preview`
      );
      setPreviewDoc({
        filename,
        chunks: (data.chunks ?? []).map((c) => c.text),
      });
    } catch {
      setPreviewDoc({ filename, chunks: [] });
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ressources du cours</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Documents partagés par votre enseignant
          </p>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-xl" />
            ))}
          </div>
        ) : resources.length === 0 ? (
          <div className="text-center py-20 bg-card border border-border rounded-xl">
            <BookOpen className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">
              Votre enseignant n'a pas encore partagé de ressources.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Revenez plus tard — les documents partagés apparaîtront ici.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {resources.map((doc) => (
              <div
                key={doc.id}
                className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-all flex flex-col"
              >
                {/* Icon + type */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-3xl">{fileIcon[doc.file_type ?? ""] ?? "📎"}</span>
                  <Badge variant="secondary" className="text-xs uppercase">
                    {doc.file_type ?? "—"}
                  </Badge>
                </div>

                {/* Filename */}
                <h4 className="text-sm font-semibold text-foreground truncate mb-1">
                  {doc.filename}
                </h4>

                {/* Date */}
                <p className="text-xs text-muted-foreground mb-4">
                  Ajouté le {formatDate(doc.uploaded_at)}
                </p>

                {/* Actions */}
                <div className="mt-auto flex flex-col gap-2">
                  {doc.download_url ? (
                    <Button
                      size="sm"
                      className="w-full gradient-primary text-primary-foreground"
                      onClick={() => window.open(doc.download_url, "_blank")}
                    >
                      <Download className="w-3 h-3 mr-2" />
                      Télécharger
                    </Button>
                  ) : (
                    <Button size="sm" className="w-full" disabled variant="outline">
                      <Download className="w-3 h-3 mr-2" />
                      Indisponible
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={previewLoading}
                    onClick={() => handlePreview(doc.id, doc.filename)}
                  >
                    <Eye className="w-3 h-3 mr-2" />
                    Aperçu
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview modal */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {previewDoc?.filename}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            {previewDoc?.chunks && previewDoc.chunks.length > 0 ? (
              previewDoc.chunks.map((chunk, i) => (
                <div key={i} className="bg-muted/30 rounded-lg p-4 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {chunk}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                Aperçu non disponible pour ce document.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default StudentResources;
