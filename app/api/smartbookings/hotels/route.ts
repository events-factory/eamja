import { NextRequest, NextResponse } from 'next/server';
import {
  SMARTBOOKINGS_TOKEN,
  loadFilters,
  smartbookingsFetch,
} from '@/lib/smartbookings';
import {
  Hotel,
  HotelListResult,
  normalizeHotel,
  parseStayQuery,
  toBookingRange,
} from '@/lib/accommodation';

// Hotels available to EAMJA delegates for a stay. The event token scopes the
// list to the conference's partner hotels.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const stay = parseStayQuery(params);
  if (typeof stay === 'string') {
    return NextResponse.json({ message: stay }, { status: 400 });
  }

  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1);
  const minPrice = Math.max(0, parseInt(params.get('min') ?? '0', 10) || 0);
  const maxPrice = parseInt(params.get('max') ?? '', 10) || 100000;

  // `range` is required (HotelsList fails without it) and is sent as
  // "min;max". The query is form-encoded (spaces as "+"), matching what
  // Smartbookings' own search form submits.
  const query = new URLSearchParams({
    place: 'Rwanda',
    bookingrange: toBookingRange(stay.checkin, stay.checkout),
    roomnum: String(stay.rooms),
    adult: String(stay.adults),
    child: String(stay.children),
    range: `${minPrice};${maxPrice}`,
  });

  // HotelsList takes a single star rating.
  const star = parseInt(params.get('star') ?? '', 10);
  if (star >= 1 && star <= 5) query.set('star', String(star));

  try {
    // Amenities are sent as `key=1`. An unknown key makes HotelsList fail, so
    // only keys Client-FiltersList lists are passed on.
    const requested = (params.get('amenities') ?? '').split(',').filter(Boolean);
    if (requested.length) {
      const known = new Set((await loadFilters())?.amenities.map((a) => a.key));
      requested
        .filter((key) => known.has(key))
        .forEach((key) => query.set(key, '1'));
    }

    const { ok, status, data } = await smartbookingsFetch(
      `Client-HotelsList/${SMARTBOOKINGS_TOKEN}/${page}/Find?${query}`,
    );
    if (!ok) return NextResponse.json(data, { status });

    const raw = data as {
      data?: { facilities?: unknown[] };
      last_page?: number;
      total?: number;
      per_page?: number;
    };
    const hotels = (raw.data?.facilities ?? [])
      .map(normalizeHotel)
      .filter((hotel): hotel is Hotel => hotel !== null);

    const result: HotelListResult = {
      hotels,
      page,
      lastPage: Number(raw.last_page) || page,
      total: Number(raw.total) || hotels.length,
      perPage: Number(raw.per_page) || hotels.length,
    };
    return NextResponse.json(result);
  } catch (error) {
    console.error('Smartbookings hotels error:', error);
    return NextResponse.json(
      { message: 'Could not load hotels. Please try again.' },
      { status: 500 },
    );
  }
}
