import { Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AppHeader } from "@/components/AppHeader";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" />;
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
