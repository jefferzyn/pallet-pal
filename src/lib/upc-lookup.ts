import { supabase } from "@/integrations/supabase/client";

// UPC/EAN/ISBN product info lookup via free Open Facts databases first.
export interface UpcResult {
  upc: string;
  name: string;
  brand?: string;
  image_url?: string;
  description?: string;
}

/**
 * Looks up product information using free public product databases.
 * Automatically saves successful lookups to the database.
 */
export async function lookupUpc(upc: string): Promise<UpcResult | null> {
  try {
    const result = await lookupOpenFacts(upc);
    if (result) {
      await saveProductToDatabase(result);
      return result;
    }
  } catch (e) {
    console.warn("Open Facts UPC lookup failed", e);
  }

  return null;
}

/**
 * Saves or updates a product in the database after lookup.
 */
async function saveProductToDatabase(product: UpcResult): Promise<void> {
  try {
    // Check if product already exists
    const { data: existing, error: selectError } = await supabase
      .from("products")
      .select("id")
      .eq("upc", product.upc)
      .single();

    if (existing) {
      // Update existing product
      const { error: updateError } = await supabase
        .from("products")
        .update({
          name: product.name,
          brand: product.brand,
          image_url: product.image_url,
        })
        .eq("upc", product.upc);

      if (updateError) {
        console.warn("Failed to update product in database:", updateError);
      }
    } else {
      // Insert new product (ignore if it was just created by another request)
      const { error: insertError } = await supabase
        .from("products")
        .insert({
          upc: product.upc,
          name: product.name,
          brand: product.brand,
          image_url: product.image_url,
        })
        .select()
        .single()
        .catch(() => ({ data: null, error: null })); // Ignore unique constraint errors

      if (insertError && insertError.code !== "23505") {
        // 23505 is unique constraint error, which is fine
        console.warn("Failed to insert product into database:", insertError);
      }
    }
  } catch (e) {
    console.warn("Error saving product to database:", e);
  }
}

const OPEN_FACTS_DATABASES = [
  "https://world.openfoodfacts.org",
  "https://world.openbeautyfacts.org",
  "https://world.openpetfoodfacts.org",
  "https://world.openproductsfacts.org",
];

async function lookupOpenFacts(upc: string): Promise<UpcResult | null> {
  for (const baseUrl of OPEN_FACTS_DATABASES) {
    const url = new URL(`/api/v2/product/${encodeURIComponent(upc)}.json`, baseUrl);
    url.searchParams.set("fields", "code,product_name,brands,image_front_url,generic_name");

    const response = await fetch(url.toString());
    if (!response.ok) continue;

    const data = await response.json();
    if (data?.status !== 1 || !data.product) continue;

    const product = data.product;
    const name = product.product_name || product.generic_name;
    if (!name) continue;

    return {
      upc,
      name,
      brand: product.brands || undefined,
      image_url: product.image_front_url || undefined,
      description: product.generic_name || undefined,
    };
  }

  return null;
}
