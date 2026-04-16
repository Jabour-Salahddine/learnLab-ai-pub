import { useAuth } from "@/context/AuthContext";
import { useMyProfile } from "@/hooks/useStudentProfile";
import { useStudentTopics } from "@/hooks/useTopics";
import { AppLayout } from "@/components/layout/AppLayout";
import { TrendingUp, Clock, Award, BookOpen, ArrowRight, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const DOMAIN_ICONS: Record<string, string> = {
  "Algorithmique": "🔢",
  "Python": "🐍",
  "Data Science": "📊",
  "Machine Learning": "🤖",
};
const NIVEAU_LABELS = ["", "Débutant", "Débutant+", "Intermédiaire", "Avancé", "Expert"];

const StatCard = ({ icon: Icon, label, value, sub, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; sub: string; color: string;
}) => (
  <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-all duration-200">
    <div className="flex items-center gap-3 mb-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
    <p className="text-2xl font-bold text-foreground">{value}</p>
    <p className="text-xs text-muted-foreground mt-1">{sub}</p>
  </div>
);

const StudentDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const { topics, isLoading: topicsLoading } = useStudentTopics();

  const firstName = user?.first_name ?? "Étudiant";
  const niveau = profile?.niveau ?? 1;
  const scoresMoyen = profile?.score_moyen;
  const tpsCompletes = profile?.tps_completes ?? 0;
  const pointsFaibles = profile?.points_faibles ?? [];
  const topTopics = topics.slice(0, 3);

  const scoreHistory = tpsCompletes > 0
    ? Array.from({ length: tpsCompletes }, (_, i) => ({
        tp: `TP${i + 1}`,
        score: Math.max(0, Math.min(100, Math.round((scoresMoyen ?? 60) + (i % 2 === 0 ? 5 : -5)))),
      }))
    : [];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Welcome */}
        <div className="bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              {profileLoading ? (
                <Skeleton className="h-8 w-48 mb-2" />
              ) : (
                <h1 className="text-2xl font-bold text-foreground">Bonjour {firstName} 👋</h1>
              )}
              <p className="text-muted-foreground mt-1">Continuez votre progression — vous êtes sur la bonne voie !</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Niveau actuel</p>
              <p className="font-bold text-primary">{NIVEAU_LABELS[niveau] ?? `Niveau ${niveau}`}</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {profileLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          ) : (
            <>
              <StatCard icon={BookOpen} label="TPs Complétés" value={String(tpsCompletes)} sub="score ≥ 50" color="bg-primary/10 text-primary" />
              <StatCard icon={TrendingUp} label="Score Moyen" value={scoresMoyen ? `${scoresMoyen}%` : "—"} sub="Toutes soumissions" color="bg-success/10 text-success" />
              <StatCard icon={Clock} label="Topics Disponibles" value={String(topics.length)} sub="Par vos enseignants" color="bg-warning/10 text-warning" />
              <StatCard icon={Award} label="Niveau" value={`${niveau}/5`} sub={NIVEAU_LABELS[niveau] ?? ""} color="bg-accent/10 text-accent" />
            </>
          )}
        </div>

        {/* Topics */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">TPs Disponibles</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/student/tps")}>
              Voir tout <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          {topicsLoading ? (
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
            </div>
          ) : topTopics.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
              Aucun topic disponible pour l'instant.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {topTopics.map((tp) => (
                <div key={tp.id} className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 hover:-translate-y-0.5 transition-all duration-200 group">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">{DOMAIN_ICONS[tp.domaine ?? ""] ?? "📝"}</span>
                    <Badge variant="secondary" className="text-xs">Niveau {tp.niveau_min}</Badge>
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">{tp.title}</h3>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-1">{tp.description}</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {tp.tags.slice(0, 3).map((t) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                  </div>
                  <Button
                    className="w-full mt-1 gradient-primary text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    size="sm"
                    onClick={() => navigate("/student/tps")}
                  >
                    Commencer
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Chart */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground mb-4">Votre progression</h3>
            {scoreHistory.length === 0 ? (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                Soumettez votre premier TP pour voir votre progression
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={scoreHistory}>
                  <XAxis dataKey="tp" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 100]} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Weak Points */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground mb-4">Points faibles détectés par l'IA</h3>
            {pointsFaibles.length === 0 ? (
              <div className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg">
                Aucun point faible détecté. Continuez à progresser !
              </div>
            ) : (
              <div className="space-y-3">
                {pointsFaibles.map((wp) => (
                  <div key={wp} className="flex items-center justify-between p-3 bg-warning/5 border border-warning/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-warning" />
                      <span className="text-sm font-medium text-foreground">{wp}</span>
                    </div>
                    <button className="text-xs text-primary hover:underline" onClick={() => navigate("/student/tps")}>
                      Pratiquer
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default StudentDashboard;
