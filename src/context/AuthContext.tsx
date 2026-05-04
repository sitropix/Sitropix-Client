import {
  api,
  getAccessToken,
  refreshAccessToken,
  setAccessToken,
  type AuthUser,
} from "@/services/http";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  isFirstLogin: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    name: string,
    email: string,
    password: string,
    inviteToken?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  /** Replace session user (e.g. after profile PATCH). */
  updateUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFirstLogin, setIsFirstLogin] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      const token = getAccessToken();
      if (!token) {
        setLoading(false);
        return;
      }
      const refreshed = await refreshAccessToken();
      if (refreshed?.user) {
        setUser(refreshed.user);
        setIsFirstLogin(false);
      }
      else setAccessToken(null);
      setLoading(false);
    }
    void bootstrap();
  }, []);

  async function login(email: string, password: string) {
    const data = await api<{ accessToken: string; user: AuthUser; firstLogin?: boolean }>(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
    );
    setAccessToken(data.accessToken);
    setUser(data.user);
    setIsFirstLogin(Boolean(data.firstLogin));
  }

  async function signup(
    name: string,
    email: string,
    password: string,
    inviteToken?: string,
  ) {
    await api<{ ok: boolean }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        name,
        email,
        password,
        ...(inviteToken ? { inviteToken } : {}),
      }),
    });
  }

  async function logout() {
    await api<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
    setAccessToken(null);
    setUser(null);
    setIsFirstLogin(false);
  }

  function updateUser(next: AuthUser) {
    setUser(next);
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      isFirstLogin,
      login,
      signup,
      logout,
      updateUser,
    }),
    [user, loading, isFirstLogin],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
