import { z } from "zod";
import { rollerGetBookingStatus } from "../lib/rollerClient.js";

const bodySchema = z.object({ hold_id: z.string() });

export async function statusHandler(req, res) {
  try {
    const body = bodySchema.parse(req.body);
    const data = await rollerGetBookingStatus(body);
    return res.json({ ok: true, data });
  } catch (e) {
    if (e?.issues) return res.status(400).json({ ok: false, error: "invalid_body", details: e.issues });
    console.error("/status error", e);
    return res.status(500).json({ ok: false, error: "status_failed" });
  }
}
