// UPC product info lookup with cache via products table.
// Tries UPCItemDB free trial endpoint, returns minimal product data.
export interface UpcResult {
  upc: string;
  name: string;
  brand?: string;
  image_url?: string;
}

export async function lookupUpc(upc: string): Promise<UpcResult | null> {
  try {
    const r = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(upc)}`);
    if (!r.ok) return null;
    const data = await r.json();
    const item = data?.items?.[0];
    if (!item) return null;
    return {
      upc,
      name: item.title || `Product ${upc}`,
      brand: item.brand || undefined,
      image_url: Array.isArray(item.images) && item.images[0] ? item.images[0] : undefined,
    };
  } catch (e) {
    console.warn("UPC lookup failed", e);
    return null;
  }
}
