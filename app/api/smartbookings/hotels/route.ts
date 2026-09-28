import { NextRequest, NextResponse } from 'next/server';
import { SMARTBOOKINGS_TOKEN, smartbookingsFetch } from '@/lib/smartbookings';
import {
  Hotel,
  normalizeHotel,
  parseStayQuery,
  pickArray,
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

  // The range is sent as "min;max" and the whole query is form-encoded (spaces
  // as "+"), matching what Smartbookings' own search form submits.
  const query = new URLSearchParams({
    place: 'Rwanda',
    bookingrange: toBookingRange(stay.checkin, stay.checkout),
    roomnum: String(stay.rooms),
    adult: String(stay.adults),
    child: String(stay.children),
    range: `${minPrice};${maxPrice}`,
  });
  if (params.get('parking') === 'true') {
    query.set('parkingavailability', 'true');
  }

  try {
    const { ok, status, data } = await smartbookingsFetch(
      `Client-HotelsList/${SMARTBOOKINGS_TOKEN}/${page}/Find?${query}`,
    );
    if (!ok) return NextResponse.json(data, { status });

    const hotels = pickArray(data, ['hotels', 'data', 'list', 'results'])
      .map(normalizeHotel)
      .filter((hotel): hotel is Hotel => hotel !== null);

    return NextResponse.json({ hotels, page });
  } catch (error) {
    console.error('Smartbookings hotels error:', error);
    return NextResponse.json(
      { message: 'Could not load hotels. Please try again.' },
      { status: 500 },
    );
  }
}
