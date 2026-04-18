// AI vision: counts boxes on a pallet from sampled video frame data URLs.
// Input: { frames: string[] (data URLs or http URLs), product_hint?: string }
// Output: { estimated_count, confidence, reasoning }
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { frames, product_hint } = await req.json();
    if (!Array.isArray(frames) || frames.length === 0) {
      return json({ error: "frames[] is required" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not set" }, 500);

    const systemPrompt = `You are a warehouse inventory assistant. You count cardboard boxes stacked on a wooden pallet from a short video shown as several frames.

Rules:
- Count UNIQUE boxes visible across the angles. Do NOT double-count the same box visible in multiple frames.
- Boxes hidden behind other boxes cannot be counted directly. Estimate hidden boxes ONLY when visible faces clearly imply a regular grid (e.g., 4x4 visible = ~16 per layer).
- Confidence is 0..1. Use <0.6 if many boxes are occluded, lighting is poor, or angles are insufficient.
- Be conservative. The worker will verify and adjust.`;

    const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      {
        type: "text",
        text: `Estimate the total number of boxes on this pallet.${product_hint ? ` Product hint: ${product_hint}.` : ""} Return via the tool.`,
      },
      ...frames.slice(0, 10).map((url: string) => ({ type: "image_url", image_url: { url } })),
    ];

    const body = {
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "report_count",
            description: "Report the box count estimate.",
            parameters: {
              type: "object",
              properties: {
                estimated_count: { type: "integer", minimum: 0 },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                reasoning: { type: "string" },
              },
              required: ["estimated_count", "confidence", "reasoning"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "report_count" } },
    };

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (resp.status === 429) return json({ error: "Rate limit exceeded. Try again shortly." }, 429);
    if (resp.status === 402) return json({ error: "AI credits exhausted. Add funds in workspace settings." }, 402);
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      return json({ error: "AI gateway error" }, 500);
    }

    const data = await resp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return json({ error: "No tool call in response" }, 500);
    const args = JSON.parse(toolCall.function.arguments);
    return json(args, 200);
  } catch (e) {
    console.error("count-pallet error:", e);
    return json({ error: e instanceof Error ? e.message : "unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
