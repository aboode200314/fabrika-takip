import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const payloadSchema = z.object({
  url: z.string().url().max(2000),
  payload: z.record(z.string(), z.unknown()),
});

/**
 * Forwards a JSON payload from the operator's form to the configured n8n webhook.
 * Runs server-side so corporate webhook URLs can be hit without browser CORS issues.
 * Best-effort: returns ok=false on network failure but never throws to the caller.
 */
export const forwardToWebhook = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => payloadSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      const res = await fetch(data.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.payload),
      });
      return { ok: res.ok, status: res.status };
    } catch (err) {
      console.error("[webhook] forward failed", err);
      return { ok: false, status: 0, error: String(err) };
    }
  });
