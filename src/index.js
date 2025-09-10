import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { rankSlots } from './lib/utils.js';
import { rollerFetchAvailability, rollerCreateHold, rollerCheckAddons, rollerGetBookingStatus, rollerCreateCheckoutLink } from './lib/rollerClient.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.post('/roller/checkAvailability', async (req, res) => {
  try {
    const { venue_id, product_id, date, time_window, guests } = req.body;
    const result = await rollerFetchAvailability({ venue_id: venue_id || process.env.ROLLER_VENUE_ID, product_id, date, time_window, guests: Number(guests)||1 });
    const slots = rankSlots(result.slots, { time_window: time_window || {start:'10:00', end:'18:00'} });
    res.json({ slots, alternates: result.alternates || [] });
  } catch (err) { console.error(err); res.status(500).json({ error: 'availability_error', message: err.message }); }
});

app.post('/roller/checkAddons', async (req, res) => {
  try { const { selected_slot, addons = [] } = req.body; const updated = await rollerCheckAddons({ selected_slot, addons }); res.json(updated); }
  catch (err) { console.error(err); res.status(500).json({ error: 'addons_error', message: err.message }); }
});

app.post('/roller/createHold', async (req, res) => {
  try { const { slot, contact, guests, notes } = req.body; const hold = await rollerCreateHold({ slot, contact, guests, notes }); res.json(hold); }
  catch (err) { console.error(err); res.status(500).json({ error: 'hold_error', message: err.message }); }
});

app.post('/roller/createCheckoutLink', async (req, res) => {
  try { const { hold_id, return_url, cancel_url } = req.body; const resp = await rollerCreateCheckoutLink({ hold_id, return_url, cancel_url }); res.json(resp); }
  catch (err) { console.error(err); res.status(500).json({ error: 'checkout_error', message: err.message }); }
});

app.get('/roller/bookingStatus', async (req, res) => {
  try { const { hold_id } = req.query; const status = await rollerGetBookingStatus({ hold_id }); res.json(status); }
  catch (err) { console.error(err); res.status(500).json({ error: 'status_error', message: err.message }); }
});

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const mappings = JSON.parse(readFileSync(join(__dirname, 'config/mappings.json'), 'utf8'));

const port = process.env.PORT || 8080;

// List all packages (for quick comparisons)
app.get('/roller/packages', (req, res) => {
  try {
    if (!mappings || !mappings.packages) {
      return res.status(500).json({ error: 'packages_error', message: 'Packages data not available' });
    }
    const out = Object.entries(mappings.packages).map(([code, p]) => ({
      code, product_id: p.id, name: p.name, basePrice: p.basePrice,
      includes: p.includes, maxGuests: p.maxGuests, durationMins: p.durationMins
    }));
    res.json({ packages: out });
  } catch (err) {
    console.error('Packages endpoint error:', err);
    res.status(500).json({ error: 'packages_error', message: err.message });
  }
});

// Get one package by code or product_id
app.get('/roller/packageInfo', (req, res) => {
  const code = (req.query.code || '').toUpperCase();
  const pid  = (req.query.product_id || '').trim();

  let pkg = null;
  if (code && mappings.packages[code]) pkg = { code, ...mappings.packages[code] };
  if (!pkg && pid) {
    const entry = Object.entries(mappings.packages).find(([, p]) => String(p.id) === pid);
    if (entry) pkg = { code: entry[0], ...entry[1] };
  }

  if (!pkg) return res.status(404).json({ error: 'not_found' });
  res.json(pkg);
});


app.listen(port, () => console.log(`ROLLER middleware listening on :${port}`));
