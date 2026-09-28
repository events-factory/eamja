// Shared accommodation types and helpers, safe to import on both the server
// routes and the accommodation page.
//
// The normalisers at the bottom map Smartbookings' HotelsList and HotelDetail
// responses onto the shapes defined here, so the page never sees raw API
// field names.

export interface Hotel {
  code: string;
  name: string;
  category: string;
  city: string;
  address: string;
  stars: number;
  image: string | null;
  description: string;
  priceFrom: number | null;
  currency: string;
  amenities: string[];
}

export interface Room {
  id: string;
  name: string;
  price: number | null;
  currency: string;
  capacity: string;
  guests: number | null;
  size: string; // e.g. "20 m²"
  bedrooms: string; // e.g. "1 bedroom"
  roomsLeft: number | null;
  amenities: string[];
  // Per-room booking token Smartbookings issues with the hotel detail. The
  // Booking Form expects it back as `token`.
  token: string;
}

// A hotel facility split into its name and detail, e.g. "Internet: wireless
// in entire property (Free)" → { label: "Internet", detail: "wireless…" }.
export interface Facility {
  label: string;
  detail: string;
}

export interface CancellationPolicy {
  type: string;
  description: string;
}

export interface HotelDetail extends Hotel {
  country: string;
  images: string[];
  facilities: Facility[];
  houseRules: {
    checkIn: string;
    checkOut: string;
    children: string;
    pets: string;
  };
  cancellation: CancellationPolicy[];
  // null when Smartbookings doesn't say.
  extraBeds: boolean | null;
  paymentMethods: string[];
  rooms: Room[];
}

// A hotel amenity the list can be filtered by, from Client-FiltersList.
// `key` is Smartbookings' query parameter (sent as `key=1`).
export interface AmenityFilter {
  key: string;
  label: string;
}

export interface HotelListResult {
  hotels: Hotel[];
  page: number;
  lastPage: number;
  total: number;
  perPage: number;
}

export interface StayQuery {
  checkin: string; // YYYY-MM-DD
  checkout: string; // YYYY-MM-DD
  rooms: number;
  adults: number;
  children: number;
}

// What the booking form posts to /api/smartbookings/booking.
export interface BookingRequest {
  title: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  bookingFor: 'myself' | 'someone';
  beneficiaryName: string;
  beneficiaryEmail: string;
  reason: string;
  question: string;
  paymentMethod: string;
  hotelCode: string;
  roomId: string;
  roomToken: string;
  checkin: string;
  checkout: string;
  rooms: number;
  adults: number;
  children: number;
}

// ---- Dates -------------------------------------------------------------
// The page works in ISO dates (what <input type="date"> gives). Smartbookings
// wants MM/DD/YYYY in query strings and epoch seconds at midnight Kigali time
// (UTC+2, no DST) in the Booking Form.

const KIGALI_OFFSET_SECONDS = 2 * 60 * 60;

export function toUsDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
}

export function toBookingRange(checkin: string, checkout: string): string {
  return `${toUsDate(checkin)} - ${toUsDate(checkout)}`;
}

export function toKigaliEpoch(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 1000 - KIGALI_OFFSET_SECONDS;
}

