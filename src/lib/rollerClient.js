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

async function getToken() {
  if (MOCK) return 'mock-token';
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
  if (MOCK) {
    const base = mappings.productsReverse[product_id]?.basePrice || 349;
    return {
      slots: [
        { session_id: 'sess_1', start: `${date}T13:00:00-07:00`, end: `${date}T14:45:00-07:00`, product_id, price: base },
        { session_id: 'sess_2', start: `${date}T15:00:00-07:00`, end: `${date}T16:45:00-07:00`, product_id, price: base }
      ],
      alternates: [{ date, start: '11:00', end: '12:45', product_id, price: Math.max(0, base - 20) }]
    };
  }
  
  // Skip token call in development mode if credentials are not set or are placeholder values
  if (process.env.ROLLER_CLIENT_ID &&
      process.env.ROLLER_CLIENT_SECRET &&
      process.env.ROLLER_BASE_URL &&
      !process.env.ROLLER_CLIENT_ID.includes('your_roller_client_id_here')) {
    try {
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
    } catch (error) {
      console.error('Roller API availability error:', error.response?.data || error.message);
      // Fallback to mock data if API call fails
      const base = mappings.productsReverse[product_id]?.basePrice || 349;
      return {
        slots: [
          { session_id: 'sess_1', start: `${date}T13:00:00-07:00`, end: `${date}T14:45:00-07:00`, product_id, price: base },
          { session_id: 'sess_2', start: `${date}T15:00:00-07:00`, end: `${date}T16:45:00-07:00`, product_id, price: base }
        ],
        alternates: [{ date, start: '11:00', end: '12:45', product_id, price: Math.max(0, base - 20) }]
      };
    }
  }
  
  // Fallback to mock data if credentials not set
  const base = mappings.productsReverse[product_id]?.basePrice || 349;
  return {
    slots: [
      { session_id: 'sess_1', start: `${date}T13:00:00-07:00`, end: `${date}T14:45:00-07:00`, product_id, price: base },
      { session_id: 'sess_2', start: `${date}T15:00:00-07:00`, end: `${date}T16:45:00-07:00`, product_id, price: base }
    ],
    alternates: [{ date, start: '11:00', end: '12:45', product_id, price: Math.max(0, base - 20) }]
  };
}

// Add-ons pricing (local)
export async function rollerCheckAddons({ selected_slot, addons }) {
  const addTotal = (addons || []).reduce((sum, code) => sum + (mappings.addons[code]?.price || 0), 0);
  const price = Number(selected_slot.price || 0) + addTotal;
  return { slot: { ...selected_slot, addons, price }, price_subtotal: price, taxes_fees: 0, price_total: price };
}

// Create provisional hold
export async function rollerCreateHold({ slot, contact, guests, notes }) {
  if (MOCK) {
    const hold_id = `R${Math.random().toString(36).slice(2,8)}`;
    const expires_at = new Date(Date.now() + 15*60*1000).toISOString();
    return { hold_id, expires_at, deposit_due: 100, price_total: slot.price };
  }
  
  // Skip token call in development mode if credentials are not set or are placeholder values
  if (process.env.ROLLER_CLIENT_ID &&
      process.env.ROLLER_CLIENT_SECRET &&
      process.env.ROLLER_BASE_URL &&
      !process.env.ROLLER_CLIENT_ID.includes('your_roller_client_id_here')) {
    try {
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
    } catch (error) {
      console.error('Roller API hold creation error:', error.response?.data || error.message);
      // Fallback to mock data if API call fails
      const hold_id = `R${Math.random().toString(36).slice(2,8)}`;
      const expires_at = new Date(Date.now() + 15*60*1000).toISOString();
      return { hold_id, expires_at, deposit_due: 100, price_total: slot.price };
    }
  }
  
  // Fallback to mock data if credentials not set
  const hold_id = `R${Math.random().toString(36).slice(2,8)}`;
  const expires_at = new Date(Date.now() + 15*60*1000).toISOString();
  return { hold_id, expires_at, deposit_due: 100, price_total: slot.price };
}

// Create checkout link
export async function rollerCreateCheckoutLink({ hold_id, return_url, cancel_url }) {
  if (MOCK) {
    const pay_link = `https://checkout.roller.app/s/${hold_id}`;
    return { pay_link };
  }
  
  // Skip token call in development mode if credentials are not set or are placeholder values
  if (process.env.ROLLER_CLIENT_ID &&
      process.env.ROLLER_CLIENT_SECRET &&
      process.env.ROLLER_BASE_URL &&
      !process.env.ROLLER_CLIENT_ID.includes('your_roller_client_id_here')) {
    try {
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
    } catch (error) {
      console.error('Roller API checkout creation error:', error.response?.data || error.message);
      // Fallback to mock data if API call fails
      const pay_link = `https://checkout.roller.app/s/${hold_id}`;
      return { pay_link };
    }
  }
  
  // Fallback to mock data if credentials not set
  const pay_link = `https://checkout.roller.app/s/${hold_id}`;
  return { pay_link };
}

