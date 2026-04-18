import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Search, Package } from "lucide-react";

export const Route = createFileRoute("/catalog")({
  head: () => ({ meta: [{ title: "Catalog — PalletCount" }] }),
  component: () => (
    <RequireAuth>
      <CatalogPage />
    </RequireAuth>
  ),
});

interface Product {
  id: string;
  upc: string;
  name: string;
  brand: string | null;
  image_url: string | null;
}

function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("products")
        .select("id,upc,name,brand,image_url")
        .order("name");
      setProducts(data ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = q
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(q.toLowerCase()) ||
          (p.brand ?? "").toLowerCase().includes(q.toLowerCase()) ||
          p.upc.includes(q),
      )
    : products;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Product catalog</h1>
        <p className="text-sm text-muted-foreground">Builds automatically as you scan UPCs.</p>
      </div>
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search…"
          className="pl-9"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              No products yet. Scan a UPC to add one.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle className="text-base">{p.name}</CardTitle>
              </CardHeader>
              <CardContent>
                {p.image_url && (
                  <img
                    src={p.image_url}
                    alt={p.name}
                    className="mb-2 h-24 w-24 rounded object-contain"
                  />
                )}
                <p className="text-sm text-muted-foreground">{p.brand ?? "—"}</p>
                <p className="mt-1 font-mono text-xs">{p.upc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
