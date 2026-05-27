// Utility functions for accessing user's pallet videos
import { supabase } from "@/integrations/supabase/client";

export interface VideoRecord {
  id: string;
  upc: string | null;
  product_name: string | null;
  warehouse_name: string | null;
  video_path: string | null;
  signedUrl?: string;
  captured_at: string;
  ai_count: number | null;
  final_count: number | null;
  status: string;
  notes: string | null;
}

interface PalletVideoRow {
  id: string;
  upc: string | null;
  video_path: string | null;
  captured_at: string;
  ai_count: number | null;
  final_count: number | null;
  status: string;
  notes: string | null;
  products: { name: string | null } | null;
  warehouses: { name: string | null } | null;
}

function toVideoRecord(pallet: PalletVideoRow): VideoRecord {
  return {
    id: pallet.id,
    upc: pallet.upc,
    product_name: pallet.products?.name || null,
    warehouse_name: pallet.warehouses?.name || null,
    video_path: pallet.video_path,
    captured_at: pallet.captured_at,
    ai_count: pallet.ai_count,
    final_count: pallet.final_count,
    status: pallet.status,
    notes: pallet.notes,
  };
}

/**
 * Fetch all pallet videos accessible to the current user
 * Returns videos from pallets the user has access to (via warehouse assignments)
 */
export async function getUserPalletVideos(): Promise<VideoRecord[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("User not authenticated");
  }

  // Get user's warehouses
  const { data: userWarehouses } = await supabase
    .from("user_warehouses")
    .select("warehouse_id")
    .eq("user_id", user.id);

  const warehouseIds = userWarehouses?.map((w) => w.warehouse_id) ?? [];

  // Get pallets with video_path from accessible warehouses
  const { data: pallets } = await supabase
    .from("pallets")
    .select(
      `
      id,
      upc,
      video_path,
      captured_at,
      ai_count,
      final_count,
      status,
      notes,
      products(name),
      warehouses(name)
    `,
    )
    .in("warehouse_id", warehouseIds)
    .not("video_path", "is", null)
    .order("captured_at", { ascending: false });

  if (!pallets) {
    return [];
  }

  // Convert to VideoRecord format
  const videos: VideoRecord[] = (pallets as PalletVideoRow[]).map(toVideoRecord);

  return videos;
}

/**
 * Get a signed URL for a pallet video (valid for 10 minutes)
 */
export async function getSignedVideoUrl(videoPath: string): Promise<string | null> {
  const { data } = await supabase.storage.from("pallet-videos").createSignedUrl(videoPath, 600);

  return data?.signedUrl ?? null;
}

/**
 * Fetch pallet videos for a specific warehouse
 */
export async function getWarehouseVideos(warehouseId: string): Promise<VideoRecord[]> {
  const { data: pallets } = await supabase
    .from("pallets")
    .select(
      `
      id,
      upc,
      video_path,
      captured_at,
      ai_count,
      final_count,
      status,
      notes,
      products(name),
      warehouses(name)
    `,
    )
    .eq("warehouse_id", warehouseId)
    .not("video_path", "is", null)
    .order("captured_at", { ascending: false });

  if (!pallets) {
    return [];
  }

  const videos: VideoRecord[] = (pallets as PalletVideoRow[]).map(toVideoRecord);

  return videos;
}
