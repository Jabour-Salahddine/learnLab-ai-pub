import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Brain, ArrowLeft, Mail, Lock, User, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/hooks/useTheme";
import { toast } from "sonner";

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const RegisterTeacherPage = () => {
  const navigate = useNavigate();
  const { registerTeacher } = useAuth();
  const [done, setDone] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [form, setForm] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  useTheme();

  const setField = <K extends keyof FormData>(key: K, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.firstName.trim()) e.firstName = "Le prénom est obligatoire";
    if (!form.lastName.trim()) e.lastName = "Le nom est obligatoire";
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = "Email invalide";
    if (form.password.length < 6) e.password = "Minimum 6 caractères";
    if (form.password !== form.confirmPassword) e.confirmPassword = "Les mots de passe ne correspondent pas";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    try {
      await registerTeacher({
        email: form.email,
        password: form.password,
        first_name: form.firstName,
        last_name: form.lastName,
      });
      setDone(true);
      setTimeout(() => navigate("/teacher/dashboard"), 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la création du compte");
    } finally {
      setIsLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-success" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Espace créé ✓</h1>
          <p className="text-muted-foreground">Redirection vers votre espace enseignant...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden gradient-primary items-center justify-center p-12">
        <div className="absolute w-64 h-64 rounded-full bg-accent/20 blur-3xl top-20 left-10 animate-float" />
        <div className="absolute w-48 h-48 rounded-full bg-primary-foreground/10 blur-2xl bottom-32 right-20 animate-float-delayed" />
        <div className="relative z-10 text-center">
          <div className="w-20 h-20 rounded-2xl bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-8">
            <Brain className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold text-primary-foreground mb-4">Espace Enseignant</h1>
          <p className="text-lg text-primary-foreground/80 mb-8">
            Créez votre espace pédagogique intelligent
          </p>
          <div className="space-y-3 text-left">
            {[
              "📋 Créez vos sujets de TP personnalisés",
              "📄 Uploadez vos cours PDF pour le RAG",
              "📊 Suivez la progression de vos étudiants",
              "🤖 Recevez des rapports IA hebdomadaires",
            ].map((f) => (
              <p key={f} className="text-primary-foreground/90 text-sm">{f}</p>
            ))}
          </div>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-6">
          <button
            onClick={() => navigate("/login")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Retour à la connexion
          </button>

          <div className="flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            <span className="font-bold text-foreground">LearnLab AI</span>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground">Créer un espace enseignant</h2>
            <p className="text-muted-foreground mt-1">
              Aucun code d'invitation requis — vous créez votre propre espace.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Prénom *"
                    className={`pl-10 h-12 bg-muted/50 ${errors.firstName ? "border-destructive" : ""}`}
                    value={form.firstName}
                    onChange={(e) => setField("firstName", e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                {errors.firstName && <p className="text-xs text-destructive mt-1">{errors.firstName}</p>}
              </div>
              <div>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Nom *"
                    className={`pl-10 h-12 bg-muted/50 ${errors.lastName ? "border-destructive" : ""}`}
                    value={form.lastName}
                    onChange={(e) => setField("lastName", e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                {errors.lastName && <p className="text-xs text-destructive mt-1">{errors.lastName}</p>}
              </div>
            </div>

            <div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Email professionnel *"
                  className={`pl-10 h-12 bg-muted/50 ${errors.email ? "border-destructive" : ""}`}
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  disabled={isLoading}
                />
              </div>
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
            </div>

            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Mot de passe *"
                  className={`pl-10 h-12 bg-muted/50 ${errors.password ? "border-destructive" : ""}`}
                  value={form.password}
                  onChange={(e) => setField("password", e.target.value)}
                  disabled={isLoading}
                />
              </div>
              {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
            </div>

            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Confirmer le mot de passe *"
                  className={`pl-10 h-12 bg-muted/50 ${errors.confirmPassword ? "border-destructive" : ""}`}
                  value={form.confirmPassword}
                  onChange={(e) => setField("confirmPassword", e.target.value)}
                  disabled={isLoading}
                />
              </div>
              {errors.confirmPassword && <p className="text-xs text-destructive mt-1">{errors.confirmPassword}</p>}
            </div>

            <Button
              type="submit"
              className="w-full h-12 gradient-primary text-primary-foreground font-semibold"
              disabled={isLoading}
            >
              {isLoading ? "Création en cours..." : "Créer mon espace enseignant"}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Après inscription, un code d'invitation vous sera attribué automatiquement.
            Partagez-le avec vos étudiants pour qu'ils puissent rejoindre votre cours.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterTeacherPage;
