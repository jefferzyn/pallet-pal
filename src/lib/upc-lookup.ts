// UPC/EAN/ISBN product info lookup via Barcode Lookup API.
// Supports UPC, EAN-13, EAN-8, ISBN-10, ISBN-13, JAN, and ITF-14 formats.
export interface UpcResult {
  upc: string;
  name: string;
  brand?: string;
  image_url?: string;
  description?: string;
}

/**
 * Looks up product information using Barcode Lookup API.
 * Requires VITE_BARCODE_LOOKUP_API_KEY environment variable.
 * Falls back to UPCItemDB if Barcode Lookup is unavailable or unconfigured.
 */
export async function lookupUpc(upc: string): Promise<UpcResult | null> {
  const apiKey = import.meta.env.VITE_BARCODE_LOOKUP_API_KEY;

  // Try Barcode Lookup API first (if configured)
  if (apiKey) {
    try {
      const result = await lookupBarcodeLookup(upc, apiKey);
      if (result) return result;
    } catch (e) {
      console.warn("Barcode Lookup API failed, trying fallback", e);
    }
  }

  // Fallback to UPCItemDB free trial
  try {
    const result = await lookupUpcItemDb(upc);
    if (result) return result;
  } catch (e) {
    console.warn("UPC lookup failed", e);
  }

  return null;
}

/**
 * Lookup using Barcode Lookup API (barcodelookup.com)
 * Supports: UPC, EAN-13, EAN-8, ISBN-10, ISBN-13, JAN, ITF-14
 * Documentation: https://www.barcodelookup.com/api
 */
async function lookupBarcodeLookup(upc: string, apiKey: string): Promise<UpcResult | null> {
  const url = new URL("https://api.barcodelookup.com/v3/products");
  url.searchParams.append("barcode", upc);
  url.searchParams.append("key", apiKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    if (response.status === 404) return null; // Not found
    throw new Error(`Barcode Lookup API error: ${response.status}`);
  }

  const data = await response.json();

  // Handle successful response
  if (data.products && Array.isArray(data.products) && data.products.length > 0) {
    const product = data.products[0];
    return {
      upc,
      name: product.title || product.product_name || `Product ${upc}`,
      brand: product.manufacturer || product.brand || undefined,
      image_url: product.images?.[0] || product.thumbnail_url || undefined,
      description: product.description || undefined,
    };
  }

  return null;
}

/**
 * Fallback lookup using UPCItemDB (upcitemdb.com)
 * Free trial endpoint with limited requests
 */
async function lookupUpcItemDb(upc: string): Promise<UpcResult | null> {
  const response = await fetch(
    `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(upc)}`,
  );
  if (!response.ok) return null;

  const data = await response.json();
  const item = data?.items?.[0];
  if (!item) return null;

  return {
    upc,
    name: item.title || `Product ${upc}`,
    brand: item.brand || undefined,
    image_url: Array.isArray(item.images) && item.images[0] ? item.images[0] : undefined,
  };
}
