import axios from 'axios';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const mappings = JSON.parse(readFileSync(join(__dirname, '../config/mappings.json'), 'utf8'));

const BASE_URL = process.env.ROLLER_BASE_URL;
const VENUE_ID = process.env.ROLLER_VENUE_ID;

let cachedToken = null;
let tokenExpiry = 0;

async function getToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now < tokenExpiry - 60) return cachedToken;

  // Base + path come from your ROLLER Dev Center "Servers"
  const base = (process.env.ROLLER_BASE_URL || '').replace(/\/+$/, '');
  const tokenPath = process.env.ROLLER_TOKEN_PATH || '/token'; // some tenants use '/oauth/token' — set via env if needed
  const tokenUrl = `${base}${tokenPath}`;

  // Build an x-www-form-urlencoded body
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.ROLLER_CLIENT_ID,
    client_secret: process.env.ROLLER_CLIENT_SECRET
  });
  if (process.env.ROLLER_AUDIENCE) params.set('audience', process.env.ROLLER_AUDIENCE);

  const { data } = await axios.post(tokenUrl, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  cachedToken = data.access_token;
  tokenExpiry = now + (data.expires_in || 3600);
  return cachedToken;
}
function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// Availability
export async function rollerFetchAvailability({ venue_id = VENUE_ID, product_id, date, time_window, guests }) {
  // Skip token call in development mode if credentials are not set or are placeholder values
  if (process.env.ROLLER_CLIENT_ID && 
      process.env.ROLLER_CLIENT_SECRET && 
      process.env.ROLLER_BASE_URL &&
      !process.env.ROLLER_CLIENT_ID.includes('your_roller_client_id_here')) {
    const token = await getToken();
  }
  // TODO: replace with your actual ROLLER availability endpoint.
  // Example (pseudo):
  // const { data } = await axios.get(`${BASE_URL}/v1/venues/${venue_id}/products/${product_id}/availability`, {
  //   params: { date, quantity: guests },
  //   headers: authHeaders(token)
  // });
  // const slots = data.sessions.map(s => ({ session_id: s.id, start: s.start, end: s.end, product_id, price: s.price }));
  // return { slots };

  // Simulated data until real endpoint is plugged in:
  const slots = [
    { session_id: 'sess_1', start: `${date}T13:00:00-07:00`, end: `${date}T14:45:00-07:00`, product_id, price: mappings.productsReverse[product_id]?.basePrice || 349 },
    { session_id: 'sess_2', start: `${date}T15:00:00-07:00`, end: `${date}T16:45:00-07:00`, product_id, price: mappings.productsReverse[product_id]?.basePrice || 349 }
  ];
  const alternates = [{ date, start: '11:00', end: '12:45', product_id, price: Math.max(0,(mappings.productsReverse[product_id]?.basePrice || 349)-20) }];
  return { slots, alternates };
}

// Add-ons pricing
export async function rollerCheckAddons({ selected_slot, addons }) {
  const addTotal = (addons || []).reduce((sum, code) => sum + (mappings.addons[code]?.price || 0), 0);
  const price = Number(selected_slot.price || 0) + addTotal;
  return { slot: { ...selected_slot, addons, price }, price_subtotal: price, taxes_fees: 0, price_total: price };
}

// Create provisional hold
export async function rollerCreateHold({ slot, contact, guests, notes }) {
  // Skip token call in development mode if credentials are not set or are placeholder values
  if (process.env.ROLLER_CLIENT_ID && 
      process.env.ROLLER_CLIENT_SECRET && 
      process.env.ROLLER_BASE_URL &&
      !process.env.ROLLER_CLIENT_ID.includes('your_roller_client_id_here')) {
    const token = await getToken();
  }
  // TODO: replace with create cart/booking endpoint
  const hold_id = `R${Math.random().toString(36).slice(2,8)}`;
  const expires_at = new Date(Date.now() + 15*60*1000).toISOString();
  return { hold_id, expires_at, deposit_due: 100, price_total: slot.price };
}

// Create checkout link
export async function rollerCreateCheckoutLink({ hold_id, return_url, cancel_url }) {
  // Skip token call in development mode if credentials are not set or are placeholder values
  if (process.env.ROLLER_CLIENT_ID && 
      process.env.ROLLER_CLIENT_SECRET && 
      process.env.ROLLER_BASE_URL &&
      !process.env.ROLLER_CLIENT_ID.includes('your_roller_client_id_here')) {
    const token = await getToken();
  }
  // TODO: replace with hosted checkout session creation
  const pay_link = `https://checkout.roller.app/s/${hold_id}`;
  return { pay_link };
}

// Booking status
export async function rollerGetBookingStatus({ hold_id }) {
  // Skip token call in development mode if credentials are not set or are placeholder values
  if (process.env.ROLLER_CLIENT_ID && 
      process.env.ROLLER_CLIENT_SECRET && 
      process.env.ROLLER_BASE_URL &&
      !process.env.ROLLER_CLIENT_ID.includes('your_roller_client_id_here')) {
    const token = await getToken();
  }
  // TODO: poll booking/cart by hold_id or read from webhook cache
  return { status: 'pending' };
}
