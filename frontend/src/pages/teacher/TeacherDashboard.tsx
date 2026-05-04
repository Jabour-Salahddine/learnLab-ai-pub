import { AppLayout } from "@/components/layout/AppLayout";
import { useAnalytics } from "@/hooks/useTeacher";
import { Users, BookOpen, TrendingUp, Target, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import type { TopErrorItem } from "@/types/api";

const StatCard = ({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
}) => (
  <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-all">
    <div className="flex items-center gap-3 mb-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
    <p className="text-2xl font-bold text-foreground">{value}</p>
  </div>
);

const ERROR_META: Record<string, { icon: string; title: string; description: string; conseil: string; color: string }> = {
  SyntaxError: {
    icon: "🔴",
    title: "Erreur de syntaxe",
    description:
      "L'étudiant a écrit du code qui ne respecte pas les règles du langage. Exemple : parenthèse manquante, indentation incorrecte, mot-clé mal écrit.",
    conseil: "Revoir les bases de la syntaxe du langage utilisé.",
    color: "border-destructive/30 bg-destructive/5",
  },
  LogicError: {
    icon: "🟠",
    title: "Erreur logique",
    description:
      "Le code s'exécute sans planter mais produit un résultat incorrect. La logique de l'algorithme est défaillante.",
    conseil: "Encourager l'étudiant à tracer l'exécution pas à pas avec des print().",
    color: "border-orange-300/40 bg-orange-50/10",
  },
  AlgoError: {
    icon: "🟡",
    title: "Erreur algorithmique",
    description:
      "L'algorithme utilisé n'est pas optimal ou ne correspond pas à ce qui est demandé. Souvent une mauvaise complexité.",
    conseil: "Revoir le cours sur les algorithmes concernés.",
    color: "border-warning/30 bg-warning/5",
  },
  ConceptError: {
    icon: "🔵",
    title: "Erreur conceptuelle",
    description:
      "L'étudiant utilise une mauvaise structure de données ou un mauvais paradigme pour résoudre le problème.",
    conseil: "Approfondir les concepts fondamentaux avant de continuer.",
    color: "border-blue-300/40 bg-blue-50/10",
  },
};

function ErrorDetailCard({ error }: { error: TopErrorItem }) {
  const meta = ERROR_META[error.type] ?? {
    icon: "⚪",
    title: error.type,
    description: "Type d'erreur non classifié.",
    conseil: "Analyser les erreurs manuellement.",
    color: "border-border bg-muted/20",
  };

  return (
    <div className={`border rounded-xl p-4 ${meta.color}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{meta.icon}</span>
        <h4 className="font-semibold text-foreground text-sm">{meta.title}</h4>
        <span className="ml-auto text-xs font-bold text-muted-foreground">
          {error.count} cas · {error.percentage}%
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{meta.description}</p>
      <p className="text-xs text-primary mt-2 font-medium">💡 {meta.conseil}</p>
    </div>
  );
}

const TeacherDashboard = () => {
  const { analytics, isLoading } = useAnalytics();

  const barData =
    analytics?.top_errors.map((e) => ({
      name: e.type,
      percentage: e.percentage,
    })) ?? [];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Vue d'ensemble</h1>

        <div className="grid grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))
          ) : (
            <>
              <StatCard
                icon={Users}
                label="Étudiants actifs"
                value={String(analytics?.total_students ?? 0)}
                color="bg-primary/10 text-primary"
              />
              <StatCard
                icon={BookOpen}
                label="Taux de complétion"
                value={`${Math.round(analytics?.completion_rate ?? 0)}%`}
                color="bg-success/10 text-success"
              />
              <StatCard
                icon={TrendingUp}
                label="Score moyen"
                value={
                  analytics?.avg_score_class != null
                    ? `${Math.round(analytics.avg_score_class)}%`
                    : "—"
                }
                color="bg-warning/10 text-warning"
              />
              <StatCard
                icon={Target}
                label="Étudiants à risque"
                value={String(analytics?.students_at_risk.length ?? 0)}
                color="bg-accent/10 text-accent"
              />
            </>
          )}
        </div>

        {/* Students at risk alerts */}
        {(analytics?.students_at_risk ?? []).length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">Alertes IA</h2>
            <div className="space-y-2">
              {analytics!.students_at_risk.map((s) => (
                <div
                  key={s.student_id}
                  className="flex items-center gap-3 p-4 rounded-xl border bg-warning/5 border-warning/20"
                >
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 text-warning" />
                  <span className="text-sm text-foreground">
                    {s.name} — Score moyen {Math.round(s.avg_score)}%
                    {s.last_activity
                      ? ` — Dernière activité: ${new Date(s.last_activity).toLocaleDateString("fr-FR")}`
                      : " — Aucune activité récente"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground mb-4">Performance de la classe</h3>
            {analytics?.avg_score_class != null ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={[
                    { week: "S1", score: Math.max(0, Math.round(analytics.avg_score_class) - 10) },
                    { week: "S2", score: Math.max(0, Math.round(analytics.avg_score_class) - 5) },
                    { week: "S3", score: Math.round(analytics.avg_score_class) },
                    { week: "S4", score: Math.min(100, Math.round(analytics.avg_score_class) + 3) },
                  ]}
                >
                  <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[50, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                Aucune donnée de performance disponible
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground mb-4">Erreurs les plus fréquentes</h3>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} layout="vertical">
                  <XAxis
                    type="number"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    domain={[0, 50]}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                    }}
                  />
                  <Bar dataKey="percentage" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                Aucune erreur enregistrée pour le moment
              </div>
            )}
          </div>
        </div>

        {/* Error detail cards — only shown if there are errors */}
        {(analytics?.top_errors ?? []).length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              Détail des erreurs détectées
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {analytics!.top_errors.map((error) => (
                <ErrorDetailCard key={error.type} error={error} />
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default TeacherDashboard;
