import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { SubmissionHistoryItem } from "@/types/api";
import { BookOpen, Trophy, Calendar, CheckCircle2, XCircle, ArrowRight } from "lucide-react";

type Filter = "week" | "month" | "all";

function scoreColor(score: number | null): string {
  if (score === null) return "bg-muted text-muted-foreground";
  if (score >= 70) return "bg-success/10 text-success border-success/20";
  if (score >= 40) return "bg-warning/10 text-warning border-warning/20";
  return "bg-destructive/10 text-destructive border-destructive/20";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function isWithinDays(iso: string, days: number): boolean {
  return Date.now() - new Date(iso).getTime() < days * 24 * 60 * 60 * 1000;
}

const StudentHistory = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");

  const { data: submissions = [], isLoading } = useQuery<SubmissionHistoryItem[]>({
    queryKey: ["student-submissions"],
    queryFn: () => api.get<SubmissionHistoryItem[]>("/student/submissions"),
    staleTime: 30_000,
  });

  const filtered = submissions.filter((s) => {
    if (filter === "week") return isWithinDays(s.created_at, 7);
    if (filter === "month") return isWithinDays(s.created_at, 30);
    return true;
  });

  const filters: { value: Filter; label: string }[] = [
    { value: "week", label: "Cette semaine" },
    { value: "month", label: "Ce mois" },
    { value: "all", label: "Tout" },
  ];

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Mon historique</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {submissions.length} soumission{submissions.length !== 1 ? "s" : ""} au total
            </p>
          </div>

          {/* Filter buttons */}
          <div className="flex gap-2">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === f.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-card border border-border rounded-xl">
            <Trophy className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">
              {submissions.length === 0
                ? "Vous n'avez pas encore soumis de TP."
                : "Aucune soumission sur cette période."}
            </p>
            {submissions.length === 0 && (
              <>
                <p className="text-sm text-muted-foreground mt-1">Commencez dès maintenant !</p>
                <Button
                  className="mt-4"
                  onClick={() => navigate("/student/tps")}
                >
                  Voir les TPs disponibles
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((sub) => (
              <div
                key={sub.id}
                className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-primary/30 transition-all"
              >
                {/* Topic icon */}
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {sub.topic_title ?? "Sujet sans titre"}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {formatDate(sub.created_at)}
                    </span>
                    {sub.tests_total > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        {sub.tests_passed === sub.tests_total ? (
                          <CheckCircle2 className="w-3 h-3 text-success" />
                        ) : (
                          <XCircle className="w-3 h-3 text-destructive" />
                        )}
                        {sub.tests_passed}/{sub.tests_total} tests passés
                      </span>
                    )}
                  </div>
                </div>

                {/* Score badge */}
                <Badge className={`text-sm font-bold px-3 py-1 border ${scoreColor(sub.score)}`}>
                  {sub.score !== null ? `${Math.round(sub.score)}%` : "—"}
                </Badge>

                {/* Action */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground flex-shrink-0"
                  onClick={() => navigate(`/student/result/${sub.id}`)}
                >
                  Voir <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default StudentHistory;
