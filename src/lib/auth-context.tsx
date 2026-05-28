import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "admin" | "manager" | "worker";

interface SignUpResult {
  verificationSent: boolean;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  isAuthenticated: boolean;
  hasRole: (role: AppRole) => boolean;
  isManagerOrAdmin: () => boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const AuthContext = React.createContext<AuthState | null>(null);
const DEMO_SESSION_KEY = "pallet-pal-demo-session";

function isNetworkError(error: unknown) {
  return (
    error instanceof TypeError ||
    (error instanceof Error &&
      /failed to fetch|networkerror|load failed|network request failed/i.test(error.message))
  );
}

function authErrorMessage(error: unknown) {
  if (isNetworkError(error)) {
    return "Unable to reach Supabase. Check that VITE_SUPABASE_URL points to an active Supabase project and that the matching Cloudflare variables are set.";
  }

  return error instanceof Error ? error.message : "Authentication request failed";
}

function canUseDemoAuth() {
  return (
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)
  );
}

function createDemoSession(email: string, fullName?: string) {
  const now = Math.floor(Date.now() / 1000);
  const user = {
    id: "local-demo-user",
    aud: "authenticated",
    role: "authenticated",
    email,
    email_confirmed_at: new Date().toISOString(),
    phone: "",
    confirmed_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { full_name: fullName ?? "Local Demo User" },
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_anonymous: false,
  } as User;

  return {
    access_token: "local-demo-token",
    refresh_token: "local-demo-refresh-token",
    expires_in: 3600,
    expires_at: now + 3600,
    token_type: "bearer",
    user,
  } as Session;
}

function readDemoSession() {
  if (!canUseDemoAuth()) return null;

  const raw = window.localStorage.getItem(DEMO_SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Session;
  } catch {
    window.localStorage.removeItem(DEMO_SESSION_KEY);
    return null;
  }
}

function writeDemoSession(session: Session) {
  window.localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [session, setSession] = React.useState<Session | null>(null);
  const [roles, setRoles] = React.useState<AppRole[]>([]);
  const [loading, setLoading] = React.useState(true);

  const loadRoles = React.useCallback(async (uid: string) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    setRoles((data ?? []).map((r) => r.role as AppRole));
  }, []);

  React.useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => void loadRoles(s.user.id), 0);
      } else {
        setRoles([]);
      }
    });
    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        const activeSession = s ?? readDemoSession();
        setSession(activeSession);
        setUser(activeSession?.user ?? null);
        if (activeSession?.user) {
          if (activeSession.access_token === "local-demo-token") {
            setRoles(["admin"]);
          } else {
            void loadRoles(activeSession.user.id);
          }
        }
      })
      .catch((error) => {
        console.error(authErrorMessage(error));
        const demoSession = readDemoSession();
        setSession(demoSession);
        setUser(demoSession?.user ?? null);
        setRoles(demoSession ? ["admin"] : []);
      })
      .finally(() => {
        setLoading(false);
      });
    return () => sub.subscription.unsubscribe();
  }, [loadRoles]);

  const value: AuthState = {
    user,
    session,
    roles,
    loading,
    isAuthenticated: !!user,
    hasRole: (r) => roles.includes(r),
    isManagerOrAdmin: () => roles.includes("admin") || roles.includes("manager"),
    signIn: async (email, password) => {
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } catch (error) {
        if (canUseDemoAuth() && isNetworkError(error)) {
          const demoSession = createDemoSession(email);
          writeDemoSession(demoSession);
          setSession(demoSession);
          setUser(demoSession.user);
          setRoles(["admin"]);
          return;
        }

        throw new Error(authErrorMessage(error));
      }
    },
    signUp: async (email, password, fullName) => {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;

        if (data.session) {
          setSession(null);
          setUser(null);
          setRoles([]);
          await supabase.auth.signOut();
        }

        return { verificationSent: !data.session };
      } catch (error) {
        if (canUseDemoAuth() && isNetworkError(error)) {
          console.info(
            `Local preview: skipped Supabase signup for ${email}. A real verification email will be sent when SUPABASE_URL points to an active project with email confirmations enabled.`,
          );
          return { verificationSent: true };
        }

        throw new Error(authErrorMessage(error));
      }
    },
    signOut: async () => {
      window.localStorage.removeItem(DEMO_SESSION_KEY);
      setSession(null);
      setUser(null);
      setRoles([]);
      try {
        await supabase.auth.signOut();
      } catch (error) {
        if (!isNetworkError(error)) throw error;
      }
    },
    refreshRoles: async () => {
      if (user) await loadRoles(user.id);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
