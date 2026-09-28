import { NextRequest, NextResponse } from 'next/server';
import { SMARTBOOKINGS_TOKEN, smartbookingsFetch } from '@/lib/smartbookings';
import {
  normalizeHotelDetail,
  parseStayQuery,
  toUsDate,
} from '@/lib/accommodation';

// One hotel with its rooms, priced for the requested stay.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  if (!/^[a-z0-9]+$/i.test(code)) {
    return NextResponse.json({ message: 'Unknown hotel.' }, { status: 400 });
  }

  const stay = parseStayQuery(request.nextUrl.searchParams);
  if (typeof stay === 'string') {
    return NextResponse.json({ message: stay }, { status: 400 });
  }

  const query = new URLSearchParams({
    adult: String(stay.adults),
    child: String(stay.children),
    numberofroom: String(stay.rooms),
    checkin: toUsDate(stay.checkin),
    checkout: toUsDate(stay.checkout),
  });

  try {
    const { ok, status, data } = await smartbookingsFetch(
      `Client-HotelDetail/${SMARTBOOKINGS_TOKEN}/${code}/Find?${query}`,
    );
    if (!ok) return NextResponse.json(data, { status });

    const hotel = normalizeHotelDetail(data);
    if (!hotel) {
      return NextResponse.json({ message: 'Hotel not found.' }, { status: 404 });
    }
    return NextResponse.json({ hotel });
  } catch (error) {
    console.error('Smartbookings hotel detail error:', error);
    return NextResponse.json(
      { message: 'Could not load this hotel. Please try again.' },
      { status: 500 },
    );
  }
}
