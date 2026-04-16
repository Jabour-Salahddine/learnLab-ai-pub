import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useStudents, useStudentDetail } from "@/hooks/useTeacher";
import { Search, Eye, Send, Loader2, Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { StudentSummary } from "@/types/api";

const StudentManagement = () => {
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentSummary | null>(null);
  const { students, isLoading } = useStudents();
  const { report, reportLoading, fetchReport } = useStudentDetail(selectedStudent?.id ?? null);

  const [askQuestion, setAskQuestion] = useState("");
  const [askResponse, setAskResponse] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);

  const filtered = students.filter((s) => {
    const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
    return fullName.includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase());
  });

  const getStatusBadge = (derniere_activite: string | null) => {
    if (!derniere_activite) return <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs">Inactif</Badge>;
    const daysSince = (Date.now() - new Date(derniere_activite).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince <= 3) return <Badge className="bg-success/10 text-success border-success/20 text-xs">Actif</Badge>;
    if (daysSince <= 7) return <Badge className="bg-warning/10 text-warning border-warning/20 text-xs">Modéré</Badge>;
    return <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs">Inactif</Badge>;
  };

  const handleSelectStudent = (s: StudentSummary) => {
    setSelectedStudent(s);
    setAskQuestion("");
    setAskResponse(null);
  };

  const handleCloseDrawer = () => {
    setSelectedStudent(null);
    setAskQuestion("");
    setAskResponse(null);
  };

  const handleAskAI = async () => {
    if (!askQuestion.trim() || !selectedStudent) return;
    setIsAsking(true);
    setAskResponse(null);
    try {
      const data = await api.post<{ response: string }>(
        `/teacher/students/${selectedStudent.id}/ask`,
        { question: askQuestion }
      );
      setAskResponse(data.response);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la requête IA");
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Mes Étudiants</h1>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un étudiant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-card"
          />
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["Étudiant", "Email", "Niveau", "Score Moyen", "Soumissions", "Statut", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    {students.length === 0
                      ? "Aucun étudiant inscrit pour l'instant. Partagez votre code d'invitation !"
                      : "Aucun étudiant trouvé pour cette recherche."}
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
                          {s.first_name[0]}{s.last_name[0]}
                        </div>
                        <p className="text-sm font-medium text-foreground">{s.first_name} {s.last_name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{s.email}</td>
                    <td className="px-4 py-3"><Badge variant="secondary" className="text-xs">{s.niveau}/5</Badge></td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs ${(s.score_moyen ?? 0) >= 70 ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                        {s.score_moyen != null ? `${Math.round(s.score_moyen)}%` : "—"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{s.submissions_count}</td>
                    <td className="px-4 py-3">{getStatusBadge(s.derniere_activite)}</td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => handleSelectStudent(s)}
                      >
                        <Eye className="w-3 h-3 mr-1" /> Détail
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Drawer */}
      <Sheet open={!!selectedStudent} onOpenChange={handleCloseDrawer}>
        <SheetContent className="w-[450px] bg-card border-border overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-foreground">
              {selectedStudent ? `${selectedStudent.first_name} ${selectedStudent.last_name}` : ""}
            </SheetTitle>
          </SheetHeader>
          {selectedStudent && (
            <div className="mt-6 space-y-6">
              {/* Student info */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{selectedStudent.email}</p>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="secondary">Niveau {selectedStudent.niveau}/5</Badge>
                  {selectedStudent.score_moyen != null && (
                    <Badge className="bg-primary/10 text-primary">
                      {Math.round(selectedStudent.score_moyen)}% score moyen
                    </Badge>
                  )}
                  <Badge variant="outline">
                    {selectedStudent.submissions_count} soumission{selectedStudent.submissions_count !== 1 ? "s" : ""}
                  </Badge>
                </div>
                {selectedStudent.derniere_activite && (
                  <p className="text-xs text-muted-foreground">
                    Dernière activité : {new Date(selectedStudent.derniere_activite).toLocaleDateString("fr-FR")}
                  </p>
                )}
              </div>

              {/* AI Report */}
              {reportLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : report ? (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-foreground text-sm">📊 Rapport IA</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{report.content}</p>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={fetchReport}>
                  Générer le rapport IA
                </Button>
              )}

              {/* Ask AI */}
              <div>
                <h4 className="font-semibold text-foreground text-sm mb-3">
                  💬 Poser une question à l'IA
                </h4>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      value={askQuestion}
                      onChange={(e) => setAskQuestion(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAskAI()}
                      placeholder="Ex : Quelles sont les difficultés de cet étudiant ?"
                      disabled={isAsking}
                      className="flex-1 h-9 rounded-lg bg-muted border-0 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                    />
                    <Button
                      size="sm"
                      className="h-9 w-9 p-0 gradient-primary"
                      onClick={handleAskAI}
                      disabled={isAsking || !askQuestion.trim()}
                    >
                      {isAsking ? <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" /> : <Send className="w-4 h-4 text-primary-foreground" />}
                    </Button>
                  </div>

                  {askResponse && (
                    <div className="bg-muted/50 border border-border rounded-lg p-3 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                        <Bot className="w-3 h-3" /> <span className="font-medium">Agent Analyste</span>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{askResponse}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
};

export default StudentManagement;
