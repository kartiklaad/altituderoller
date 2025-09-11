// Backward-compat shim for POST /roller/router { action, args }
// Maps to the new endpoints while keeping old clients working.
export async function routerCompat(req, res) {
  try {
    const { action, args } = req.body || {};
    console.warn("[DEPRECATED] /roller/router called:", action);

    switch (action) {
      case "checkAvailability": {
        // old shape uses time_window; keep it, or derive from start/end
        const payload = {
          venue_id: args?.venue_id,
          product_id: args?.product_id,
          date: args?.date,
          time_window: args?.time_window ?? { start: args?.start, end: args?.end },
          guests: args?.guests
        };
        req.body = payload;
        const mod = await import("./availability.js");
        return mod.availabilityHandler(req, res);
      }
      case "checkAddons": {
        req.body = args;
        const mod = await import("./upgrades.js");
        return mod.upgradesHandler(req, res);
      }
      case "createHold": {
        req.body = args;
        const mod = await import("./hold.js");
        return mod.holdHandler(req, res);
      }
      case "createCheckoutLink": {
        req.body = args;
        const mod = await import("./checkout.js");
        return mod.checkoutHandler(req, res);
      }
      case "bookingStatus": {
        req.body = args;
        const mod = await import("./status.js");
        return mod.statusHandler(req, res);
      }
      case "sendLink": {
        req.body = args;
        const mod = await import("./sendLink.js");
        return mod.sendLinkHandler(req, res);
      }
      case "resolveDate": {
        req.body = args;
        const mod = await import("./resolveDate.js");
        return mod.resolveDateHandler(req, res);
      }
      case "packages": {
        req.body = args ?? {};
        const mod = await import("./packages.js");
        return mod.packagesHandler(req, res);
      }
      case "packageInfo": {
        req.body = args ?? {};
        const mod = await import("./packages.js");
        return mod.packageInfoHandler(req, res);
      }
      default:
        return res.status(400).json({ ok: false, error: "unknown_action" });
    }
  } catch (e) {
    console.error("compat router error", e);
    return res.status(500).json({ ok: false, error: "compat_failed" });
  }
}
