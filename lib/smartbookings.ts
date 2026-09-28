import type { AmenityFilter } from '@/lib/accommodation';

// Server-side Smartbookings configuration.
//
// Smartbookings is the hotel-booking side of Events Factory. Its client API
// takes the event token in the URL path (HotelsList, HotelDetail) rather than
// in a header, so it is only ever added by the /api/smartbookings routes and
// never shipped to the browser.
export const SMARTBOOKINGS_API_URL =
  process.env.SMARTBOOKINGS_API_URL || 'https://smartbookings.rw';

export const SMARTBOOKINGS_EVENT_CODE =
  process.env.SMARTBOOKINGS_EVENT_CODE || '6352677cb785a';

// The token is the base64 of the event code. The raw code passes
// Smartbookings' key check but then fails with an empty 500.
export const SMARTBOOKINGS_TOKEN = Buffer.from(
  SMARTBOOKINGS_EVENT_CODE,
).toString('base64');

// Smartbookings answers failures with an empty body and a 500, which
// `response.json()` can't parse, so every call goes through here and a
// readable message comes back instead.
export async function smartbookingsFetch(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const response = await fetch(`${SMARTBOOKINGS_API_URL}/${path}`, {
    ...init,
    cache: 'no-store',
  });
  const text = await response.text();

  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok || data === null) {
    return {
      ok: false,
      status: response.ok ? 502 : response.status,
      data: {
        message:
          'The hotel booking service is not responding right now. Please try again shortly.',
      },
    };
  }

  return { ok: true, status: response.status, data };
}

// Smartbookings' own amenity labels have a few misspellings; these are shown
// corrected. The keys are still sent exactly as Smartbookings defines them.
const AMENITY_LABELS: Record<string, string> = {
  famillyroom: 'Family room',
  internetavailability: 'Wifi',
  nonsmokingroom: 'Non Smoking',
  parkingavailability: 'Parking',
  pooltablw: 'Pool table',
  swimingpool: 'Swimming pool',
  airconditioning: 'Air conditioning',
  electriccharge: 'EV charger',
};

export interface SmartbookingsFilters {
  place: string;
  bookingrange: unknown;
  rooms: number;
  adults: number;
  children: number;
  amenities: AmenityFilter[];
}

let filtersCache: { at: number; value: SmartbookingsFilters } | null = null;
const FILTERS_TTL_MS = 10 * 60 * 1000;

// Client-FiltersList, cached briefly: the hotels route checks amenity keys
// against it on every search, and an unknown key makes HotelsList fail.
export async function loadFilters(): Promise<SmartbookingsFilters | null> {
  if (filtersCache && Date.now() - filtersCache.at < FILTERS_TTL_MS) {
    return filtersCache.value;
  }
  const { ok, data } = await smartbookingsFetch('Client-FiltersList/');
  if (!ok) return null;

  const raw = data as Record<string, unknown>;
  const groups = Array.isArray(raw.amenities) ? raw.amenities : [];
  // Hotel-level amenities are the group whose options are boolean flags
  // (`bar: true`); the room-amenity groups use numeric ids HotelsList ignores.
  const amenities: AmenityFilter[] = [];
  for (const group of groups as { subCategory?: unknown }[]) {
    const options = Array.isArray(group.subCategory) ? group.subCategory : [];
    for (const option of options as Record<string, unknown>[]) {
      const key = String(option.searchID ?? '');
      if (option.value !== true || !/^[a-z]+$/.test(key)) continue;
      amenities.push({
        key,
        label: AMENITY_LABELS[key] ?? String(option.name ?? key).trim(),
      });
    }
  }

  const value: SmartbookingsFilters = {
    place: String(raw.place ?? '') || 'Rwanda',
    bookingrange: raw.bookingrange,
    rooms: Number(raw.roomnum) || 1,
    adults: Number(raw.adult) || 1,
    children: Number(raw.child) || 0,
    amenities,
  };
  filtersCache = { at: Date.now(), value };
  return value;
}
