// Shared accommodation types and helpers, safe to import on both the server
// routes and the accommodation page.
//
// Smartbookings' JSON responses for HotelsList and HotelDetail aren't
// documented, so the normalisers below accept the field names its own hotel
// pages use (`hotcode`, `star`, `cover`, `addr`, `room_id`, `token`) along with
// the obvious alternatives, and the page only ever sees the shapes defined
// here.

export const SMARTBOOKINGS_ORIGIN = 'https://smartbookings.rw';

export interface Hotel {
  code: string;
  name: string;
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
  roomsLeft: number | null;
  amenities: string[];
  // Per-room booking token Smartbookings issues with the hotel detail. The
  // Booking Form expects it back as `token`.
  token: string;
}

export interface HotelDetail extends Hotel {
  images: string[];
  checkInTime: string;
  checkOutTime: string;
  paymentMethods: string[];
  rooms: Room[];
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

function pick(raw: Raw, keys: string[]): unknown {
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null && raw[key] !== '') {
      return raw[key];
    }
  }
  return undefined;
}

function str(raw: Raw, keys: string[]): string {
  const value = pick(raw, keys);
  return value === undefined ? '' : String(value).trim();
}

function num(raw: Raw, keys: string[]): number | null {
  const value = pick(raw, keys);
  if (value === undefined) return null;
  const parsed = parseFloat(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function names(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) =>
      isRecord(item) ? str(item, ['name', 'title', 'label']) : String(item),
    )
    .map((s) => s.trim())
    .filter(Boolean);
}

// Finds the first array in a response, whether it is the response itself or
// sits under a wrapper key such as `hotels` or `data`.
export function pickArray(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];
  for (const key of keys) {
    const candidate = value[key];
    if (Array.isArray(candidate)) return candidate;
    if (isRecord(candidate)) {
      const nested = pickArray(candidate, keys);
      if (nested.length) return nested;
    }
  }
  return [];
}

export function imageUrl(path: string): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  // Smartbookings stores covers relative to its site root, sometimes with a
  // leading "../" from its own templates.
  return `${SMARTBOOKINGS_ORIGIN}/${path.replace(/^(\.\.\/|\/)+/, '')}`;
}

function currencyOf(raw: Raw): string {
  return str(raw, ['currency', 'currency_code', 'devise']) || 'USD';
}

export function normalizeHotel(value: unknown): Hotel | null {
  if (!isRecord(value)) return null;
  const hotel = isRecord(value.hotel) ? { ...value, ...value.hotel } : value;
  const code = str(hotel, ['hotcode', 'hotel_code', 'hotelcode', 'code', 'id']);
  if (!code) return null;
  return {
    code,
    name: str(hotel, ['name', 'hotel_name', 'hotelname', 'title']),
    address: str(hotel, ['addr', 'address', 'location', 'place']),
    stars: Math.min(5, Math.max(0, num(hotel, ['star', 'stars', 'rating']) ?? 0)),
    image: imageUrl(str(hotel, ['cover', 'image', 'photo', 'picture'])),
    description: str(hotel, ['description', 'desc', 'about', 'summary']),
    priceFrom: num(hotel, [
      'price',
      'min_price',
      'minprice',
      'price_from',
      'from',
      'rate',
    ]),
    currency: currencyOf(hotel),
    amenities: names(
      pick(hotel, ['amenities', 'amenties', 'facilities', 'services']),
    ),
  };
}

export function normalizeRoom(value: unknown): Room | null {
  if (!isRecord(value)) return null;
  const id = str(value, ['room_id', 'room_code', 'roomcode', 'roomid', 'id', 'code']);
  if (!id) return null;
  const adults = num(value, ['adult', 'adults', 'max_adult']);
  const children = num(value, ['child', 'children', 'max_child']);
  const capacity =
    str(value, ['capacity']) ||
    (adults !== null
      ? `${adults} adult${adults === 1 ? '' : 's'}${
          children ? `, ${children} child${children === 1 ? '' : 'ren'}` : ''
        }`
      : '');
  return {
    id,
    name: str(value, ['name', 'room_name', 'roomname', 'type', 'room_type', 'title']),
    price: num(value, ['price', 'rate', 'amount', 'room_price']),
    currency: currencyOf(value),
    capacity,
    roomsLeft: num(value, ['left', 'rooms_left', 'available', 'availability', 'quantity']),
    amenities: names(pick(value, ['amenities', 'amenties', 'facilities'])),
    token: str(value, ['token', 'booking_token', 'key']),
  };
}

export function normalizeHotelDetail(value: unknown): HotelDetail | null {
  const root = isRecord(value) && isRecord(value.data) ? value.data : value;
  const hotel = normalizeHotel(root);
  if (!hotel || !isRecord(root)) return null;
  const images = pickArray(root, ['images', 'gallery', 'photos', 'pictures'])
    .map((img) =>
      imageUrl(isRecord(img) ? str(img, ['url', 'path', 'image', 'src']) : String(img)),
    )
    .filter((img): img is string => !!img);
  const rooms = pickArray(root, ['rooms', 'room', 'roomtypes', 'room_types'])
    .map(normalizeRoom)
    .filter((room): room is Room => room !== null);
  const cheapest = rooms
    .map((room) => room.price)
    .filter((price): price is number => price !== null)
    .sort((a, b) => a - b)[0];
  return {
    ...hotel,
    priceFrom: hotel.priceFrom ?? cheapest ?? null,
    images: images.length ? images : hotel.image ? [hotel.image] : [],
    checkInTime: str(root, ['checkin_time', 'checkintime', 'check_in']),
    checkOutTime: str(root, ['checkout_time', 'checkouttime', 'check_out']),
    paymentMethods: names(
      pick(root, ['payment_methods', 'paymentmethods', 'payments', 'payment_method']),
    ),
    rooms,
  };
}

export function formatMoney(amount: number | null, currency: string): string {
  if (amount === null) return '—';
  return `${currency} ${amount.toLocaleString('en-US', {
    maximumFractionDigits: 2,
  })}`;
}
