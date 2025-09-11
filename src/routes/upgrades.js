import { z } from "zod";
import { rollerCheckAddons } from "../lib/rollerClient.js";

const slotSchema = z.object({
  product_id: z.string(),
  session_id: z.string(),
  start: z.string(),
  end: z.string(),
  price: z.number()
});

const bodySchema = z.object({
  selected_slot: slotSchema,
  addons: z.array(z.string()).default([])
});

export async function upgradesHandler(req, res) {
  try {
    const body = bodySchema.parse(req.body);
    const data = await rollerCheckAddons(body);
    return res.json({ ok: true, data });
  } catch (e) {
    if (e?.issues) return res.status(400).json({ ok: false, error: "invalid_body", details: e.issues });
    console.error("/upgrades error", e);
    return res.status(500).json({ ok: false, error: "upgrades_failed" });
  }
}
