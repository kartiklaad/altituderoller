import { z } from "zod";
import { rollerCreateHold } from "../lib/rollerClient.js";

const bodySchema = z.object({
  slot: z.object({
    product_id: z.string(),
    session_id: z.string(),
    start: z.string(),
    end: z.string(),
    price: z.number()
  }),
  contact: z.object({
    name: z.string(),
    email: z.string().optional(),
    phone: z.string().optional()
  }),
  guests: z.number().int().min(1),
  notes: z.string().optional()
});

export async function holdHandler(req, res) {
  try {
    const body = bodySchema.parse(req.body);
    const data = await rollerCreateHold(body);
    return res.json({ ok: true, data });
  } catch (e) {
    if (e?.issues) return res.status(400).json({ ok: false, error: "invalid_body", details: e.issues });
    console.error("/hold error", e);
    return res.status(500).json({ ok: false, error: "hold_failed" });
  }
}
