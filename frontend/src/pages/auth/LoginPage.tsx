import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Brain, Mail, Lock, GraduationCap, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/hooks/useTheme";
import { toast } from "sonner";

const LoginPage = () => {
  const { login, loginAsDemo } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  useTheme();

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email || !password) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }
    setIsLoading(true);
    try {
      await login(email, password);
      const user = JSON.parse(localStorage.getItem("user") ?? "{}") as { role?: string };
      navigate(user.role === "teacher" ? "/teacher/dashboard" : "/student/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Identifiants incorrects");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemo = async (role: "student" | "teacher") => {
    setIsLoading(true);
    try {
      await loginAsDemo(role);
      navigate(role === "teacher" ? "/teacher/dashboard" : "/student/dashboard");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Compte démo indisponible — lancez le script seed.py"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden gradient-primary items-center justify-center p-12">
        <div className="absolute w-64 h-64 rounded-full bg-accent/20 blur-3xl top-20 left-10 animate-float" />
        <div className="absolute w-48 h-48 rounded-full bg-primary-foreground/10 blur-2xl bottom-32 right-20 animate-float-delayed" />
        <div className="absolute w-32 h-32 rounded-full bg-accent/30 blur-2xl top-1/2 left-1/3 animate-float-slow" />
        <div className="relative z-10 text-center">
          <div className="w-20 h-20 rounded-2xl bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-8">
            <Brain className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-5xl font-bold text-primary-foreground mb-4">LearnLab AI</h1>
          <p className="text-xl text-primary-foreground/80 mb-10">Votre assistant pédagogique intelligent</p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { icon: "🤖", label: "Agents IA" },
              { icon: "📚", label: "RAG Contextuel" },
              { icon: "⚡", label: "Feedback Instantané" },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-2 bg-primary-foreground/10 backdrop-blur-sm rounded-full px-4 py-2 text-primary-foreground text-sm">
                <span>{f.icon}</span> {f.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:hidden">
            <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mx-auto mb-4">
              <Brain className="w-7 h-7 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">LearnLab AI</h1>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground">Connexion</h2>
            <p className="text-muted-foreground mt-1">Accédez à votre espace d'apprentissage</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-12 bg-muted/50 border-border"
                disabled={isLoading}
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 h-12 bg-muted/50 border-border"
                disabled={isLoading}
              />
            </div>
            <Button
              type="submit"
              className="w-full h-12 gradient-primary text-primary-foreground font-semibold"
              disabled={isLoading}
            >
              {isLoading ? "Connexion..." : "Se connecter"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-sm"><span className="px-4 bg-background text-muted-foreground">Accès rapide (démo)</span></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleDemo("student")}
              disabled={isLoading}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:glow-primary transition-all duration-200 disabled:opacity-50"
            >
              <GraduationCap className="w-8 h-8 text-primary" />
              <span className="text-sm font-medium text-foreground">Étudiant (démo)</span>
              <span className="text-xs text-muted-foreground">etudiant@test.ma</span>
            </button>
            <button
              onClick={() => handleDemo("teacher")}
              disabled={isLoading}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:border-accent/50 hover:glow-accent transition-all duration-200 disabled:opacity-50"
            >
              <BookOpen className="w-8 h-8 text-accent" />
              <span className="text-sm font-medium text-foreground">Enseignant (démo)</span>
              <span className="text-xs text-muted-foreground">prof@test.ma</span>
            </button>
          </div>

          <div className="text-center text-sm text-muted-foreground space-y-2">
            <p>
              Pas encore de compte étudiant ?{" "}
              <button onClick={() => navigate("/register")} className="text-primary hover:underline font-medium">
                S'inscrire (étudiant)
              </button>
            </p>
            <p>
              Vous êtes enseignant ?{" "}
              <button onClick={() => navigate("/register/teacher")} className="text-accent hover:underline font-medium">
                Créer un espace enseignant
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
