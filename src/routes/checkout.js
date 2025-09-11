import { z } from "zod";
import { rollerCreateCheckoutLink } from "../lib/rollerClient.js";

const bodySchema = z.object({
  hold_id: z.string(),
  return_url: z.string().url().optional(),
  cancel_url: z.string().url().optional()
});

export async function checkoutHandler(req, res) {
  try {
    const body = bodySchema.parse(req.body);
    const data = await rollerCreateCheckoutLink(body);
    return res.json({ ok: true, data });
  } catch (e) {
    if (e?.issues) return res.status(400).json({ ok: false, error: "invalid_body", details: e.issues });
    console.error("/checkout error", e);
    return res.status(500).json({ ok: false, error: "checkout_failed" });
  }
}
