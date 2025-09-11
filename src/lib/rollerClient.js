import axios from 'axios';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const mappings = JSON.parse(readFileSync(join(__dirname, '../config/mappings.json'), 'utf8'));

const BASE_URL = (process.env.ROLLER_BASE_URL || '').replace(/\/+$/,'');
const VENUE_ID = process.env.ROLLER_VENUE_ID;
const MOCK = process.env.ROLLER_MOCK === '1';

let cachedToken = null;
let tokenExpiry = 0;

export async function getToken() {
  const now = Math.floor(Date.now()/1000);
  if (cachedToken && now < tokenExpiry - 60) return cachedToken;

  const tokenPath = process.env.ROLLER_TOKEN_PATH || '/token'; // set to '/oauth/token' if your portal shows that
  const tokenUrl = `${BASE_URL}${tokenPath}`;

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.ROLLER_CLIENT_ID,
    client_secret: process.env.ROLLER_CLIENT_SECRET
  });
  if (process.env.ROLLER_AUDIENCE) params.set('audience', process.env.ROLLER_AUDIENCE);

  // Use JSON format as confirmed working in Postman
  const response = await axios.post(tokenUrl, {
    client_id: process.env.ROLLER_CLIENT_ID,
    client_secret: process.env.ROLLER_CLIENT_SECRET
  }, {
    headers: { 'Content-Type': 'application/json' }
  });
  const data = response.data;

  cachedToken = data.access_token;
  tokenExpiry = now + (data.expires_in || 3600);
  return cachedToken;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// Availability
export async function rollerFetchAvailability({ venue_id = VENUE_ID, product_id, date, time_window, guests }) {
  const token = await getToken();
  const { data } = await axios.get(`${BASE_URL}/api/v1/venues/${venue_id}/products/${product_id}/availability`, {
    params: { date, quantity: guests },
    headers: authHeaders(token)
  });
  
  // Transform Roller API response to our format
  const slots = data.sessions?.map(s => ({
    session_id: s.id,
    start: s.start,
    end: s.end,
    product_id,
    price: s.price
  })) || [];
  
  const alternates = data.alternates?.map(a => ({
    date: a.date,
    start: a.start,
    end: a.end,
    product_id,
    price: a.price
  })) || [];
  
  return { slots, alternates };
}

// Add-ons pricing (local)
export async function rollerCheckAddons({ selected_slot, addons }) {
  const addTotal = (addons || []).reduce((sum, code) => sum + (mappings.addons[code]?.price || 0), 0);
  const price = Number(selected_slot.price || 0) + addTotal;
  return { slot: { ...selected_slot, addons, price }, price_subtotal: price, taxes_fees: 0, price_total: price };
}

// Create provisional hold
export async function rollerCreateHold({ slot, contact, guests, notes }) {
  const token = await getToken();
  const { data } = await axios.post(`${BASE_URL}/api/v1/bookings`, {
    product_id: slot.product_id,
    session_id: slot.session_id,
    start_time: slot.start,
    end_time: slot.end,
    guests,
    contact,
    notes,
    price: slot.price
  }, {
    headers: authHeaders(token)
  });
  
  return {
    hold_id: data.hold_id || data.id,
    expires_at: data.expires_at || data.expires,
    deposit_due: data.deposit_due || 100,
    price_total: data.price_total || slot.price
  };
}

// Create checkout link
export async function rollerCreateCheckoutLink({ hold_id, return_url, cancel_url }) {
  const token = await getToken();
  const { data } = await axios.post(`${BASE_URL}/api/v1/checkout/sessions`, {
    hold_id,
    return_url,
    cancel_url
  }, {
    headers: authHeaders(token)
  });
  
  return {
    pay_link: data.pay_link || data.url || data.checkout_url
  };
}

// Booking status
export async function rollerGetBookingStatus({ hold_id }) {
  const token = await getToken();
  const { data } = await axios.get(`${BASE_URL}/api/v1/bookings/${hold_id}`, {
    headers: authHeaders(token)
  });
  
  return {
    status: data.status || 'pending',
    booking_id: data.booking_id || data.id,
    payment_status: data.payment_status,
    confirmed: data.confirmed || false
  };
}

// Get all packages from Roller API
export async function rollerGetPackages({ venue_id = VENUE_ID } = {}) {
  const token = await getToken();
  const { data } = await axios.get(`${BASE_URL}/api/v1/venues/${venue_id}/products`, {
    headers: authHeaders(token)
  });
  return data;
}

// Get specific package info from Roller API
export async function rollerGetPackageInfo({ code, product_id, venue_id = VENUE_ID } = {}) {
  const token = await getToken();
  
  if (product_id) {
    // Fetch specific product by ID
    const { data } = await axios.get(`${BASE_URL}/api/v1/products/${product_id}`, {
      headers: authHeaders(token)
    });
    return data;
  } else if (code) {
    // Fetch all products and filter by code (if Roller API supports this)
    const { data } = await axios.get(`${BASE_URL}/api/v1/venues/${venue_id}/products`, {
      headers: authHeaders(token)
    });
    const product = data.find(p => p.code === code.toUpperCase());
    return product || null;
  }
  
  return null;
}
