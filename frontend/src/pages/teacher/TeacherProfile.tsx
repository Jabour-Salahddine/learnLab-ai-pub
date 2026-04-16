import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { useInvitationCodes, useAnalytics } from "@/hooks/useTeacher";
import { toast } from "sonner";
import {
  Copy, RefreshCw, LogOut, Users, TrendingUp, BookOpen, Key,
} from "lucide-react";

const TeacherProfile = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { codes, isLoading: codesLoading, generateCode, isGenerating } = useInvitationCodes();
  const { analytics, isLoading: analyticsLoading } = useAnalytics();

  // Auto-generate a code if none exist
  useEffect(() => {
    if (!codesLoading && codes.length === 0) {
      generateCode().catch(() => {});
    }
  }, [codesLoading, codes.length, generateCode]);

  const activeCode = codes.find((c) => c.is_active) ?? codes[0] ?? null;

  const handleCopy = async () => {
    if (!activeCode) return;
    try {
      await navigator.clipboard.writeText(activeCode.code);
      toast.success("Code copié dans le presse-papiers !");
    } catch {
      toast.error("Impossible de copier le code.");
    }
  };

  const handleGenerate = async () => {
    try {
      await generateCode();
      toast.success("Nouveau code généré !");
    } catch {
      toast.error("Erreur lors de la génération du code.");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const initials = user
    ? `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase()
    : "?";

  const formatExpiry = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Identity card */}
        <div className="bg-card border border-border rounded-xl p-6 flex items-center gap-5">
          <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center text-xl font-bold text-primary-foreground flex-shrink-0">
            {initials}
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {user?.first_name} {user?.last_name}
            </h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <Badge className="mt-2 bg-primary/10 text-primary border-primary/20">
              Enseignant
            </Badge>
          </div>
        </div>

        {/* Invitation code */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground">Code d'invitation</h2>
          </div>

          <p className="text-sm text-muted-foreground">
            Partagez ce code avec vos étudiants lors de leur inscription.
          </p>

          {codesLoading ? (
            <Skeleton className="h-16 w-full rounded-lg" />
          ) : activeCode ? (
            <div className="bg-muted/50 border border-border rounded-lg p-4 text-center">
              <p className="font-mono text-2xl font-bold tracking-widest text-primary select-all">
                {activeCode.code}
              </p>
            </div>
          ) : (
            <div className="bg-muted/50 border border-border rounded-lg p-4 text-center text-sm text-muted-foreground">
              Aucun code disponible
            </div>
          )}

          {activeCode && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {activeCode.enrolled_count ?? activeCode.current_uses}/{activeCode.max_uses} étudiant(s) inscrit(s)
              </span>
              <span>Expire le {formatExpiry(activeCode.expires_at)}</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleCopy}
              disabled={!activeCode}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copier le code
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? "animate-spin" : ""}`} />
              Nouveau code
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Mes statistiques</h2>

          {analyticsLoading ? (
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-muted/30 rounded-lg p-4 text-center">
                <Users className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-2xl font-bold text-foreground">
                  {analytics?.total_students ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Étudiants</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 text-center">
                <TrendingUp className="w-5 h-5 text-success mx-auto mb-1" />
                <p className="text-2xl font-bold text-foreground">
                  {analytics?.avg_score_class != null
                    ? `${Math.round(analytics.avg_score_class)}%`
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground">Score moyen</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 text-center">
                <BookOpen className="w-5 h-5 text-warning mx-auto mb-1" />
                <p className="text-2xl font-bold text-foreground">
                  {analytics?.completion_rate != null
                    ? `${Math.round(analytics.completion_rate)}%`
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground">Taux de complétion</p>
              </div>
            </div>
          )}
        </div>

        {/* Logout */}
        <Button variant="destructive" className="w-full" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          Se déconnecter
        </Button>
      </div>
    </AppLayout>
  );
};

export default TeacherProfile;
