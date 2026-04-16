import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { api } from "@/lib/api";
import type {
  UserResponse,
  LoginRequest,
  RegisterStudentRequest,
  RegisterTeacherRequest,
  TokenResponse,
} from "@/types/api";

interface AuthContextType {
  user: UserResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginAsDemo: (role: "student" | "teacher") => Promise<void>;
  registerStudent: (data: RegisterStudentRequest) => Promise<void>;
  registerTeacher: (data: RegisterTeacherRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function saveTokens(data: TokenResponse) {
  localStorage.setItem("access_token", data.access_token);
  localStorage.setItem("refresh_token", data.refresh_token);
  localStorage.setItem("user", JSON.stringify(data.user));
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("user");
      const token = localStorage.getItem("access_token");
      if (stored && token) {
        const parsed = JSON.parse(stored) as UserResponse;
        setUser(parsed);
      }
    } catch {
      localStorage.removeItem("user");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const _handleToken = (data: TokenResponse) => {
    saveTokens(data);
    setUser(data.user);
  };

  const login = async (email: string, password: string) => {
    const data = await api.post<TokenResponse>("/auth/login", { email, password } as LoginRequest);
    _handleToken(data);
  };

  const loginAsDemo = async (role: "student" | "teacher") => {
    const email = role === "student" ? "etudiant@test.ma" : "prof@test.ma";
    await login(email, "test1234");
  };

  const registerStudent = async (data: RegisterStudentRequest) => {
    const res = await api.post<TokenResponse>("/auth/register/student", data);
    _handleToken(res);
  };

  const registerTeacher = async (data: RegisterTeacherRequest) => {
    const res = await api.post<TokenResponse>("/auth/register/teacher", data);
    _handleToken(res);
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        loginAsDemo,
        registerStudent,
        registerTeacher,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
