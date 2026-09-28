'use client';

// Native Smartbookings booking flow (search → hotel → room → booking), used by
// /accommodation-2. /accommodation still embeds Smartbookings' own page.
//
// The step lives in the URL (stay → ?hotel= → &room=) so Back, refresh and
// shared links all land on the same screen.

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  AmenityFilter,
  HotelDetail,
  StayQuery,
  parseStayQuery,
} from '@/lib/accommodation';
import BookingForm from './accommodation/BookingForm';
import HotelDetailView from './accommodation/HotelDetailView';
import { HotelList, SearchBar } from './accommodation/HotelSearch';
import {
  API,
  ErrorPanel,
  Spinner,
  getJson,
  isoFromNow,
  stayParams,
} from './accommodation/ui';

interface FiltersResponse {
  range: { checkin: string; checkout: string } | null;
  rooms: number;
  adults: number;
  children: number;
  place: string;
  amenities: AmenityFilter[];
}

export default function HotelBooking({
  initialStay,
}: {
  initialStay?: StayQuery;
}) {
  return (
    <Suspense fallback={<Spinner label="Loading…" />}>
      <AccommodationFlow initialStay={initialStay} />
    </Suspense>
  );
}

function AccommodationFlow({ initialStay }: { initialStay?: StayQuery }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const parsed = parseStayQuery(new URLSearchParams(params.toString()));
  const hotelCode = params.get('hotel');
  const roomId = params.get('room');

  // Place, amenity tiles and (when the page gives no dates) the default stay.
  const [filters, setFilters] = useState<FiltersResponse | null>(null);
  useEffect(() => {
    getJson<FiltersResponse>(`${API}/filters`)
      .then(setFilters)
      .catch(() =>
        setFilters({
          range: null,
          rooms: 1,
          adults: 1,
          children: 0,
          place: 'Rwanda',
          amenities: [],
        }),
      );
  }, []);

  // A page-supplied stay lists hotels straight away; the URL overrides it once
  // the visitor searches.
  const stay: StayQuery | null =
    typeof parsed !== 'string'
      ? parsed
      : (initialStay ??
        (filters
          ? {
              checkin: filters.range?.checkin ?? isoFromNow(0),
              checkout: filters.range?.checkout ?? isoFromNow(1),
              rooms: filters.rooms,
              adults: filters.adults,
              children: filters.children,
            }
          : null));

  function navigate(next: StayQuery, extra: Record<string, string> = {}) {
    const q = stayParams(next);
    Object.entries(extra).forEach(([k, v]) => q.set(k, v));
    router.push(`${pathname}?${q}`, { scroll: false });
  }

  if (!stay) return <Spinner label="Loading…" />;

  if (hotelCode) {
    return (
      <HotelPage
        stay={stay}
        code={hotelCode}
        roomId={roomId}
        onHome={() => navigate(stay)}
        onChangeStay={(next) => navigate(next, { hotel: hotelCode })}
        onSelectRoom={(id) => {
          navigate(stay, { hotel: hotelCode, room: id });
          window.scrollTo({ top: 0 });
        }}
        onBackToRooms={() => navigate(stay, { hotel: hotelCode })}
      />
    );
  }

  const place = filters?.place ?? 'Rwanda';
  return (
    <div className="space-y-6">
      <SearchBar
        key={stayParams(stay).toString()}
        initial={stay}
        place={place}
        onSearch={(next) => navigate(next)}
      />
      <HotelList
        stay={stay}
        place={place}
        amenities={filters?.amenities ?? []}
        onOpen={(hotel) => {
          navigate(stay, { hotel: hotel.code });
          window.scrollTo({ top: 0 });
        }}
      />
    </div>
  );
}

function HotelPage({
  stay,
  code,
  roomId,
  onHome,
  onChangeStay,
  onSelectRoom,
  onBackToRooms,
}: {
  stay: StayQuery;
  code: string;
  roomId: string | null;
  onHome: () => void;
  onChangeStay: (stay: StayQuery) => void;
  onSelectRoom: (roomId: string) => void;
  onBackToRooms: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    hotel?: HotelDetail;
    error?: string;
  } | null>(null);
  const url = `${API}/hotels/${encodeURIComponent(code)}?${stayParams(stay)}`;
  const requestKey = `${url}#${attempt}`;

  // Each result carries the request it answers, so a stale one reads as
  // loading rather than showing the previous hotel.
  useEffect(() => {
    let cancelled = false;
    getJson<{ hotel: HotelDetail }>(url)
      .then((d) => !cancelled && setResult({ key: requestKey, hotel: d.hotel }))
      .catch((e: Error) => !cancelled && setResult({ key: requestKey, error: e.message }));
    return () => {
      cancelled = true;
    };
  }, [url, requestKey]);

  const current = result?.key === requestKey ? result : null;
  if (current?.error) {
    return <ErrorPanel message={current.error} onRetry={() => setAttempt((n) => n + 1)} />;
  }
  const hotel = current?.hotel;
  if (!hotel) return <Spinner label="Loading hotel…" />;

  const room = roomId ? hotel.rooms.find((r) => r.id === roomId) : null;
  if (room) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={onBackToRooms}
          className="text-sm font-medium"
          style={{ color: 'var(--sky2)' }}
        >
          ← Back to {hotel.name}
        </button>
        <BookingForm hotel={hotel} room={room} stay={stay} />
      </div>
    );
  }

  return (
    <HotelDetailView
      hotel={hotel}
      stay={stay}
      onHome={onHome}
      onChangeStay={onChangeStay}
      onSelectRoom={(r) => onSelectRoom(r.id)}
    />
  );
}
