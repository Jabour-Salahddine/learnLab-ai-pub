import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Brain, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/hooks/useTheme";
import { toast } from "sonner";

const FORMATIONS = [
  "Génie Informatique",
  "Data Science",
  "Génie Électrique",
  "Réseaux & Télécoms",
  "Mathématiques Appliquées",
  "Autre",
];

const SKILLS_LIST = [
  "Python", "Java", "R", "SQL", "C/C++",
  "Machine Learning", "Deep Learning",
  "Algorithmes", "Structures de données",
  "Bases de données", "Réseaux", "MATLAB",
];

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  formation: string;
  filiere: string;
  yearOfStudy: number;
  invitationCode: string;
  skills: string[];
}

function getPasswordStrength(password: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (password.length === 0) return { level: 0, label: "", color: "" };
  if (password.length < 6) return { level: 1, label: "Faible", color: "bg-destructive" };
  if (password.length < 9 || !/\d/.test(password)) return { level: 2, label: "Moyen", color: "bg-warning" };
  return { level: 3, label: "Fort", color: "bg-success" };
}

const RegisterPage = () => {
  const navigate = useNavigate();
  const { registerStudent } = useAuth();
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [form, setForm] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    formation: "",
    filiere: "",
    yearOfStudy: 4,
    invitationCode: "",
    skills: [],
  });
  useTheme();

  const setField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const toggleSkill = (s: string) =>
    setField("skills", form.skills.includes(s)
      ? form.skills.filter((x) => x !== s)
      : [...form.skills, s]);

  const validateStep1 = (): boolean => {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.firstName.trim()) e.firstName = "Le prénom est obligatoire";
    if (!form.lastName.trim()) e.lastName = "Le nom est obligatoire";
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = "Email invalide";
    if (form.password.length < 6) e.password = "Minimum 6 caractères";
    if (form.password !== form.confirmPassword) e.confirmPassword = "Les mots de passe ne correspondent pas";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = (): boolean => {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.formation) e.formation = "La formation est obligatoire";
    if (!form.filiere.trim()) e.filiere = "La filière est obligatoire";
    if (!form.invitationCode.trim()) e.invitationCode = "Le code d'invitation est obligatoire";
    if (form.invitationCode.trim().length < 8) e.invitationCode = "Code invalide (minimum 8 caractères)";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep(step + 1);
  };

  const handleSubmit = async () => {
    if (!validateStep2()) return;
    setIsLoading(true);
    try {
      await registerStudent({
        email: form.email,
        password: form.password,
        first_name: form.firstName,
        last_name: form.lastName,
        formation: form.formation,
        filiere: form.filiere,
        year_of_study: form.yearOfStudy,
        invitation_code: form.invitationCode,
      });
      setDone(true);
      setTimeout(() => navigate("/student/dashboard"), 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'inscription");
    } finally {
      setIsLoading(false);
    }
  };

  const strength = getPasswordStrength(form.password);

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-success" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Compte créé ✓</h1>
          <p className="text-muted-foreground mb-2">Redirection vers votre espace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        <button
          onClick={() => navigate("/login")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>

        <div className="flex items-center gap-2 mb-8">
          <Brain className="w-6 h-6 text-primary" />
          <span className="font-bold text-foreground">LearnLab AI</span>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                s < step ? "bg-success text-white" :
                s === step ? "gradient-primary text-primary-foreground" :
                "bg-muted text-muted-foreground"
              }`}>
                {s < step ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < 3 && <div className={`flex-1 h-0.5 transition-all ${s < step ? "bg-success" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl p-6" key={step}>
          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">Vos informations</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Input
                    placeholder="Prénom *"
                    className={`h-11 bg-muted/50 ${errors.firstName ? "border-destructive" : ""}`}
                    value={form.firstName}
                    onChange={(e) => setField("firstName", e.target.value)}
                  />
                  {errors.firstName && <p className="text-xs text-destructive mt-1">{errors.firstName}</p>}
                </div>
                <div>
                  <Input
                    placeholder="Nom *"
                    className={`h-11 bg-muted/50 ${errors.lastName ? "border-destructive" : ""}`}
                    value={form.lastName}
                    onChange={(e) => setField("lastName", e.target.value)}
                  />
                  {errors.lastName && <p className="text-xs text-destructive mt-1">{errors.lastName}</p>}
                </div>
              </div>
              <div>
                <Input
                  placeholder="Email *"
                  type="email"
                  className={`h-11 bg-muted/50 ${errors.email ? "border-destructive" : ""}`}
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                />
                {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
              </div>
              <div>
                <Input
                  placeholder="Mot de passe *"
                  type="password"
                  className={`h-11 bg-muted/50 ${errors.password ? "border-destructive" : ""}`}
                  value={form.password}
                  onChange={(e) => setField("password", e.target.value)}
                />
                {form.password && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3].map((l) => (
                        <div
                          key={l}
                          className={`h-1 flex-1 rounded-full transition-all ${
                            l <= strength.level ? strength.color : "bg-muted"
                          }`}
                        />
                      ))}
                    </div>
                    {strength.label && (
                      <p className={`text-xs ${
                        strength.level === 1 ? "text-destructive" :
                        strength.level === 2 ? "text-warning" : "text-success"
                      }`}>{strength.label}</p>
                    )}
                  </div>
                )}
                {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
              </div>
              <div>
                <Input
                  placeholder="Confirmer le mot de passe *"
                  type="password"
                  className={`h-11 bg-muted/50 ${errors.confirmPassword ? "border-destructive" : ""}`}
                  value={form.confirmPassword}
                  onChange={(e) => setField("confirmPassword", e.target.value)}
                />
                {errors.confirmPassword && (
                  <p className="text-xs text-destructive mt-1">{errors.confirmPassword}</p>
                )}
              </div>
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">Votre profil académique</h2>
              <div>
                <select
                  className={`w-full h-11 rounded-lg bg-muted/50 border px-3 text-foreground text-sm ${
                    errors.formation ? "border-destructive" : "border-border"
                  }`}
                  value={form.formation}
                  onChange={(e) => setField("formation", e.target.value)}
                >
                  <option value="">Formation *</option>
                  {FORMATIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                {errors.formation && <p className="text-xs text-destructive mt-1">{errors.formation}</p>}
              </div>
              <div>
                <Input
                  placeholder="Filière * (ex: IDSI, GSTR, ILIA...)"
                  className={`h-11 bg-muted/50 ${errors.filiere ? "border-destructive" : ""}`}
                  value={form.filiere}
                  onChange={(e) => setField("filiere", e.target.value)}
                />
                {errors.filiere && <p className="text-xs text-destructive mt-1">{errors.filiere}</p>}
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Année d'études *</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((y) => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => setField("yearOfStudy", y)}
                      className={`w-10 h-10 rounded-lg border text-sm font-medium transition-all ${
                        form.yearOfStudy === y
                          ? "gradient-primary text-primary-foreground border-primary"
                          : "border-border bg-muted/50 text-foreground hover:bg-muted"
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">
                  Code d'invitation de votre enseignant *
                </label>
                <Input
                  placeholder="Ex: MS-2025-X7K2M9"
                  className={`h-11 bg-muted/50 font-mono tracking-wider ${
                    errors.invitationCode ? "border-destructive" : ""
                  }`}
                  value={form.invitationCode}
                  onChange={(e) => setField("invitationCode", e.target.value.toUpperCase())}
                />
                {errors.invitationCode ? (
                  <p className="text-xs text-destructive mt-1">{errors.invitationCode}</p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    Ce code vous est fourni par votre enseignant. Il vous rattache à son groupe de cours.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── STEP 3 ── */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">Vos compétences</h2>
              <div className="flex flex-wrap gap-2">
                {SKILLS_LIST.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSkill(s)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      form.skills.includes(s)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Ces informations permettent à l'IA de personnaliser vos TPs dès le premier jour.
              </p>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between mt-6">
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              disabled={step === 1 || isLoading}
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Précédent
            </Button>
            <Button
              className="gradient-primary text-primary-foreground"
              disabled={isLoading}
              onClick={step < 3 ? handleNext : handleSubmit}
            >
              {isLoading
                ? "Création en cours..."
                : step < 3
                ? <>Suivant <ArrowRight className="w-4 h-4 ml-1" /></>
                : "Créer mon compte"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
