import 'dotenv/config';
import express from "express";
import cors from "cors";
import { availabilityHandler, availabilityBatchHandler } from "./routes/availability.js";
import { upgradesHandler } from "./routes/upgrades.js";
import { holdHandler } from "./routes/hold.js";
import { checkoutHandler } from "./routes/checkout.js";
import { statusHandler } from "./routes/status.js";
import { sendLinkHandler } from "./routes/sendLink.js";
import { resolveDateHandler } from "./routes/resolveDate.js";
import { packagesHandler, packageInfoHandler } from "./routes/packages.js";
import { routerCompat } from "./routes/compatRouter.js";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cors({
  origin: [/^https:\/\/.*\.vapi\.ai$/, "http://localhost:3000", "http://localhost:5173"],
  methods: ["POST","OPTIONS","GET"]
}));

app.get("/health", (_, res) => res.json({ ok: true, ts: Date.now() }));

// Dedicated endpoints
app.post("/availability", availabilityHandler);
app.post("/availability/batch", availabilityBatchHandler); // optional parallel checks
app.post("/upgrades", upgradesHandler);  // (formerly add-ons)
app.post("/hold", holdHandler);
app.post("/checkout", checkoutHandler);
app.post("/status", statusHandler);
app.post("/send-link", sendLinkHandler);
app.post("/resolve-date", resolveDateHandler);

// Packages (live Roller; still allow Regina to use file if desired)
app.post("/packages", packagesHandler);
app.post("/package-info", packageInfoHandler);

// Backward compatibility for existing clients
app.post("/roller/router", routerCompat);

app.use((err, req, res, next) => {
  console.error("Unhandled error", err);
  res.status(500).json({ ok: false, error: "internal_error" });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API listening on ${port}`));// Trigger deployment Fri Sep 12 00:42:57 EDT 2025
