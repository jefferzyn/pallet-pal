import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Download, Search } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [{ title: "Inventory — PalletCount" }] }),
  component: () => (
    <RequireAuth>
      <InventoryPage />
    </RequireAuth>
  ),
});

interface Row {
  id: string;
  final_count: number | null;
  ai_count: number | null;
  status: string;
  captured_at: string;
  upc: string | null;
  warehouses: { name: string } | null;
  products: { name: string; brand: string | null } | null;
}

function InventoryPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("pallets")
        .select(
          "id, final_count, ai_count, status, captured_at, upc, warehouses(name), products(name, brand)",
        )
        .order("captured_at", { ascending: false });
      setRows((data as unknown as Row[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!q) return rows;
    const s = q.toLowerCase();
    return rows.filter(
      (r) =>
        (r.products?.name ?? "").toLowerCase().includes(s) ||
        (r.products?.brand ?? "").toLowerCase().includes(s) ||
        (r.warehouses?.name ?? "").toLowerCase().includes(s) ||
        (r.upc ?? "").includes(s),
    );
  }, [rows, q]);

  const exportCsv = () => {
    const header = ["Product", "Brand", "UPC", "Warehouse", "Count", "Status", "Captured"];
    const lines = filtered.map((r) =>
      [
        r.products?.name ?? "",
        r.products?.brand ?? "",
        r.upc ?? "",
        r.warehouses?.name ?? "",
        r.final_count ?? r.ai_count ?? "",
        r.status,
        new Date(r.captured_at).toISOString(),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">All pallets across all warehouses.</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Pallets</CardTitle>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search product, brand, UPC, warehouse…"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="hidden sm:table-cell">Warehouse</TableHead>
                  <TableHead className="hidden md:table-cell">UPC</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link
                        to="/pallets/$id"
                        params={{ id: r.id }}
                        className="font-medium hover:underline"
                      >
                        {r.products?.name ?? "Unknown"}
                      </Link>
                      <p className="text-xs text-muted-foreground">{r.products?.brand}</p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">
                      {r.warehouses?.name ?? "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell font-mono text-xs">
                      {r.upc ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {r.final_count ?? r.ai_count ?? "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge
                        variant={r.status === "confirmed" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No pallets found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
