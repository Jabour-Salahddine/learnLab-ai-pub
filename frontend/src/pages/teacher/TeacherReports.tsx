import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useStudents } from "@/hooks/useTeacher";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { BarChart3, Download, FileText, Loader2, RefreshCw } from "lucide-react";

interface StudentReport {
  id: string;
  content: string;
  period_start: string;
  period_end: string;
  created_at: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const TeacherReports = () => {
  const { students, isLoading } = useStudents();
  const [selectedReport, setSelectedReport] = useState<StudentReport | null>(null);
  const [selectedStudentName, setSelectedStudentName] = useState("");
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [generatingAll, setGeneratingAll] = useState(false);

  const setLoading = (studentId: string, value: boolean) =>
    setLoadingStates((prev) => ({ ...prev, [studentId]: value }));

  const fetchReport = async (studentId: string, studentName: string) => {
    setLoading(studentId, true);
    try {
      const data = await api.get<StudentReport>(`/teacher/students/${studentId}/report`);
      setSelectedReport(data);
      setSelectedStudentName(studentName);
    } catch {
      toast.error("Aucun rapport disponible pour cet étudiant.");
    } finally {
      setLoading(studentId, false);
    }
  };

  const generateReport = async (studentId: string, studentName: string) => {
    setLoading(studentId, true);
    try {
      const data = await api.post<StudentReport>(`/teacher/students/${studentId}/report`, {});
      toast.success(`Rapport généré pour ${studentName} !`);
      setSelectedReport(data);
      setSelectedStudentName(studentName);
    } catch {
      toast.error("Erreur lors de la génération du rapport.");
    } finally {
      setLoading(studentId, false);
    }
  };

  const generateAllReports = async () => {
    setGeneratingAll(true);
    let success = 0;
    for (const student of students) {
      try {
        await api.post(`/teacher/students/${student.id}/report`, {});
        success++;
      } catch {
        // continue
      }
    }
    toast.success(`${success}/${students.length} rapport(s) généré(s) avec succès.`);
    setGeneratingAll(false);
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Rapports IA</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Bilans hebdomadaires de vos étudiants générés par l'Agent Analyste
            </p>
          </div>
          <Button
            onClick={generateAllReports}
            disabled={generatingAll || students.length === 0}
            variant="outline"
          >
            {generatingAll ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Générer tous les rapports
          </Button>
        </div>

        {/* Student cards */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-20 bg-card border border-border rounded-xl">
            <BarChart3 className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground">Aucun étudiant inscrit pour le moment.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {students.map((student) => {
              const isStudentLoading = !!loadingStates[student.id];
              const fullName = `${student.first_name} ${student.last_name}`;

              return (
                <div
                  key={student.id}
                  className="bg-card border border-border rounded-xl p-4 flex items-center gap-4"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm font-bold text-primary">
                    {student.first_name[0]}{student.last_name[0]}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{fullName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-xs">
                        Niveau {student.niveau}
                      </Badge>
                      {student.score_moyen !== null && (
                        <span className="text-xs text-muted-foreground">
                          Score moyen : {Math.round(student.score_moyen)}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isStudentLoading}
                      onClick={() => fetchReport(student.id, fullName)}
                    >
                      {isStudentLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <FileText className="w-3 h-3" />
                      )}
                      <span className="ml-1.5">Voir</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isStudentLoading}
                      onClick={() => generateReport(student.id, fullName)}
                    >
                      {isStudentLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      <span className="ml-1.5">Générer</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Report modal */}
      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rapport — {selectedStudentName}</DialogTitle>
            {selectedReport && (
              <DialogDescription>
                Période : {formatDate(selectedReport.period_start)} →{" "}
                {formatDate(selectedReport.period_end)} · Généré le{" "}
                {formatDate(selectedReport.created_at)}
              </DialogDescription>
            )}
          </DialogHeader>

          {selectedReport && (
            <div className="mt-4 text-sm text-foreground whitespace-pre-wrap leading-relaxed bg-muted/30 rounded-lg p-4">
              {selectedReport.content}
            </div>
          )}

          {selectedReport && (
            <div className="mt-4 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const win = window.open("", "_blank");
                  if (!win) return;
                  win.document.write(
                    `<html><head><title>Rapport — ${selectedStudentName}</title>
                    <style>body{font-family:sans-serif;padding:2rem;line-height:1.6;white-space:pre-wrap}</style></head>
                    <body><h2>Rapport IA — ${selectedStudentName}</h2>
                    <p style="color:#666">Période : ${formatDate(selectedReport.period_start)} → ${formatDate(selectedReport.period_end)}</p>
                    <hr/><pre>${selectedReport.content}</pre></body></html>`
                  );
                  win.document.close();
                  win.print();
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Télécharger PDF
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default TeacherReports;
