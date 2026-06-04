import { isDemoSessionActive } from "@/lib/demo-mode";
import type { VideoRecord } from "@/lib/video-access";

export interface DemoWarehouse {
  id: string;
  name: string;
  address: string | null;
  notes: string | null;
}

export interface DemoProduct {
  id: string;
  upc: string;
  name: string;
  brand: string | null;
  image_url: string | null;
}

export interface DemoPallet {
  id: string;
  warehouse_id: string;
  product_id: string;
  upc: string | null;
  ai_count: number | null;
  ai_confidence: number | null;
  ai_reasoning: string | null;
  final_count: number | null;
  status: string;
  video_path: string | null;
  notes: string | null;
  captured_at: string;
}

interface DemoStore {
  warehouses: DemoWarehouse[];
  products: DemoProduct[];
  pallets: DemoPallet[];
  history: Array<{
    id: string;
    pallet_id: string;
    previous_count: number | null;
    new_count: number;
    created_at: string;
  }>;
}

const STORE_KEY = "pallet-pal-demo-data";

const defaultStore: DemoStore = {
  warehouses: [
    {
      id: "demo-warehouse",
      name: "Demo Warehouse",
      address: "Local preview",
      notes: "Seeded for local testing.",
    },
  ],
  products: [],
  pallets: [],
  history: [],
};

function readStore(): DemoStore {
  if (!isDemoSessionActive()) return defaultStore;
  const raw = window.localStorage.getItem(STORE_KEY);
  if (!raw) return structuredClone(defaultStore);

  try {
    return { ...structuredClone(defaultStore), ...JSON.parse(raw) };
  } catch {
    window.localStorage.removeItem(STORE_KEY);
    return structuredClone(defaultStore);
  }
}

function writeStore(store: DemoStore) {
  window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

export function getDemoWarehouses() {
  return readStore().warehouses;
}

export function createDemoWarehouse(input: Omit<DemoWarehouse, "id">) {
  const store = readStore();
  const warehouse = { ...input, id: crypto.randomUUID() };
  store.warehouses.push(warehouse);
  writeStore(store);
  return warehouse;
}

export function getDemoProducts() {
  return readStore().products;
}

export function upsertDemoProduct(input: Omit<DemoProduct, "id">) {
  const store = readStore();
  const existing = store.products.find((product) => product.upc === input.upc);
  if (existing) {
    Object.assign(existing, input);
    writeStore(store);
    return existing;
  }

  const product = { ...input, id: crypto.randomUUID() };
  store.products.push(product);
  writeStore(store);
  return product;
}

export function createDemoPallet(
  input: Omit<DemoPallet, "id" | "captured_at" | "status" | "video_path"> & {
    video_path?: string | null;
  },
) {
  const store = readStore();
  const pallet: DemoPallet = {
    ...input,
    id: crypto.randomUUID(),
    status: "confirmed",
    video_path: input.video_path ?? null,
    captured_at: new Date().toISOString(),
  };
  store.pallets.unshift(pallet);
  store.history.unshift({
    id: crypto.randomUUID(),
    pallet_id: pallet.id,
    previous_count: pallet.ai_count,
    new_count: pallet.final_count ?? 0,
    created_at: pallet.captured_at,
  });
  writeStore(store);
  return pallet;
}

export function getDemoPalletRows() {
  const store = readStore();
  return store.pallets.map((pallet) => ({
    ...pallet,
    warehouses: store.warehouses.find((warehouse) => warehouse.id === pallet.warehouse_id) ?? null,
    products: store.products.find((product) => product.id === pallet.product_id) ?? null,
  }));
}

export function getDemoPallet(id: string) {
  return getDemoPalletRows().find((pallet) => pallet.id === id) ?? null;
}

export function updateDemoPalletCount(id: string, newCount: number) {
  const store = readStore();
  const pallet = store.pallets.find((item) => item.id === id);
  if (!pallet) return null;

  const previous = pallet.final_count;
  pallet.final_count = newCount;
  store.history.unshift({
    id: crypto.randomUUID(),
    pallet_id: id,
    previous_count: previous,
    new_count: newCount,
    created_at: new Date().toISOString(),
  });
  writeStore(store);
  return pallet;
}

export function getDemoPalletHistory(palletId: string) {
  return readStore().history.filter((entry) => entry.pallet_id === palletId);
}

export function getDemoVideos(): VideoRecord[] {
  return getDemoPalletRows()
    .filter((pallet) => pallet.video_path)
    .map((pallet) => ({
      id: pallet.id,
      warehouse_id: pallet.warehouse_id,
      upc: pallet.upc,
      product_name: pallet.products?.name ?? null,
      warehouse_name: pallet.warehouses?.name ?? null,
      video_path: pallet.video_path,
      captured_at: pallet.captured_at,
      ai_count: pallet.ai_count,
      final_count: pallet.final_count,
      status: pallet.status,
      notes: pallet.notes,
    }));
}
