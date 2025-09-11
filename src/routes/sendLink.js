import { z } from "zod";
import { sendPaymentLink } from "../lib/notify.js";

const bodySchema = z.object({
  method: z.enum(["sms","email"]),
  to: z.string(),
  link: z.string().url(),
  name: z.string().optional(),
  hold_id: z.string().optional()
});

export async function sendLinkHandler(req, res) {
  try {
    const body = bodySchema.parse(req.body);
    const data = await sendPaymentLink(body);
    return res.json({ ok: true, data });
  } catch (e) {
    if (e?.issues) return res.status(400).json({ ok: false, error: "invalid_body", details: e.issues });
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
