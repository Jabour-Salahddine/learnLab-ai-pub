import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useStudents } from "@/hooks/useTeacher";
import { Eye, BookOpen, ClipboardList } from "lucide-react";

interface GeneratedTPItem {
  tp_id: string;
  student_name: string;
  topic_title: string;
  enonce_preview: string;
  starter_code_preview: string;
  created_at: string;
  submissions_count: number;
}

interface TeacherSubmissionItem {
  submission_id: string;
  student_name: string;
  topic_title: string;
  score: number | null;
  code_preview: string;
  feedback: string;
  tests_passed: number;
  tests_total: number;
  errors_categorized: { type: string; description: string; line: number | null }[];
  created_at: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function scoreColor(score: number | null) {
  if (score === null) return "bg-muted text-muted-foreground";
  if (score >= 70) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  if (score >= 40) return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-cyan-500",
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  );
}

// ── Onglet Énoncés ────────────────────────────────────────────────────────────

function EnoncesTab() {
  const { data, isLoading } = useQuery<GeneratedTPItem[]>({
    queryKey: ["teacher-generated-tps"],
    queryFn: () => api.get("/teacher/generated-tps"),
  });

  const [selected, setSelected] = useState<GeneratedTPItem | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">Aucun TP généré encore.</p>
        <p className="text-xs mt-1">Les TPs apparaîtront ici dès que vos étudiants en commenceront un.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {data.map((tp) => (
          <div
            key={tp.tp_id}
            className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 ${avatarColor(tp.student_name)}`}>
                {initials(tp.student_name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground text-sm">{tp.student_name}</span>
                  <span className="text-muted-foreground text-xs">·</span>
                  <span className="text-muted-foreground text-xs truncate">{tp.topic_title}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{formatDate(tp.created_at)}</p>
              </div>
              <Badge variant="secondary" className="flex-shrink-0 text-xs">
                {tp.submissions_count} soumission{tp.submissions_count !== 1 ? "s" : ""}
              </Badge>
            </div>

            <p className="mt-3 text-sm text-muted-foreground line-clamp-3 leading-relaxed">
              {tp.enonce_preview || "Aucun énoncé disponible."}
            </p>

            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelected(tp)}
                className="gap-1.5 text-xs"
              >
                <Eye className="w-3.5 h-3.5" />
                Voir l'énoncé complet
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              TP de {selected?.student_name} — {selected?.topic_title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Énoncé</p>
              <div className="bg-muted/50 rounded-lg p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {selected?.enonce_preview || "Aucun énoncé."}
              </div>
            </div>
            {selected?.starter_code_preview && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Code de départ</p>
                <div className="bg-zinc-950 dark:bg-zinc-900 rounded-lg p-4 text-xs text-green-400 font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto">
                  {selected.starter_code_preview}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Onglet Soumissions ────────────────────────────────────────────────────────

function SubmissionsTab() {
  const { students } = useStudents();
  const [filterStudent, setFilterStudent] = useState<string>("all");
  const [filterMin, setFilterMin] = useState<string>("");
  const [filterMax, setFilterMax] = useState<string>("");
  const [selected, setSelected] = useState<TeacherSubmissionItem | null>(null);

  const params = new URLSearchParams();
  if (filterStudent !== "all") params.set("student_id", filterStudent);
  if (filterMin !== "") params.set("min_score", filterMin);
  if (filterMax !== "") params.set("max_score", filterMax);
  const queryString = params.toString();

  const { data, isLoading } = useQuery<TeacherSubmissionItem[]>({
    queryKey: ["teacher-submissions", filterStudent, filterMin, filterMax],
    queryFn: () => api.get(`/teacher/submissions${queryString ? `?${queryString}` : ""}`),
  });

  return (
    <>
      {/* Filtres */}
      <div className="flex flex-wrap gap-3 mb-5">
        <Select value={filterStudent} onValueChange={setFilterStudent}>
          <SelectTrigger className="w-48 h-9 text-sm">
            <SelectValue placeholder="Tous les étudiants" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les étudiants</SelectItem>
            {(students ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.first_name} {s.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={100}
            placeholder="Score min"
            value={filterMin}
            onChange={(e) => setFilterMin(e.target.value)}
            className="w-24 h-9 px-3 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <span className="text-muted-foreground text-sm">–</span>
          <input
            type="number"
            min={0}
            max={100}
            placeholder="Score max"
            value={filterMax}
            onChange={(e) => setFilterMax(e.target.value)}
            className="w-24 h-9 px-3 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {(filterStudent !== "all" || filterMin !== "" || filterMax !== "") && (
          <Button
            size="sm"
            variant="ghost"
            className="h-9 text-xs text-muted-foreground"
            onClick={() => { setFilterStudent("all"); setFilterMin(""); setFilterMax(""); }}
          >
            Réinitialiser
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucune soumission encore.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((sub) => (
            <div
              key={sub.submission_id}
              className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 ${avatarColor(sub.student_name)}`}>
                  {initials(sub.student_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground text-sm">{sub.student_name}</span>
                    <span className="text-muted-foreground text-xs">·</span>
                    <span className="text-muted-foreground text-xs truncate">{sub.topic_title}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-xs text-muted-foreground">{formatDate(sub.created_at)}</p>
                    <span className="text-xs text-muted-foreground">
                      Tests : {sub.tests_passed}/{sub.tests_total} passés
                    </span>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 ${scoreColor(sub.score)}`}>
                  {sub.score !== null ? `${sub.score}/100` : "—"}
                </span>
              </div>

              {sub.code_preview && (
                <div className="mt-3 bg-zinc-950 dark:bg-zinc-900 rounded-lg px-3 py-2 text-xs text-green-400 font-mono line-clamp-3 overflow-hidden">
                  {sub.code_preview}
                </div>
              )}

              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelected(sub)}
                  className="gap-1.5 text-xs"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Voir détail
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              Soumission de {selected?.student_name}
              {selected?.score !== null && selected?.score !== undefined && (
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${scoreColor(selected.score)}`}>
                  {selected.score}/100
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="flex gap-4 text-sm">
              <span className="text-muted-foreground">Topic :</span>
              <span className="font-medium">{selected?.topic_title}</span>
              <span className="text-muted-foreground ml-auto">
                Tests : {selected?.tests_passed}/{selected?.tests_total} passés
              </span>
            </div>

            {selected?.code_preview && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Code soumis</p>
                <div className="bg-zinc-950 dark:bg-zinc-900 rounded-lg p-4 text-xs text-green-400 font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto">
                  {selected.code_preview}
                </div>
              </div>
            )}

            {selected?.feedback && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Feedback de l'Agent Évaluateur</p>
                <div className="bg-muted/50 rounded-lg p-4 text-sm text-foreground leading-relaxed">
                  {selected.feedback}
                </div>
              </div>
            )}

            {selected?.errors_categorized && selected.errors_categorized.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Erreurs catégorisées</p>
                <div className="space-y-2">
                  {selected.errors_categorized.map((err, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <Badge variant="destructive" className="text-xs flex-shrink-0 mt-0.5">{err.type}</Badge>
                      <span className="text-foreground">{err.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

type Tab = "enonces" | "submissions";

const TPMonitor = () => {
  const [activeTab, setActiveTab] = useState<Tab>("enonces");

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Suivi des TPs</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Consultez les énoncés générés par l'IA et les soumissions de vos étudiants.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
          {(
            [
              { id: "enonces", label: "Énoncés générés", icon: BookOpen },
              { id: "submissions", label: "Soumissions", icon: ClipboardList },
            ] as { id: Tab; label: string; icon: typeof BookOpen }[]
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {activeTab === "enonces" ? <EnoncesTab /> : <SubmissionsTab />}
      </div>
    </AppLayout>
  );
};

export default TPMonitor;