// Client-FiltersList returns its default range as DD/MM/YYYY - DD/MM/YYYY.
export function parseFiltersRange(
  range: unknown,
): { checkin: string; checkout: string } | null {
  if (typeof range !== 'string') return null;
  const match = range.match(
    /(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(\d{2})\/(\d{2})\/(\d{4})/,
  );
  if (!match) return null;
  const [, d1, m1, y1, d2, m2, y2] = match;
  return { checkin: `${y1}-${m1}-${d1}`, checkout: `${y2}-${m2}-${d2}` };
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function nightsBetween(checkin: string, checkout: string): number {
  return Math.round((toKigaliEpoch(checkout) - toKigaliEpoch(checkin)) / 86400);
}

function count(value: string | null, min: number, fallback: number): number {
  const parsed = parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed >= min ? Math.min(parsed, 20) : fallback;
}

// Reads a stay from query params, returning an error message when the dates
// are missing or out of order.
export function parseStayQuery(params: URLSearchParams): StayQuery | string {
  const checkin = params.get('checkin');
  const checkout = params.get('checkout');
  if (!isIsoDate(checkin) || !isIsoDate(checkout)) {
    return 'Choose check-in and check-out dates.';
  }
  if (checkout <= checkin) {
    return 'Check-out must be after check-in.';
  }
  return {
    checkin,
    checkout,
    rooms: count(params.get('rooms'), 1, 1),
    adults: count(params.get('adults'), 1, 1),
    children: count(params.get('children'), 0, 0),
  };
}

// ---- Normalisers ---------------------------------------------------------

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : '';
}

function numberOrNull(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : parseFloat(text(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

// Smartbookings labels currencies as "USD ($)"; only the code is kept.
function currencyCode(value: unknown): string {
  return text(value).split(/\s/)[0] || 'USD';
}

function parseFacility(raw: string): Facility {
  const colon = raw.indexOf(':');
  if (colon === -1) return { label: raw, detail: '' };
  return {
    label: raw.slice(0, colon).trim(),
    detail: raw.slice(colon + 1).trim(),
  };
}

function roomSize(size: unknown, unit: unknown): string {
  const n = numberOrNull(size);
  if (!n) return '';
  return /square met/i.test(text(unit)) || !text(unit)
    ? `${n} m²`
    : `${n} ${text(unit)}`;
}

function joinDistinct(parts: string[]): string {
  return parts.filter((p, i) => p && parts.indexOf(p) === i).join(' — ');
}

// One entry of HotelsList's `data.facilities`.
export function normalizeHotel(value: unknown): Hotel | null {
  if (!isRecord(value)) return null;
  const code = text(value.hotelcode);
  if (!code) return null;
  return {
    code,
    name: text(value.hotelname),
    category: text(value.category),
    city: text(value.city),
    address: text(value.address) || text(value.city),
    stars: Math.min(5, Math.max(0, numberOrNull(value.star) ?? 0)),
    image: text(value.banner) || null,
    description: text(value.description),
    priceFrom: numberOrNull(value.minprice),
    currency: currencyCode(value.currency),
    amenities: strings(value.facilities),
  };
}

// One entry of HotelDetail's `rooms`.
export function normalizeRoom(value: unknown): Room | null {
  if (!isRecord(value)) return null;
  const id = text(value.roomcode);
  if (!id) return null;
  const capacity = numberOrNull(value.capacity);
  return {
    id,
    name: joinDistinct([
      text(value.othername) || text(value.roomtype),
      text(value.roomname),
    ]),
    price: numberOrNull(value.roomprice),
    currency: currencyCode(value.currencyunit),
    capacity: capacity
      ? `Up to ${capacity} guest${capacity === 1 ? '' : 's'}`
      : '',
    guests: capacity,
    size: roomSize(value.roomsize, value.unitmesure),
    bedrooms: /^0\b/.test(text(value.numberofbedroom))
      ? ''
      : text(value.numberofbedroom),
    roomsLeft: numberOrNull(value.available),
    amenities: strings(value.amenties),
    // HotelDetail doesn't issue a per-room token; the booking route generates
    // one when this is empty.
    token: text(value.token),
  };
}

// The whole HotelDetail response: hotel info under `hotel`, with `rooms`,
// `payment`, `facilities` and `policies` alongside it.
export function normalizeHotelDetail(value: unknown): HotelDetail | null {
  if (!isRecord(value) || !isRecord(value.hotel)) return null;
  const info = value.hotel;
  const code = text(info.code);
  if (!code) return null;

  const rooms = (Array.isArray(value.rooms) ? value.rooms : [])
    .map(normalizeRoom)
    .filter((room): room is Room => room !== null);
  const prices = rooms
    .map((room) => room.price)
    .filter((price): price is number => price !== null);
  const policies = isRecord(value.policies) ? value.policies : {};
  const extraBed = isRecord(value.extrabed)
    ? text(value.extrabed.extrabed).toLowerCase()
    : '';
  const banner = text(info.banner);
  const gallery = strings(info.gallery);

  return {
    code,
    name: text(info.name),
    category: text(info.category),
    city: text(info.city),
    country: text(info.country),
    address: text(info.address) || text(info.city),
    stars: Math.min(5, Math.max(0, numberOrNull(info.star) ?? 0)),
    image: banner || gallery[0] || null,
    description: text(info.description),
    priceFrom: prices.length ? Math.min(...prices) : null,
    currency: rooms[0]?.currency ?? 'USD',
    amenities: strings(value.facilities),
    images: gallery.length ? gallery : banner ? [banner] : [],
    facilities: strings(value.facilities).map(parseFacility),
    houseRules: {
      checkIn: text(policies.checkin),
      checkOut: text(policies.checkout),
      children: text(policies['children-policy']),
      pets: text(policies['pets-policy']),
    },
    cancellation: (Array.isArray(policies['cancelation-policy'])
      ? policies['cancelation-policy']
      : []
    )
      .filter(isRecord)
      .map((p) => ({ type: text(p.type), description: text(p.description) }))
      .filter((p) => p.description),
    extraBeds: extraBed === 'yes' ? true : extraBed === 'no' ? false : null,
    paymentMethods: strings(value.payment),
    rooms,
  };
}

export function formatMoney(amount: number | null, currency: string): string {
  if (amount === null) return '—';
  return `${currency} ${amount.toLocaleString('en-US', {
    maximumFractionDigits: 2,
  })}`;
}

// "$30" for dollars, "EUR 30" otherwise.
export function formatPrice(amount: number | null, currency: string): string {
  if (amount === null) return '—';
  const value = amount.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return currency === 'USD' ? `$${value}` : `${currency} ${value}`;
}
