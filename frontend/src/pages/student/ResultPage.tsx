import { useNavigate, useLocation } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ArrowRight, Check, X, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { useEffect, useState } from "react";
import type { SubmitResponse } from "@/types/api";

const ResultPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const result = location.state?.result as SubmitResponse | undefined;
  const score = result?.score ?? 0;

  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    let current = 0;
    const interval = setInterval(() => {
      current += 1;
      if (current >= score) { clearInterval(interval); current = score; }
      setDisplayScore(current);
    }, 20);
    return () => clearInterval(interval);
  }, [score]);

  const radarData = [
    { metric: "Exactitude", value: score },
    { metric: "Performance", value: Math.max(0, score - 5) },
    { metric: "Lisibilité", value: Math.min(100, score + 8) },
    { metric: "Bonnes pratiques", value: Math.max(0, score - 10) },
  ];

  const scoreBg = score >= 70 ? "from-success/20 to-success/5" : "from-warning/20 to-warning/5";
  const scoreColor = score >= 70 ? "text-success" : "text-warning";

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Hero */}
        <div className={`bg-gradient-to-b ${scoreBg} border border-border rounded-xl p-8 text-center`}>
          <div className="relative w-32 h-32 mx-auto mb-4">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
              <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--primary))" strokeWidth="8" strokeDasharray={`${(displayScore / 100) * 314} 314`} strokeLinecap="round" className="transition-all duration-100" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-3xl font-bold ${scoreColor}`}>{displayScore}</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{score >= 70 ? "Bien joué !" : "À améliorer"}</h1>
          {score >= 70 && (
            <div className="flex items-center justify-center gap-2 mt-3">
              <Trophy className="w-5 h-5 text-warning" />
              <Badge className="bg-warning/10 text-warning border-warning/20">🏆 Objectif atteint</Badge>
            </div>
          )}
        </div>

        {/* 3 columns */}
        <div className="grid grid-cols-3 gap-4">
          {/* Tests */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground mb-4">Tests unitaires</h3>
            {result?.tests_results && result.tests_results.length > 0 ? (
              <div className="space-y-2">
                {result.tests_results.map((t, i) => (
                  <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg text-sm ${t.passed ? "bg-success/5" : "bg-destructive/5"}`}>
                    {t.passed ? <Check className="w-4 h-4 text-success mt-0.5 flex-shrink-0" /> : <X className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />}
                    <div>
                      <p className="text-foreground font-medium">{t.description}</p>
                      {t.actual && <p className="text-xs text-muted-foreground mt-0.5">→ {t.actual}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun résultat de test disponible</p>
            )}
          </div>

          {/* AI Analysis */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground mb-2">🤖 Rapport de l'Agent Évaluateur</h3>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
              </RadarChart>
            </ResponsiveContainer>
            {result?.errors_categorized && result.errors_categorized.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {result.errors_categorized.map((e, i) => (
                  <Badge key={i} variant="destructive" className="text-xs">{e.type}</Badge>
                ))}
              </div>
            )}
          </div>

          {/* Recommendations */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground mb-4">Ce que l'IA vous recommande</h3>
            <div className="space-y-3">
              {result?.errors_categorized && result.errors_categorized.length > 0 ? (
                result.errors_categorized.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 bg-primary/5 rounded-lg text-sm">
                    <span className="text-primary mt-0.5">💡</span>
                    <span className="text-foreground">{e.description}</span>
                  </div>
                ))
              ) : (
                <div className="flex items-start gap-2 p-2.5 bg-primary/5 rounded-lg text-sm">
                  <span className="text-primary mt-0.5">💡</span>
                  <span className="text-foreground">
                    {score >= 70 ? "Excellent travail ! Continuez à pratiquer pour maintenir ce niveau." : "Revoyez les concepts fondamentaux et réessayez."}
                  </span>
                </div>
              )}
            </div>
            <div className="mt-4 p-3 bg-accent/5 border border-accent/20 rounded-lg">
              <p className="text-xs text-muted-foreground mb-2">Prochain TP suggéré</p>
              <p className="text-sm font-semibold text-foreground">Continuez à progresser</p>
              <Button size="sm" className="mt-2 gradient-primary text-primary-foreground" onClick={() => navigate("/student/tps")}>
                Voir les TPs <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </div>
        </div>

        {/* Feedback */}
        {result?.feedback && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground mb-3">Feedback détaillé de l'Agent Tuteur</h3>
            <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {result.feedback}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default ResultPage;
