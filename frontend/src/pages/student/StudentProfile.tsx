import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { useMyProfile } from "@/hooks/useStudentProfile";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const badges = [
  { name: "Premier TP", icon: "🎯", unlocked: true },
  { name: "Score Parfait", icon: "💯", unlocked: false },
  { name: "5 TPs", icon: "🔥", unlocked: true },
  { name: "10 TPs", icon: "📚", unlocked: false },
  { name: "Expert Python", icon: "🐍", unlocked: false },
  { name: "Maître Algo", icon: "🧠", unlocked: false },
  { name: "Data Wizard", icon: "📊", unlocked: false },
  { name: "Speed Runner", icon: "⚡", unlocked: false },
];

const NIVEAU_LABELS = ["", "Débutant", "Débutant+", "Intermédiaire", "Avancé", "Expert"];

const StudentProfile = () => {
  const { user } = useAuth();
  const { data: profile, isLoading } = useMyProfile();

  const initials = user
    ? `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase()
    : "?";

  const niveauLabel = NIVEAU_LABELS[profile?.niveau ?? 1] ?? `Niveau ${profile?.niveau}`;
  const progressPct = profile ? Math.min(100, ((profile.tps_completes % 5) / 5) * 100) : 0;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-3 gap-6">
          {/* Left - Identity */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-6">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center mx-auto text-2xl font-bold text-primary-foreground">
                {initials}
              </div>
              {isLoading ? (
                <div className="mt-3 space-y-2">
                  <Skeleton className="h-5 w-32 mx-auto" />
                  <Skeleton className="h-4 w-40 mx-auto" />
                </div>
              ) : (
                <>
                  <h2 className="text-lg font-bold text-foreground mt-3">
                    {user?.first_name} {user?.last_name}
                  </h2>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  {profile?.formation && (
                    <Badge variant="secondary" className="mt-2">{profile.formation}</Badge>
                  )}
                  {profile?.year_of_study && (
                    <p className="text-xs text-muted-foreground mt-1">{profile.year_of_study}ème année</p>
                  )}
                </>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-muted-foreground">{niveauLabel} → prochaine étape</span>
                <span className="text-foreground font-medium">{Math.round(progressPct)}%</span>
              </div>
              <Progress value={progressPct} className="h-2" />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Badges</h3>
              <div className="grid grid-cols-4 gap-2">
                {badges.map((b) => (
                  <div
                    key={b.name}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg text-center ${b.unlocked ? "bg-primary/5" : "bg-muted/50 opacity-50"}`}
                  >
                    <span className="text-lg">{b.unlocked ? b.icon : "🔒"}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">{b.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right - Tabs */}
          <div className="col-span-2">
            <Tabs defaultValue="stats">
              <TabsList className="bg-muted">
                <TabsTrigger value="stats">Statistiques</TabsTrigger>
                <TabsTrigger value="skills">Compétences</TabsTrigger>
              </TabsList>

              <TabsContent value="stats" className="space-y-4 mt-4">
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="font-semibold text-foreground mb-4">Résumé de progression</h3>
                  {isLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-muted/30 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-primary">{profile?.tps_completes ?? 0}</p>
                        <p className="text-sm text-muted-foreground">TPs complétés</p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-success">
                          {profile?.score_moyen != null ? `${Math.round(profile.score_moyen)}%` : "—"}
                        </p>
                        <p className="text-sm text-muted-foreground">Score moyen</p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-warning">{profile?.niveau ?? 1}/5</p>
                        <p className="text-sm text-muted-foreground">Niveau actuel</p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-accent">
                          {profile?.derniere_activite
                            ? new Date(profile.derniere_activite).toLocaleDateString("fr-FR")
                            : "—"}
                        </p>
                        <p className="text-sm text-muted-foreground">Dernière activité</p>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="skills" className="mt-4 space-y-4">
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="font-semibold text-foreground mb-4">Concepts maîtrisés</h3>
                  {isLoading ? (
                    <Skeleton className="h-16 w-full" />
                  ) : profile?.concepts_maitrises && profile.concepts_maitrises.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {profile.concepts_maitrises.map((c) => (
                        <Badge key={c} className="bg-success/10 text-success border-success/20">{c}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Complétez des TPs pour voir vos compétences.</p>
                  )}
                </div>

                {(profile?.points_faibles ?? []).length > 0 && (
                  <div className="bg-warning/5 border border-warning/20 rounded-xl p-5">
                    <h3 className="font-semibold text-foreground mb-3">Points faibles détectés</h3>
                    <div className="flex flex-wrap gap-2">
                      {profile!.points_faibles.map((wp) => (
                        <Badge key={wp} className="bg-warning/10 text-warning border-warning/20">{wp}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default StudentProfile;
