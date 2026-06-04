import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Plus, ArrowLeft } from "lucide-react";
import { getDemoPalletRows, getDemoWarehouses } from "@/lib/demo-store";
import { isDemoSessionActive } from "@/lib/demo-mode";

export const Route = createFileRoute("/warehouses/$id")({
  head: () => ({ meta: [{ title: "Warehouse — PalletCount" }] }),
  component: () => (
    <RequireAuth>
      <WarehouseDetail />
    </RequireAuth>
  ),
});

interface WH {
  id: string;
  name: string;
  address: string | null;
}
interface Pallet {
  id: string;
  final_count: number | null;
  ai_count: number | null;
  status: string;
  captured_at: string;
  products: { name: string } | null;
}

function WarehouseDetail() {
  const { id } = Route.useParams();
  const [wh, setWh] = useState<WH | null>(null);
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      if (isDemoSessionActive()) {
        setWh(getDemoWarehouses().find((warehouse) => warehouse.id === id) ?? null);
        setPallets(getDemoPalletRows().filter((pallet) => pallet.warehouse_id === id));
        setLoading(false);
        return;
      }

      const [a, b] = await Promise.all([
        supabase.from("warehouses").select("id,name,address").eq("id", id).single(),
        supabase
          .from("pallets")
          .select("id, final_count, ai_count, status, captured_at, products(name)")
          .eq("warehouse_id", id)
          .order("captured_at", { ascending: false }),
      ]);
      setWh(a.data);
      setPallets((b.data as unknown as Pallet[]) ?? []);
      setLoading(false);
    })();
  }, [id]);

  return (
    <div className="space-y-6">
      <Link
        to="/warehouses"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Warehouses
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{wh?.name ?? "…"}</h1>
          <p className="text-sm text-muted-foreground">{wh?.address ?? ""}</p>
        </div>
        <Button asChild>
          <Link to="/pallets/new" search={{ warehouse: id } as never}>
            <Plus className="h-4 w-4" /> New pallet
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pallets ({pallets.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : pallets.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No pallets recorded yet.
            </p>
          ) : (
            <ul className="divide-y">
              {pallets.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/pallets/$id"
                      params={{ id: p.id }}
                      className="block truncate font-medium hover:underline"
                    >
                      {p.products?.name ?? "Unknown product"}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.captured_at).toLocaleString()}
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
