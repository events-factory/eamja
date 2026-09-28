// Server-side Smartbookings configuration.
//
// Smartbookings is the hotel-booking side of Events Factory. Its client API
// takes the event token in the URL path (HotelsList, HotelDetail) rather than
// in a header, so it is only ever added by the /api/smartbookings routes and
// never shipped to the browser.
export const SMARTBOOKINGS_API_URL =
  process.env.SMARTBOOKINGS_API_URL || 'https://smartbookings.rw';

export const SMARTBOOKINGS_TOKEN =
  process.env.SMARTBOOKINGS_TOKEN || '6352677cb785a';

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