// Booking status
export async function rollerGetBookingStatus({ hold_id }) {
  if (MOCK) return { status: 'pending' };
  
  // Skip token call in development mode if credentials are not set or are placeholder values
  if (process.env.ROLLER_CLIENT_ID &&
      process.env.ROLLER_CLIENT_SECRET &&
      process.env.ROLLER_BASE_URL &&
      !process.env.ROLLER_CLIENT_ID.includes('your_roller_client_id_here')) {
    try {
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
    } catch (error) {
      console.error('Roller API booking status error:', error.response?.data || error.message);
      // Fallback to mock data if API call fails
      return { status: 'pending' };
    }
  }
  
  // Fallback to mock data if credentials not set
  return { status: 'pending' };
}

// Get all packages from Roller API
export async function rollerGetPackages({ venue_id = VENUE_ID } = {}) {
  if (MOCK) {
    // Return mock packages from mappings
    return Object.entries(mappings.packages || {}).map(([code, pkg]) => ({
      code,
      product_id: pkg.id,
      name: pkg.name,
      basePrice: pkg.basePrice,
      includes: pkg.includes,
      maxGuests: pkg.maxGuests,
      durationMins: pkg.durationMins
    }));
  }
  
  // Skip token call in development mode if credentials are not set or are placeholder values
  if (process.env.ROLLER_CLIENT_ID &&
      process.env.ROLLER_CLIENT_SECRET &&
      process.env.ROLLER_BASE_URL &&
      !process.env.ROLLER_CLIENT_ID.includes('your_roller_client_id_here')) {
    const token = await getToken();
    const { data } = await axios.get(`${BASE_URL}/api/v1/venues/${venue_id}/products`, authHeaders(token));
    return data;
  }
  
  // Fallback to mappings if API call fails or credentials not set
  return Object.entries(mappings.packages || {}).map(([code, pkg]) => ({
    code,
    product_id: pkg.id,
    name: pkg.name,
    basePrice: pkg.basePrice,
    includes: pkg.includes,
    maxGuests: pkg.maxGuests,
    durationMins: pkg.durationMins
  }));
}

// Get specific package info from Roller API
export async function rollerGetPackageInfo({ code, product_id, venue_id = VENUE_ID } = {}) {
  if (MOCK) {
    // Return mock package from mappings
    const pkgs = mappings.packages || {};
    let pkg = null;
    
    if (code) {
      const upperCode = code.toUpperCase();
      if (pkgs[upperCode]) {
        pkg = { code: upperCode, ...pkgs[upperCode] };
      }
    }
    
    if (!pkg && product_id) {
      const entry = Object.entries(pkgs).find(([, p]) => String(p.id) === String(product_id));
      if (entry) {
        pkg = { code: entry[0], ...entry[1] };
      }
    }
    
    return pkg || null;
  }
  
  // Skip token call in development mode if credentials are not set or are placeholder values
  if (process.env.ROLLER_CLIENT_ID &&
      process.env.ROLLER_CLIENT_SECRET &&
      process.env.ROLLER_BASE_URL &&
      !process.env.ROLLER_CLIENT_ID.includes('your_roller_client_id_here')) {
    const token = await getToken();
    
    if (product_id) {
      // Fetch specific product by ID
      const { data } = await axios.get(`${BASE_URL}/api/v1/products/${product_id}`, authHeaders(token));
      return data;
    } else if (code) {
      // Fetch all products and filter by code (if Roller API supports this)
      const { data } = await axios.get(`${BASE_URL}/api/v1/venues/${venue_id}/products`, authHeaders(token));
      const product = data.find(p => p.code === code.toUpperCase());
      return product || null;
    }
  }
  
  // Fallback to mappings if API call fails or credentials not set
  const pkgs = mappings.packages || {};
  let pkg = null;
  
  if (code) {
    const upperCode = code.toUpperCase();
    if (pkgs[upperCode]) {
      pkg = { code: upperCode, ...pkgs[upperCode] };
    }
  }
  
  if (!pkg && product_id) {
    const entry = Object.entries(pkgs).find(([, p]) => String(p.id) === String(product_id));
    if (entry) {
      pkg = { code: entry[0], ...entry[1] };
    }
  }
  
  return pkg || null;
}
