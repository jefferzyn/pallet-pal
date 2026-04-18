import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/pallets/$id")({
  head: () => ({ meta: [{ title: "Pallet — PalletCount" }] }),
  component: () => (
    <RequireAuth>
      <PalletDetail />
    </RequireAuth>
  ),
});

interface PalletRow {
  id: string;
  warehouse_id: string;
  ai_count: number | null;
  ai_confidence: number | null;
  ai_reasoning: string | null;
  final_count: number | null;
  status: string;
  video_path: string | null;
  notes: string | null;
  captured_at: string;
  upc: string | null;
  warehouses: { name: string } | null;
  products: { name: string; brand: string | null } | null;
}

function PalletDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [pallet, setPallet] = useState<PalletRow | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [count, setCount] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Array<{ id: string; previous_count: number | null; new_count: number; created_at: string }>>([]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const load = async () => {
    const { data } = await supabase
      .from("pallets")
      .select("id, warehouse_id, ai_count, ai_confidence, ai_reasoning, final_count, status, video_path, notes, captured_at, upc, warehouses(name), products(name, brand)")
      .eq("id", id)
      .single();
    setPallet(data as unknown as PalletRow);
    setCount((data as unknown as PalletRow)?.final_count ?? 0);

    if (data?.video_path) {
      const { data: signed } = await supabase.storage.from("pallet-videos").createSignedUrl(data.video_path, 600);
      setVideoUrl(signed?.signedUrl ?? null);
    }

    const { data: h } = await supabase
      .from("pallet_count_history")
      .select("id, previous_count, new_count, created_at")
      .eq("pallet_id", id)
      .order("created_at", { ascending: false });
    setHistory(h ?? []);
  };

  const updateCount = async () => {
    if (!user || !pallet) return;
    setSaving(true);
    const prev = pallet.final_count;
    const { error } = await supabase.from("pallets").update({ final_count: count }).eq("id", id);
    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }
    await supabase.from("pallet_count_history").insert({
      pallet_id: id,
      previous_count: prev,
      new_count: count,
      changed_by: user.id,
      reason: "Manual edit",
    });
    toast.success("Updated");
    setSaving(false);
    void load();
  };

  if (!pallet) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{pallet.products?.name ?? "Unknown product"}</h1>
        <p className="text-sm text-muted-foreground">
          {pallet.warehouses?.name} · {new Date(pallet.captured_at).toLocaleString()}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Counts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">AI estimate</p>
              <p className="text-2xl font-bold">{pallet.ai_count ?? "—"}</p>
              {pallet.ai_confidence != null && (
                <Badge variant={pallet.ai_confidence < 0.6 ? "destructive" : "secondary"} className="mt-1">
                  {Math.round(pallet.ai_confidence * 100)}%
                </Badge>
              )}
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Final count</p>
              <p className="text-2xl font-bold">{pallet.final_count ?? "—"}</p>
              <Badge className="mt-1">{pallet.status}</Badge>
            </div>
          </div>
          {pallet.ai_reasoning && (
            <p className="rounded-md bg-muted p-2 text-xs italic text-muted-foreground">{pallet.ai_reasoning}</p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="adjust">Adjust final count</Label>
            <div className="flex gap-2">
              <Input
                id="adjust"
                type="number"
                value={count}
                onChange={(e) => setCount(Math.max(0, parseInt(e.target.value) || 0))}
              />
              <Button onClick={updateCount} disabled={saving || count === pallet.final_count}>
                <Save className="h-4 w-4" /> Save
              </Button>
            </div>
          </div>
          {pallet.notes && <p className="text-sm">{pallet.notes}</p>}
        </CardContent>
      </Card>

      {videoUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Capture video</CardTitle>
          </CardHeader>
          <CardContent>
            <video src={videoUrl} controls className="w-full rounded-lg border" />
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit history</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex justify-between py-2">
                  <span>
                    {h.previous_count ?? "—"} → <strong>{h.new_count}</strong>
                  </span>
                  <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
