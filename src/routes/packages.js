import { z } from "zod";
import { rollerGetProductsByCategory, rollerGetPackageInfo } from "../lib/rollerClient.js";

export async function packagesHandler(req, res) {
  try {
    const bodySchema = z.object({
      category: z.string().optional().default('Parties') // default to Parties category
    });
    const body = bodySchema.parse(req.body ?? {});
    const data = await rollerGetProductsByCategory(body);
    return res.json({ ok: true, data });
  } catch (e) {
    if (e?.issues) return res.status(400).json({ ok: false, error: "invalid_body", details: e.issues });
    console.error("/packages error", e);
    return res.status(500).json({ ok: false, error: "packages_failed" });
  }
}

export async function packageInfoHandler(req, res) {
  try {
    const bodySchema = z.object({
      code: z.string().optional(),
      product_id: z.string().optional(),
      venue_id: z.string().optional()
    }).refine((b) => !!(b.code || b.product_id), { message: "code or product_id required" });

    const body = bodySchema.parse(req.body ?? {});
    const data = await rollerGetPackageInfo(body);
    return res.json({ ok: true, data });
  } catch (e) {
    if (e?.issues) return res.status(400).json({ ok: false, error: "invalid_body", details: e.issues });
    console.error("/package-info error", e);
    return res.status(500).json({ ok: false, error: "package_info_failed" });
  }
}
