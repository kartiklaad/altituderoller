import { z } from "zod";
import { rollerFetchAvailability } from "../lib/rollerClient.js";

// Accept either start/end OR time_window {start,end}
const timeWindowSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end:   z.string().regex(/^\d{2}:\d{2}$/)
});

const baseSchema = z.object({
  venue_id: z.string(),
  product_id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.number().int().min(1)
});

const bodySchema = z.union([
  baseSchema.extend({ time_window: timeWindowSchema }),
  baseSchema.extend({ start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/) })
]).transform((b) => {
  if ("time_window" in b) return b;
  return { ...b, time_window: { start: b.start, end: b.end } };
});

export async function availabilityHandler(req, res) {
  try {
    const body = bodySchema.parse(req.body);
    const data = await rollerFetchAvailability({
      venue_id: body.venue_id,
      product_id: body.product_id,
      date: body.date,
      time_window: body.time_window,
      guests: body.guests
    });
    return res.json({ ok: true, data });
  } catch (e) {
    if (e?.issues) return res.status(400).json({ ok: false, error: "invalid_body", details: e.issues });
    console.error("/availability error", e);
    return res.status(500).json({ ok: false, error: "availability_failed" });
  }
}

export async function availabilityBatchHandler(req, res) {
  try {
    const batchSchema = z.object({
      venue_id: z.string(),
      product_id: z.string(),
      requests: z.array(z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        time_window: timeWindowSchema,
        guests: z.number().int().min(1)
      }))
    });
    const body = batchSchema.parse(req.body);
    const results = await Promise.all(
      body.requests.map((r) =>
        rollerFetchAvailability({
          venue_id: body.venue_id,
          product_id: body.product_id,
          date: r.date,
          time_window: r.time_window,
          guests: r.guests
        }).then((data) => ({ date: r.date, ...data }))
      )
    );
    return res.json({ ok: true, data: { results } });
  } catch (e) {
    if (e?.issues) return res.status(400).json({ ok: false, error: "invalid_body", details: e.issues });
    console.error("/availability/batch error", e);
    return res.status(500).json({ ok: false, error: "availability_batch_failed" });
  }
}
