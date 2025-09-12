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

  const tokenPath = process.env.ROLLER_TOKEN_PATH || '/token';
  const tokenUrl = `${BASE_URL}${tokenPath}`;

  // Use JSON format as confirmed working in Postman
  const response = await axios.post(tokenUrl, {
    grant_type: 'client_credentials',
    client_id: process.env.ROLLER_CLIENT_ID,
    client_secret: process.env.ROLLER_CLIENT_SECRET,
    ...(process.env.ROLLER_AUDIENCE && { audience: process.env.ROLLER_AUDIENCE })
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
  const { data } = await axios.get(`${BASE_URL}/product-availability/`, {
    params: {
      ProductIds: product_id,
      Date: date
    },
    headers: authHeaders(token)
  });
  
  // Transform Roller API response to our format
  // The response is an array of products with sessions
  const product = data && data.length > 0 ? data[0] : null;
  if (!product || !product.sessions) {
    return { slots: [], alternates: [] };
  }
  
  const slots = product.sessions.map(s => ({
    session_id: s.id || `${s.startTime}-${s.endTime}`,
    start: s.startTime,
    end: s.endTime,
    product_id,
    price: product.products?.[0]?.cost || 0,
    capacity_remaining: s.capacityRemaining,
    date: s.date
  }));
  
  // Roller API doesn't provide alternates in the same way, so we'll return empty
  const alternates = [];
  
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
  const { data } = await axios.post(`${BASE_URL}/bookings`, {
    productId: slot.product_id,
    sessionId: slot.session_id,
    startTime: slot.start,
    endTime: slot.end,
    guests,
    contact,
    notes,
    price: slot.price
  }, {
    headers: authHeaders(token)
  });
  
  return {
    hold_id: data.holdId || data.id,
    expires_at: data.expiresAt || data.expires,
    deposit_due: data.depositDue || 100,
    price_total: data.priceTotal || slot.price
  };
}

// Create checkout link
export async function rollerCreateCheckoutLink({ hold_id, return_url, cancel_url }) {
  const token = await getToken();
  const { data } = await axios.post(`${BASE_URL}/checkout/sessions`, {
    holdId: hold_id,
    returnUrl: return_url,
    cancelUrl: cancel_url
  }, {
    headers: authHeaders(token)
  });
  
  return {
    pay_link: data.payLink || data.url || data.checkoutUrl
  };
}

// Booking status
export async function rollerGetBookingStatus({ hold_id }) {
  const token = await getToken();
  const { data } = await axios.get(`${BASE_URL}/bookings/${hold_id}`, {
    headers: authHeaders(token)
  });
  
  return {
    status: data.status || 'pending',
    booking_id: data.bookingId || data.id,
    payment_status: data.paymentStatus,
    confirmed: data.confirmed || false
  };
}

// Get all products in a specific category from Roller API
export async function rollerGetProductsByCategory({ category = 'Parties' } = {}) {
  const token = await getToken();
  const { data } = await axios.get(`${BASE_URL}/products`, {
    params: {
      ProductCategory: category
    },
    headers: authHeaders(token)
  });
  return data;
}

// Get specific package info from Roller API
export async function rollerGetPackageInfo({ code, product_id, venue_id = VENUE_ID } = {}) {
  const token = await getToken();
  
  if (product_id) {
    // Use the correct endpoint from Postman: /product-availability/
    const { data } = await axios.get(`${BASE_URL}/product-availability/`, {
      params: {
        ProductIds: product_id,
        Date: new Date().toISOString().split('T')[0] // Today's date in YYYY-MM-DD format
      },
      headers: authHeaders(token)
    });
    
    // Return the first product from the array
    return data && data.length > 0 ? data[0] : null;
  } else if (code) {
    // For code-based lookup, we'd need to fetch all products first
    // This would require a different endpoint or we could use the same approach
    throw new Error('Code-based lookup not implemented yet - use product_id instead');
  }
  
  return null;
}
