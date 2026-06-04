import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { lookupUpc } from "@/lib/upc-lookup";
import { extractFrames } from "@/lib/video-frames";
import { isDemoSessionActive } from "@/lib/demo-mode";
import { createDemoPallet, getDemoWarehouses, upsertDemoProduct } from "@/lib/demo-store";
import { toast } from "sonner";
import {
  Boxes,
  Camera,
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Sparkles,
  Upload,
  Video,
} from "lucide-react";

export const Route = createFileRoute("/pallets/new")({
  head: () => ({ meta: [{ title: "New pallet — PalletCount" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    warehouse: typeof s.warehouse === "string" ? s.warehouse : undefined,
  }),
  component: () => (
    <RequireAuth>
      <NewPallet />
    </RequireAuth>
  ),
});

interface WH {
  id: string;
  name: string;
}

interface ProductInfo {
  id?: string;
  upc: string;
  name: string;
  brand?: string | null;
  image_url?: string | null;
}

interface AiResult {
  estimated_count: number;
  confidence: number;
  reasoning: string;
}

type Step = "warehouse" | "barcode" | "product" | "video" | "review";

function NewPallet() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>("warehouse");
  const [warehouses, setWarehouses] = useState<WH[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>(search.warehouse ?? "");

  const [upc, setUpc] = useState("");
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [productLoading, setProductLoading] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualBrand, setManualBrand] = useState("");

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [ai, setAi] = useState<AiResult | null>(null);

  const [finalCount, setFinalCount] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isDemoSessionActive()) {
      setWarehouses(getDemoWarehouses());
      return;
    }

    void supabase
      .from("warehouses")
      .select("id,name")
      .order("name")
      .then(({ data }) => setWarehouses(data ?? []));
  }, []);

  useEffect(
    () => () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    },
    [videoUrl],
  );

  const handleScan = async (code: string) => {
    setUpc(code);
    await loadProduct(code);
    setStep("product");
  };

  const loadProduct = async (code: string) => {
    setProductLoading(true);
    try {
      if (isDemoSessionActive()) {
        setProduct({ upc: code, name: "", brand: null, image_url: null });
        setManualName("");
        setManualBrand("");
        return;
      }

      const { data: existing } = await supabase
        .from("products")
        .select("id,upc,name,brand,image_url")
        .eq("upc", code)
        .maybeSingle();
      if (existing) {
        setProduct(existing);
        setManualName(existing.name);
        setManualBrand(existing.brand ?? "");
        return;
      }
      const looked = await lookupUpc(code);
      if (looked) {
        setProduct({
          upc: code,
          name: looked.name,
          brand: looked.brand ?? null,
          image_url: looked.image_url ?? null,
        });
        setManualName(looked.name);
        setManualBrand(looked.brand ?? "");
      } else {
        setProduct({ upc: code, name: "", brand: null, image_url: null });
        setManualName("");
        setManualBrand("");
        toast.info("UPC not found in database — fill in product details");
      }
    } finally {
      setProductLoading(false);
    }
  };

  const confirmProduct = async () => {
    if (!manualName.trim()) {
      toast.error("Product name is required");
      return;
    }
    if (isDemoSessionActive()) {
      const data = upsertDemoProduct({
        upc,
        name: manualName.trim(),
        brand: manualBrand.trim() || null,
        image_url: product?.image_url ?? null,
      });
      setProduct(data);
      setStep("video");
      return;
    }

    // Upsert into catalog
    const { data, error } = await supabase
      .from("products")
      .upsert(
        {
          upc,
          name: manualName.trim(),
          brand: manualBrand.trim() || null,
          image_url: product?.image_url ?? null,
        },
        { onConflict: "upc" },
      )
      .select("id,upc,name,brand,image_url")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setProduct(data);
    setStep("video");
  };

  const onVideoChosen = (f: File | null) => {
    if (!f) return;
    if (f.size > 80 * 1024 * 1024) {
      toast.error("Video too large (max ~80MB)");
      return;
    }
    setVideoFile(f);
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(URL.createObjectURL(f));
    setAi(null);
  };

  const analyze = async () => {
    if (!videoFile) return;
    setAnalyzing(true);
    try {
      if (isDemoSessionActive()) {
        const estimated = Math.max(1, Math.min(240, Math.round(videoFile.size / 250_000) + 12));
        setAi({
          estimated_count: estimated,
          confidence: 0.72,
          reasoning: "Local demo estimate generated without calling the AI service.",
        });
        setFinalCount(estimated);
        setStep("review");
        return;
      }

      toast.info("Extracting frames…");
      const frames = await extractFrames(videoFile, 6, 720);
      toast.info("Analyzing with AI vision…");
      const { data, error } = await supabase.functions.invoke("count-pallet", {
        body: { frames, product_hint: product?.name },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAi(data as AiResult);
      setFinalCount(data.estimated_count);
      setStep("review");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "AI analysis failed";
      toast.error(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const save = async () => {
    if (!user || !warehouseId || !product?.id || !videoFile) return;
    setSaving(true);
    try {
      if (isDemoSessionActive()) {
        const pallet = createDemoPallet({
          warehouse_id: warehouseId,
          product_id: product.id,
          upc: product.upc,
          ai_count: ai?.estimated_count ?? null,
          ai_confidence: ai?.confidence ?? null,
          ai_reasoning: ai?.reasoning ?? null,
          final_count: finalCount,
          video_path: videoUrl,
          notes: notes || null,
        });
        toast.success("Pallet recorded");
        navigate({ to: "/pallets/$id", params: { id: pallet.id } });
        return;
      }

      // Upload video
      const path = `${user.id}/${crypto.randomUUID()}-${videoFile.name.replace(/[^a-z0-9.-]/gi, "_")}`;
      const up = await supabase.storage.from("pallet-videos").upload(path, videoFile, {
        contentType: videoFile.type || "video/mp4",
      });
      if (up.error) throw up.error;

      const { data: pallet, error } = await supabase
        .from("pallets")
        .insert({
          warehouse_id: warehouseId,
          product_id: product.id,
          upc: product.upc,
          ai_count: ai?.estimated_count ?? null,
          ai_confidence: ai?.confidence ?? null,
          ai_reasoning: ai?.reasoning ?? null,
          final_count: finalCount,
          status: "confirmed",
          video_path: up.data.path,
          notes: notes || null,
          captured_by: user.id,
        })
        .select("id")
        .single();
      if (error) throw error;

      await supabase.from("pallet_count_history").insert({
        pallet_id: pallet.id,
        previous_count: ai?.estimated_count ?? null,
        new_count: finalCount,
        changed_by: user.id,
        reason: "Initial confirmation",
      });

      toast.success("Pallet recorded");
      navigate({ to: "/pallets/$id", params: { id: pallet.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New pallet</h1>
        <p className="text-sm text-muted-foreground">Capture barcode + video, confirm count.</p>
      </div>

      <Stepper step={step} />

      {step === "warehouse" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Select warehouse</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {warehouses.length === 0 ? (
              <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-900">No warehouses assigned to you</p>
                <p className="text-xs text-amber-800">
                  You don't have access to any warehouses yet. Contact your manager or administrator
                  to:
                </p>
                <ul className="space-y-1 text-xs text-amber-800">
                  <li>• Create a warehouse (if none exist)</li>
                  <li>• Assign you to an existing warehouse</li>
                </ul>
                <Link
                  to="/warehouses"
                  className="inline-block text-xs font-medium text-amber-700 underline hover:text-amber-900"
                >
                  View warehouses
                </Link>
              </div>
            ) : (
              <div className="grid gap-2">
                {warehouses.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => setWarehouseId(w.id)}
                    className={`rounded-md border p-3 text-left transition ${
                      warehouseId === w.id ? "border-primary bg-accent" : "hover:bg-accent/50"
                    }`}
                  >
                    {w.name}
                  </button>
                ))}
              </div>
            )}
            <Button
              className="w-full"
              disabled={!warehouseId}
              onClick={() => setStep("barcode")}
              size="lg"
            >
              Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "barcode" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Scan UPC barcode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <BarcodeScanner onScan={handleScan} />
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or enter manually</span>
              </div>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (upc) void handleScan(upc);
              }}
              className="flex gap-2"
            >
              <Input
                value={upc}
                onChange={(e) => setUpc(e.target.value)}
                placeholder="UPC code"
                inputMode="numeric"
              />
              <Button type="submit">Use</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {step === "product" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Confirm product</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="font-mono text-sm">UPC: {upc}</p>
            {productLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Looking up…
              </p>
            ) : (
              <>
                {product?.image_url && (
                  <img
                    src={product.image_url}
                    alt=""
                    className="h-24 w-24 rounded border object-contain"
                  />
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="pname">Name</Label>
                  <Input
                    id="pname"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pbrand">Brand</Label>
                  <Input
                    id="pbrand"
                    value={manualBrand}
                    onChange={(e) => setManualBrand(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep("barcode")}>
                    Back
                  </Button>
                  <Button className="flex-1" onClick={confirmProduct}>
                    Continue
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {step === "video" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">4. Record / upload video</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Walk slowly around the pallet, capturing all sides. ~10–20 seconds.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              capture="environment"
              className="hidden"
              onChange={(e) => onVideoChosen(e.target.files?.[0] ?? null)}
            />
            {!videoUrl ? (
              <div className="grid gap-2">
                <Button onClick={() => fileRef.current?.click()} size="lg">
                  <Video className="h-5 w-5" /> Record / choose video
                </Button>
              </div>
            ) : (
              <>
                <video src={videoUrl} controls className="w-full rounded-lg border" />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => fileRef.current?.click()}>
                    <RefreshCw className="h-4 w-4" /> Replace
                  </Button>
                  <Button className="flex-1" onClick={analyze} disabled={analyzing}>
                    {analyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Analyzing…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" /> Analyze with AI
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {step === "review" && ai && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">5. Review &amp; confirm</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase text-muted-foreground">
                  AI estimate
                </span>
                <Badge variant={ai.confidence < 0.6 ? "destructive" : "secondary"}>
                  {Math.round(ai.confidence * 100)}% confidence
                </Badge>
              </div>
              <p className="mt-1 text-3xl font-bold">{ai.estimated_count}</p>
              <p className="mt-2 text-xs text-muted-foreground">{ai.reasoning}</p>
              {ai.confidence < 0.6 && (
                <p className="mt-2 text-xs font-medium text-destructive">
                  Low confidence. Please verify carefully or recapture video.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Final count (verify before confirming)</Label>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setFinalCount((v) => Math.max(0, v - 1))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  value={finalCount}
                  onChange={(e) => setFinalCount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="text-center text-lg font-semibold"
                />
                <Button size="icon" variant="outline" onClick={() => setFinalCount((v) => v + 1)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("video")}>
                <Camera className="h-4 w-4" /> Recapture
              </Button>
              <Button className="flex-1" onClick={save} disabled={saving} size="lg">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Confirm &amp; save
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "warehouse", label: "Warehouse" },
    { key: "barcode", label: "Barcode" },
    { key: "product", label: "Product" },
    { key: "video", label: "Video" },
    { key: "review", label: "Confirm" },
  ];
  const idx = steps.findIndex((s) => s.key === step);
  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => (
        <div key={s.key} className="flex flex-1 items-center gap-1">
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
              i <= idx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {i + 1}
          </div>
          {i < steps.length - 1 && (
            <div className={`h-0.5 flex-1 ${i < idx ? "bg-primary" : "bg-muted"}`} />
          )}
        </div>
      ))}
    </div>
  );
}
