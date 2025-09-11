import { z } from "zod";
import * as chrono from "chrono-node";

const bodySchema = z.object({
  phrase: z.string().min(1),
  tz: z.string().optional() // reserved; current impl uses server TZ
});

export async function resolveDateHandler(req, res) {
  try {
    const { phrase } = bodySchema.parse(req.body);
    const ref = new Date();
    const parsed = chrono.parse(phrase, ref, { forwardDate: true });
    if (!parsed?.length) return res.json({ ok: false, error: "unresolved" });
    const d = parsed[0].date();
    const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,"0"), day = String(d.getDate()).padStart(2,"0");
    return res.json({ ok: true, data: { date: `${y}-${m}-${day}` }});
  } catch (e) {
    if (e?.issues) return res.status(400).json({ ok: false, error: "invalid_body", details: e.issues });
    return res.status(500).json({ ok: false, error: "resolve_failed" });
  }
}
