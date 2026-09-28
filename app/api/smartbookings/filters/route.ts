import { NextResponse } from 'next/server';
import { smartbookingsFetch } from '@/lib/smartbookings';
import { parseFiltersRange } from '@/lib/accommodation';

// Default stay for the search bar. Smartbookings sets it (and the event dates
// behind it) in its admin, so this only reshapes the dates into ISO form.
export async function GET() {
  try {
    const { ok, status, data } = await smartbookingsFetch('Client-FiltersList/');
    if (!ok) return NextResponse.json(data, { status });

    const raw = data as Record<string, unknown>;
    return NextResponse.json({
      range: parseFiltersRange(raw.bookingrange),
      rooms: Number(raw.roomnum) || 1,
      adults: Number(raw.adult) || 1,
      children: Number(raw.child) || 0,
    });
  } catch (error) {
    console.error('Smartbookings filters error:', error);
    return NextResponse.json(
      { message: 'Could not load the booking defaults.' },
      { status: 500 },
    );
  }
}
