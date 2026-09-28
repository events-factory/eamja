import { NextResponse } from 'next/server';
import { loadFilters } from '@/lib/smartbookings';
import { parseFiltersRange } from '@/lib/accommodation';

// Default stay for the search bar plus the amenities the hotel list can be
// filtered by. Smartbookings sets both in its admin.
export async function GET() {
  try {
    const filters = await loadFilters();
    if (!filters) {
      return NextResponse.json(
        { message: 'Could not load the booking defaults.' },
        { status: 502 },
      );
    }
    return NextResponse.json({
      range: parseFiltersRange(filters.bookingrange),
      rooms: filters.rooms,
      adults: filters.adults,
      children: filters.children,
      place: filters.place,
      amenities: filters.amenities,
    });
  } catch (error) {
    console.error('Smartbookings filters error:', error);
    return NextResponse.json(
      { message: 'Could not load the booking defaults.' },
      { status: 500 },
    );
  }
}
