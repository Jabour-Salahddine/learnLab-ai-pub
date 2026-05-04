import { ReactNode, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { useNotifications } from "@/context/NotificationContext";
import {
  LayoutDashboard, BookOpen, History, User, Settings, LogOut,
  Bell, Moon, Sun, ChevronLeft, ChevronRight, Brain,
  Users, Database, BarChart3, X, CheckCheck, Library,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const studentNav = [
  { label: "Tableau de bord", icon: LayoutDashboard, path: "/student/dashboard" },
  { label: "TPs disponibles", icon: BookOpen, path: "/student/tps" },
  { label: "Mon historique", icon: History, path: "/student/history" },
  { label: "Ressources du cours", icon: Library, path: "/student/resources" },
  { label: "Mon profil", icon: User, path: "/student/profile" },
  { label: "Paramètres", icon: Settings, path: "/student/settings" },
];

const teacherNav = [
  { label: "Vue d'ensemble", icon: LayoutDashboard, path: "/teacher/dashboard" },
  { label: "Mes Étudiants", icon: Users, path: "/teacher/students" },
  { label: "Gestion des TPs", icon: BookOpen, path: "/teacher/tps" },
  { label: "Documents RAG", icon: Database, path: "/teacher/rag" },
  { label: "Rapports IA", icon: BarChart3, path: "/teacher/reports" },
  { label: "Mon profil", icon: User, path: "/teacher/profile" },
  { label: "Paramètres", icon: Settings, path: "/teacher/settings" },
];

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const role = user?.role ?? "student";
  const navItems = role === "student" ? studentNav : teacherNav;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const initials = [user?.first_name?.[0], user?.last_name?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className={`${collapsed ? "w-16" : "w-60"} flex-shrink-0 bg-card border-r border-border flex flex-col transition-all duration-200`}>
        {/* Logo */}
        <div className="h-16 flex items-center gap-2 px-4 border-b border-border">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
            <Brain className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && <span className="font-bold text-foreground">LearnLab AI</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="mx-2 mb-2 p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
          title={collapsed ? "Développer" : "Réduire"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {/* User */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-semibold text-sm flex-shrink-0">
              {initials}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            )}
          </div>
          {!collapsed && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive mt-3 w-full transition-colors"
            >
              <LogOut className="w-4 h-4" /> Déconnexion
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <span>{role === "student" ? "Espace Étudiant" : "Espace Enseignant"}</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Notifications */}
            <div className="relative">
              <button
                className="relative p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                onClick={() => { setNotifOpen(!notifOpen); if (!notifOpen) markAllRead(); }}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-destructive rounded-full text-white text-[9px] flex items-center justify-center font-bold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-12 w-80 bg-card border border-border rounded-xl shadow-lg z-50">
                  <div className="flex items-center justify-between p-3 border-b border-border">
                    <span className="font-semibold text-foreground text-sm">Notifications</span>
                    <div className="flex items-center gap-1">
                      <button onClick={markAllRead} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                        <CheckCheck className="w-3 h-3" /> Tout lire
                      </button>
                      <button onClick={() => setNotifOpen(false)} className="ml-2 text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground p-6">Aucune notification</p>
                    ) : (
                      notifications.slice(0, 10).map((n) => (
                        <div
                          key={n.id}
                          onClick={() => markRead(n.id)}
                          className={`p-3 border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 transition-colors ${
                            !n.read ? "bg-primary/5" : ""
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-base">{n.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground font-medium">{n.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                              <p className="text-xs text-muted-foreground/70 mt-1">
                                {new Date(n.createdAt).toLocaleString("fr-FR", {
                                  hour: "2-digit", minute: "2-digit",
                                  day: "2-digit", month: "short",
                                })}
                              </p>
                            </div>
                            {!n.read && (
                              <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
};
