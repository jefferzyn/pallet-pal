import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Plus, Warehouse } from "lucide-react";
import { createDemoWarehouse, getDemoWarehouses } from "@/lib/demo-store";
import { isDemoSessionActive } from "@/lib/demo-mode";

export const Route = createFileRoute("/warehouses")({
  head: () => ({ meta: [{ title: "Warehouses — PalletCount" }] }),
  component: () => (
    <RequireAuth>
      <WarehousesPage />
    </RequireAuth>
  ),
});

interface WH {
  id: string;
  name: string;
  address: string | null;
  notes: string | null;
}

function WarehousesPage() {
  const { isManagerOrAdmin } = useAuth();
  const [items, setItems] = useState<WH[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    if (isDemoSessionActive()) {
      setItems(getDemoWarehouses());
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("warehouses")
      .select("id,name,address,notes")
      .order("name");
    if (error) toast.error(error.message);
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    if (isDemoSessionActive()) {
      createDemoWarehouse({ name, address: address || null, notes: notes || null });
      setSaving(false);
      toast.success("Warehouse created");
      setOpen(false);
      setName("");
      setAddress("");
      setNotes("");
      void load();
      return;
    }

    const { error } = await supabase
      .from("warehouses")
      .insert({ name, address: address || null, notes: notes || null });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Warehouse created");
    setOpen(false);
    setName("");
    setAddress("");
    setNotes("");
    void load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Warehouses</h1>
          <p className="text-sm text-muted-foreground">Storage locations.</p>
        </div>
        {isManagerOrAdmin() && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> New
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New warehouse</DialogTitle>
              </DialogHeader>
              <form onSubmit={create} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="wname">Name</Label>
                  <Input
                    id="wname"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="waddr">Address</Label>
                  <Input id="waddr" value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wnotes">Notes</Label>
                  <Textarea id="wnotes" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Warehouse className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              {isManagerOrAdmin()
                ? "No warehouses yet. Create one to get started."
                : "No warehouses assigned to you yet. Ask a manager."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((w) => (
            <Link key={w.id} to="/warehouses/$id" params={{ id: w.id }}>
              <Card className="transition hover:border-primary/50 hover:shadow">
                <CardHeader>
                  <CardTitle className="text-base">{w.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{w.address ?? "No address"}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
