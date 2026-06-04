import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Boxes, Warehouse, Package, AlertTriangle, Plus } from "lucide-react";
import { getDemoPalletRows, getDemoWarehouses } from "@/lib/demo-store";
import { isDemoSessionActive } from "@/lib/demo-mode";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — PalletCount" }] }),
  component: () => (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  ),
});

interface Stats {
  warehouses: number;
  pallets: number;
  totalBoxes: number;
  lowConfidence: number;
}

interface RecentPallet {
  id: string;
  final_count: number | null;
  ai_count: number | null;
  ai_confidence: number | null;
  status: string;
  captured_at: string;
  warehouses: { name: string } | null;
  products: { name: string; upc: string } | null;
}

const DASHBOARD_REQUEST_TIMEOUT_MS = 5000;

function withTimeout<T>(request: PromiseLike<T>, ms: number, message: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([Promise.resolve(request), timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentPallet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    if (isDemoSessionActive()) {
      const pallets = getDemoPalletRows();
      setStats({
        warehouses: getDemoWarehouses().length,
        pallets: pallets.length,
        totalBoxes: pallets.reduce((s, p) => s + (p.final_count ?? 0), 0),
        lowConfidence: pallets.filter((p) => (p.ai_confidence ?? 1) < 0.6).length,
      });
      setRecent(pallets.slice(0, 8));
      setLoading(false);
      return;
    }

    try {
      const [whRes, palletsRes, recentRes] = await withTimeout(
        Promise.all([
          supabase.from("warehouses").select("id", { count: "exact", head: true }),
          supabase.from("pallets").select("final_count, ai_confidence"),
          supabase
            .from("pallets")
            .select(
              "id, final_count, ai_count, ai_confidence, status, captured_at, warehouses(name), products(name, upc)",
            )
            .order("captured_at", { ascending: false })
            .limit(8),
        ]),
        DASHBOARD_REQUEST_TIMEOUT_MS,
        "Dashboard data request timed out",
      );

      const pallets = palletsRes.data ?? [];
      setStats({
        warehouses: whRes.count ?? 0,
        pallets: pallets.length,
        totalBoxes: pallets.reduce((s, p) => s + (p.final_count ?? 0), 0),
        lowConfidence: pallets.filter((p) => (p.ai_confidence ?? 1) < 0.6).length,
      });
      setRecent((recentRes.data as unknown as RecentPallet[]) ?? []);
    } catch (error) {
      console.error("Unable to load dashboard data", error);
      setStats({ warehouses: 0, pallets: 0, totalBoxes: 0, lowConfidence: 0 });
      setRecent([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of your inventory.</p>
        </div>
        <Button asChild>
          <Link to="/pallets/new">
            <Plus className="h-4 w-4" /> New pallet
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<Warehouse className="h-4 w-4" />}
          label="Warehouses"
          value={stats?.warehouses ?? 0}
          loading={loading}
        />
        <StatCard
          icon={<Boxes className="h-4 w-4" />}
          label="Pallets"
          value={stats?.pallets ?? 0}
          loading={loading}
        />
        <StatCard
          icon={<Package className="h-4 w-4" />}
          label="Total boxes"
          value={stats?.totalBoxes ?? 0}
          loading={loading}
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
          label="Low confidence"
          value={stats?.lowConfidence ?? 0}
          loading={loading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent pallets</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : recent.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">No pallets yet.</p>
              <Button asChild className="mt-3" size="sm">
                <Link to="/pallets/new">Create your first pallet</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y">
              {recent.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/pallets/$id"
                      params={{ id: p.id }}
                      className="block truncate font-medium hover:underline"
                    >
                      {p.products?.name ?? "Unknown product"}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.warehouses?.name ?? "—"} · {new Date(p.captured_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{p.final_count ?? p.ai_count ?? "—"}</p>
                    <Badge
                      variant={p.status === "confirmed" ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {p.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <p className="mt-2 text-2xl font-bold">{loading ? "…" : value}</p>
      </CardContent>
    </Card>
  );
}
