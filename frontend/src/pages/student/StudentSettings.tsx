import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { LogOut, Moon, Sun, User, Info } from "lucide-react";

const StudentSettings = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Paramètres</h1>

        {/* Mon compte */}
        <section className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Mon compte</h2>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="text-sm font-medium text-foreground">{user?.email}</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Nom complet</p>
            <p className="text-sm font-medium text-foreground">
              {user?.first_name} {user?.last_name}
            </p>
          </div>

          <Button
            variant="destructive"
            className="w-full"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Se déconnecter
          </Button>
        </section>

        {/* Thème */}
        <section className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            {isDark ? (
              <Moon className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Sun className="w-4 h-4 text-muted-foreground" />
            )}
            <h2 className="font-semibold text-foreground">Thème</h2>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">
              Mode {isDark ? "sombre" : "clair"}
            </span>
            <button
              onClick={toggleTheme}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                isDark ? "bg-primary" : "bg-muted"
              }`}
              aria-label="Changer de thème"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  isDark ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </section>

        {/* À propos */}
        <section className="bg-card border border-border rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">À propos</h2>
          </div>
          <p className="text-sm text-muted-foreground">LearnLab AI — v1.0.0</p>
          <p className="text-sm text-muted-foreground">PFA 2025-2026 — FST Mohammedia</p>
        </section>
      </div>
    </AppLayout>
  );
};

export default StudentSettings;
