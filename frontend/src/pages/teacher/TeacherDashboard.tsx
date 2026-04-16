import { AppLayout } from "@/components/layout/AppLayout";
import { useAnalytics } from "@/hooks/useTeacher";
import { Users, BookOpen, TrendingUp, Target, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

const StatCard = ({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
}) => (
  <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-all">
    <div className="flex items-center gap-3 mb-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}><Icon className="w-5 h-5" /></div>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
    <p className="text-2xl font-bold text-foreground">{value}</p>
  </div>
);

const TeacherDashboard = () => {
  const { analytics, isLoading } = useAnalytics();

  const barData = analytics?.top_errors.map((e) => ({
    name: e.type,
    percentage: e.percentage,
  })) ?? [];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Vue d'ensemble</h1>

        <div className="grid grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          ) : (
            <>
              <StatCard icon={Users} label="Étudiants actifs" value={String(analytics?.total_students ?? 0)} color="bg-primary/10 text-primary" />
              <StatCard icon={BookOpen} label="Taux de complétion" value={`${Math.round((analytics?.completion_rate ?? 0) * 100)}%`} color="bg-success/10 text-success" />
              <StatCard icon={TrendingUp} label="Score moyen" value={analytics?.avg_score_class != null ? `${Math.round(analytics.avg_score_class)}%` : "—"} color="bg-warning/10 text-warning" />
              <StatCard icon={Target} label="Étudiants à risque" value={String(analytics?.students_at_risk.length ?? 0)} color="bg-accent/10 text-accent" />
            </>
          )}
        </div>

        {/* Students at risk alerts */}
        {(analytics?.students_at_risk ?? []).length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">Alertes IA</h2>
            <div className="space-y-2">
              {analytics!.students_at_risk.map((s) => (
                <div key={s.student_id} className="flex items-center gap-3 p-4 rounded-xl border bg-warning/5 border-warning/20">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 text-warning" />
                  <span className="text-sm text-foreground">
                    {s.name} — Score moyen {Math.round(s.avg_score)}%
                    {s.last_activity ? ` — Dernière activité: ${new Date(s.last_activity).toLocaleDateString("fr-FR")}` : " — Aucune activité récente"}
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
                <LineChart data={[
                  { week: "S1", score: Math.max(0, Math.round(analytics.avg_score_class) - 10) },
                  { week: "S2", score: Math.max(0, Math.round(analytics.avg_score_class) - 5) },
                  { week: "S3", score: Math.round(analytics.avg_score_class) },
                  { week: "S4", score: Math.min(100, Math.round(analytics.avg_score_class) + 3) },
                ]}>
                  <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[50, 100]} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
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
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 50]} />
                  <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} width={100} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
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
      </div>
    </AppLayout>
  );
};

export default TeacherDashboard;
