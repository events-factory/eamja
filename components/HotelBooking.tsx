'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import SearchableSelect from '@/components/SearchableSelect';
import { countryNames } from '@/lib/countries';
import {
  BookingRequest,
  Hotel,
  HotelDetail,
  Room,
  StayQuery,
  formatMoney,
  nightsBetween,
  parseStayQuery,
} from '@/lib/accommodation';

const API = '/api/smartbookings';

const TITLES = ['MR', 'MRS', 'MS', 'DR', 'PROF', 'HON'];
const REASONS = ['Business', 'Leisure'];
const DEFAULT_PAYMENT_METHODS = ['MasterCard', 'Visa Card', 'Onsite Payment'];

const inputBase =
  'w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:outline-none bg-white';
const inputOk =
  'border-gray-300 focus:ring-primary-500/30 focus:border-primary-500';
const inputErr = 'border-red-500 focus:ring-red-400';

const poppins = { fontFamily: 'var(--font-poppins),sans-serif' };

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { message?: string }).message ||
        'Something went wrong. Please try again.',
    );
  }
  return data as T;
}

function stayParams(stay: StayQuery): URLSearchParams {
  return new URLSearchParams({
    checkin: stay.checkin,
    checkout: stay.checkout,
    rooms: String(stay.rooms),
    adults: String(stay.adults),
    children: String(stay.children),
  });
}

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function isoFromNow(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

// Native Smartbookings booking flow (search → hotel → room → booking). Not
// mounted while Client-HotelsList/Client-HotelDetail return 500 for the EAMJA
// token; /accommodation embeds Smartbookings' own page instead. Render
// <HotelBooking /> from app/accommodation/page.tsx to switch back.
export default function HotelBooking() {
  return (
    <Suspense fallback={<Spinner label="Loading…" />}>
      <AccommodationFlow />
    </Suspense>
  );
}

// The step lives in the URL (stay → ?hotel= → &room=) so Back, refresh and
// shared links all land on the same screen.
function AccommodationFlow() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const parsed = parseStayQuery(new URLSearchParams(params.toString()));
  const stay = typeof parsed === 'string' ? null : parsed;
  const hotelCode = params.get('hotel');
  const roomId = params.get('room');

  const [defaultStay, setDefaultStay] = useState<StayQuery | null>(null);

  // No stay in the URL yet: start from the dates Smartbookings suggests.
  useEffect(() => {
    if (stay || defaultStay) return;
    const fallback = {
      checkin: isoFromNow(0),
      checkout: isoFromNow(1),
      rooms: 1,
      adults: 1,
      children: 0,
    };
    getJson<{
      range: { checkin: string; checkout: string } | null;
      rooms: number;
      adults: number;
      children: number;
    }>(`${API}/filters`)
      .then((d) =>
        setDefaultStay({
          checkin: d.range?.checkin ?? fallback.checkin,
          checkout: d.range?.checkout ?? fallback.checkout,
          rooms: d.rooms,
          adults: d.adults,
          children: d.children,
        }),
      )
      .catch(() => setDefaultStay(fallback));
  }, [stay, defaultStay]);

  function navigate(next: StayQuery, extra: Record<string, string> = {}) {
    const q = stayParams(next);
    Object.entries(extra).forEach(([k, v]) => q.set(k, v));
    router.push(`${pathname}?${q}`, { scroll: false });
  }

  const searchStay = stay ?? defaultStay;

  return (
    <div className="space-y-6">
      {searchStay ? (
        <SearchBar
          key={stayParams(searchStay).toString()}
          initial={searchStay}
          onSearch={(next) => navigate(next)}
        />
      ) : (
        <div className="panel p-6 h-[92px] animate-pulse" />
      )}

      {!stay ? (
        <div className="panel p-10 text-center">
          <p style={{ color: 'var(--muted)' }}>
            Choose your dates and guests, then search to see the partner hotels
            available for the conference.
          </p>
        </div>
      ) : hotelCode ? (
        <HotelView
          stay={stay}
          code={hotelCode}
          roomId={roomId}
          onBack={() => navigate(stay)}
          onSelectRoom={(room) =>
            navigate(stay, { hotel: hotelCode, room: room.id })
          }
          onChangeRoom={() => navigate(stay, { hotel: hotelCode })}
        />
      ) : (
        <HotelList
          stay={stay}
          onOpen={(hotel) => navigate(stay, { hotel: hotel.code })}
        />
      )}
    </div>
  );
}

// ---- Search ----------------------------------------------------------------

function SearchBar({
  initial,
  onSearch,
}: {
  initial: StayQuery;
  onSearch: (stay: StayQuery) => void;
}) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = parseStayQuery(stayParams(form));
    if (typeof result === 'string') {
      setError(result);
      return;
    }
    setError('');
    onSearch(result);
  }

  const today = isoFromNow(0);

  return (
    <form onSubmit={submit} className="panel p-4 sm:p-5">
      <div className="grid grid-cols-2 lg:grid-cols-[1fr_1fr_repeat(3,110px)_auto] gap-3 items-end">
        <Field label="Check-in" htmlFor="checkin">
          <input
            id="checkin"
            type="date"
            min={today}
            value={form.checkin}
            onChange={(e) => setForm({ ...form, checkin: e.target.value })}
            className={`${inputBase} ${inputOk}`}
            required
          />
        </Field>
        <Field label="Check-out" htmlFor="checkout">
          <input
            id="checkout"
            type="date"
            min={form.checkin || today}
            value={form.checkout}
            onChange={(e) => setForm({ ...form, checkout: e.target.value })}
            className={`${inputBase} ${inputOk}`}
            required
          />
        </Field>
        <NumberField
          id="rooms"
          label="Rooms"
          min={1}
          value={form.rooms}
          onChange={(rooms) => setForm({ ...form, rooms })}
        />
        <NumberField
          id="adults"
          label="Adults"
          min={1}
          value={form.adults}
          onChange={(adults) => setForm({ ...form, adults })}
        />
        <NumberField
          id="children"
          label="Children"
          min={0}
          value={form.children}
          onChange={(children) => setForm({ ...form, children })}
        />
        <button
          type="submit"
          className="btn-primary col-span-2 lg:col-span-1 px-6 py-2 rounded-lg text-white text-sm font-semibold h-[38px]"
        >
          Search
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </form>
  );
}

// ---- Hotel list ------------------------------------------------------------

function HotelList({
  stay,
  onOpen,
}: {
  stay: StayQuery;
  onOpen: (hotel: Hotel) => void;
}) {
  const query = stayParams(stay).toString();
  const [page, setPage] = useState(1);
  const [pageQuery, setPageQuery] = useState(query);
  const [result, setResult] = useState<{
    key: string;
    hotels?: Hotel[];
    error?: string;
  } | null>(null);
  const [minStars, setMinStars] = useState(0);
  const [maxPrice, setMaxPrice] = useState('');
  const [parking, setParking] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // A new search starts again from the first page.
  if (pageQuery !== query) {
    setPageQuery(query);
    setPage(1);
  }

  const q = new URLSearchParams(query);
  q.set('page', String(page));
  if (parking) q.set('parking', 'true');
  if (maxPrice) q.set('max', maxPrice);
  const url = `${API}/hotels?${q}`;
  const requestKey = `${url}#${attempt}`;

  // Each result carries the request it answers, so a stale one reads as
  // loading rather than showing the previous search.
  useEffect(() => {
    let cancelled = false;
    getJson<{ hotels: Hotel[] }>(url)
      .then((d) => !cancelled && setResult({ key: requestKey, hotels: d.hotels }))
      .catch(
        (e: Error) => !cancelled && setResult({ key: requestKey, error: e.message }),
      );
    return () => {
      cancelled = true;
    };
  }, [url, requestKey]);

  const current = result?.key === requestKey ? result : null;
  const hotels = current?.hotels ?? null;
  const error = current?.error ?? '';

  const visible = useMemo(
    () => (hotels ?? []).filter((h) => h.stars >= minStars),
    [hotels, minStars],
  );

  return (
    <div className="grid lg:grid-cols-[240px_1fr] gap-6 items-start">
      <aside className="panel p-5 space-y-5">
        <h2
          className="text-sm font-semibold"
          style={{ ...poppins, color: 'var(--ink)' }}
        >
          Filter
        </h2>
        <Field label="Minimum stars" htmlFor="stars">
          <select
            id="stars"
            value={minStars}
            onChange={(e) => setMinStars(Number(e.target.value))}
            className={`${inputBase} ${inputOk}`}
          >
            <option value={0}>Any</option>
            {[3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}+ stars
              </option>
            ))}
          </select>
        </Field>
        <Field label="Max price per night (USD)" htmlFor="max">
          <input
            id="max"
            type="number"
            min={1}
            inputMode="numeric"
            placeholder="No limit"
            value={maxPrice}
            onChange={(e) => {
              setMaxPrice(e.target.value.replace(/\D/g, ''));
              setPage(1);
            }}
            className={`${inputBase} ${inputOk}`}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={parking}
            onChange={(e) => {
              setParking(e.target.checked);
              setPage(1);
            }}
            className="w-4 h-4 accent-primary-500"
          />
          Parking available
        </label>
      </aside>

      <section aria-live="polite">
        {error ? (
          <ErrorPanel
            message={error}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        ) : hotels === null ? (
          <Spinner label="Finding available hotels…" />
        ) : visible.length === 0 ? (
          <div
            className="panel p-10 text-center"
            style={{ color: 'var(--muted)' }}
          >
            No hotels match this search. Try other dates or fewer filters.
          </div>
        ) : (
          <div className="space-y-4">
            {visible.map((hotel) => (
              <HotelCard
                key={hotel.code}
                hotel={hotel}
                onOpen={() => onOpen(hotel)}
              />
            ))}
          </div>
        )}

        {hotels !== null && (page > 1 || hotels.length > 0) && (
          <div className="flex justify-between mt-6">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-4 py-2 rounded-lg border text-sm font-medium bg-white disabled:opacity-40"
              style={{ borderColor: 'var(--border)' }}
            >
              Previous
            </button>
            <span
              className="text-sm self-center"
              style={{ color: 'var(--muted)' }}
            >
              Page {page}
            </span>
            <button
              type="button"
              disabled={hotels.length === 0}
              onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 rounded-lg border text-sm font-medium bg-white disabled:opacity-40"
              style={{ borderColor: 'var(--border)' }}
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function AmenityChips({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((a) => (
        <li
          key={a}
          className="text-xs px-2 py-0.5 rounded-full"
          style={{
            background: 'rgba(91,185,210,0.12)',
            color: 'var(--sky2)',
          }}
        >
          {a}
        </li>
      ))}
    </ul>
  );
}

function HotelCard({ hotel, onOpen }: { hotel: Hotel; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="cat-card w-full text-left border rounded-2xl overflow-hidden flex flex-col sm:flex-row"
    >
      <div className="sm:w-60 shrink-0 aspect-[16/10] sm:aspect-auto bg-gray-100">
        {hotel.image && (
          // Smartbookings serves covers at arbitrary sizes from its own host.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hotel.image}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover"
          />
        )}
      </div>
      <div className="flex-1 p-5 flex flex-col gap-2 min-w-0">
        <Stars count={hotel.stars} />
        <h3
          className="text-lg font-semibold leading-snug"
          style={{ ...poppins, color: 'var(--ink)' }}
        >
          {hotel.name}
        </h3>
        {hotel.address && (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {hotel.address}
          </p>
        )}
        {hotel.description && (
          <p className="text-sm line-clamp-2">{hotel.description}</p>
        )}
        {hotel.amenities.length > 0 && (
          <AmenityChips items={hotel.amenities.slice(0, 6)} />
        )}
      </div>
      <div
        className="p-5 sm:w-44 shrink-0 flex sm:flex-col justify-between sm:justify-center items-center sm:items-end gap-2 border-t sm:border-t-0 sm:border-l"
        style={{ borderColor: 'var(--border)' }}
      >
        {hotel.priceFrom !== null && (
          <p className="sm:text-right">
            <span className="block text-xs" style={{ color: 'var(--muted)' }}>
              from
            </span>
            <span
              className="text-xl font-bold tabular-nums"
              style={{ color: 'var(--red)' }}
            >
              {formatMoney(hotel.priceFrom, hotel.currency)}
            </span>
            <span className="block text-xs" style={{ color: 'var(--muted)' }}>
              per night
            </span>
          </p>
        )}
        <span className="text-sm font-semibold" style={{ color: 'var(--red)' }}>
          See rooms →
        </span>
      </div>
    </button>
  );
}

// ---- Hotel detail ----------------------------------------------------------

function HotelView({
  stay,
  code,
  roomId,
  onBack,
  onSelectRoom,
  onChangeRoom,
}: {
  stay: StayQuery;
  code: string;
  roomId: string | null;
  onBack: () => void;
  onSelectRoom: (room: Room) => void;
  onChangeRoom: () => void;
}) {
  const [result, setResult] = useState<{
    key: string;
    hotel?: HotelDetail;
    error?: string;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const url = `${API}/hotels/${encodeURIComponent(code)}?${stayParams(stay)}`;
  const requestKey = `${url}#${attempt}`;

  useEffect(() => {
    let cancelled = false;
    getJson<{ hotel: HotelDetail }>(url)
      .then((d) => !cancelled && setResult({ key: requestKey, hotel: d.hotel }))
      .catch(
        (e: Error) => !cancelled && setResult({ key: requestKey, error: e.message }),
      );
    return () => {
      cancelled = true;
    };
  }, [url, requestKey]);

  const current = result?.key === requestKey ? result : null;
  const hotel = current?.hotel ?? null;
  const error = current?.error ?? '';

  const room = hotel?.rooms.find((r) => r.id === roomId) ?? null;

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={room ? onChangeRoom : onBack}
        className="text-sm font-medium"
        style={{ color: 'var(--sky2)' }}
      >
        ← {room ? 'Back to rooms' : 'All hotels'}
      </button>

      {error ? (
        <ErrorPanel message={error} onRetry={() => setAttempt((n) => n + 1)} />
      ) : !hotel ? (
        <Spinner label="Loading hotel…" />
      ) : room ? (
        <BookingForm hotel={hotel} room={room} stay={stay} />
      ) : (
        <>
          <div className="panel overflow-hidden">
            {hotel.images.length > 0 && (
              <div className="flex gap-1 overflow-x-auto snap-x">
                {hotel.images.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={src}
                    src={src}
                    alt={i === 0 ? hotel.name : ''}
                    className="h-56 sm:h-72 w-auto max-w-[90%] object-cover snap-start shrink-0"
                  />
                ))}
              </div>
            )}
            <div className="p-6 space-y-3">
              <Stars count={hotel.stars} />
              <h2
                className="text-2xl font-bold"
                style={{ ...poppins, color: 'var(--ink)' }}
              >
                {hotel.name}
              </h2>
              {hotel.address && (
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  {hotel.address}
                </p>
              )}
              {hotel.description && (
                <p className="text-sm whitespace-pre-line">
                  {hotel.description}
                </p>
              )}
              {(hotel.checkInTime || hotel.checkOutTime) && (
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  {hotel.checkInTime && <>Check-in from {hotel.checkInTime}. </>}
                  {hotel.checkOutTime && (
                    <>Check-out by {hotel.checkOutTime}.</>
                  )}
                </p>
              )}
              {hotel.amenities.length > 0 && (
                <AmenityChips items={hotel.amenities} />
              )}
            </div>
          </div>

          <h3
            className="text-lg font-semibold pt-2"
            style={{ ...poppins, color: 'var(--ink)' }}
          >
            Rooms for {formatDate(stay.checkin)} – {formatDate(stay.checkout)}
          </h3>
          {hotel.rooms.length === 0 ? (
            <div
              className="panel p-8 text-center"
              style={{ color: 'var(--muted)' }}
            >
              No rooms are available for these dates. Try different dates.
            </div>
          ) : (
            <div className="space-y-3">
              {hotel.rooms.map((r) => (
                <RoomRow key={r.id} room={r} onSelect={() => onSelectRoom(r)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RoomRow({ room, onSelect }: { room: Room; onSelect: () => void }) {
  const soldOut = room.roomsLeft === 0;
  return (
    <div className="panel p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold" style={{ ...poppins, color: 'var(--ink)' }}>
          {room.name || 'Room'}
        </h4>
        {room.capacity && (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {room.capacity} per room
          </p>
        )}
        {room.amenities.length > 0 && (
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
            {room.amenities.slice(0, 8).join(' · ')}
            {room.amenities.length > 8 && ' …'}
          </p>
        )}
      </div>
      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
        <div className="sm:text-right">
          <p
            className="text-lg font-bold tabular-nums"
            style={{ color: 'var(--red)' }}
          >
            {formatMoney(room.price, room.currency)}
            <span
              className="text-xs font-normal"
              style={{ color: 'var(--muted)' }}
            >
              {' '}
              / night
            </span>
          </p>
          {room.roomsLeft !== null &&
            room.roomsLeft > 0 &&
            room.roomsLeft <= 10 && (
              <p className="text-xs text-amber-700">{room.roomsLeft} left</p>
            )}
        </div>
        <button
          type="button"
          onClick={onSelect}
          disabled={soldOut}
          className="btn-primary px-5 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-40"
        >
          {soldOut ? 'Sold out' : 'Book'}
        </button>
      </div>
    </div>
  );
}

// ---- Booking ---------------------------------------------------------------

type BookingFields = Pick<
  BookingRequest,
  | 'title'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'country'
  | 'bookingFor'
  | 'beneficiaryName'
  | 'beneficiaryEmail'
  | 'reason'
  | 'question'
  | 'paymentMethod'
>;

interface BookingResult {
  reference: string;
  paymentKey: string;
  message: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateBooking(f: BookingFields): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!f.title) errors.title = 'Select a title';
  if (!f.firstName.trim()) errors.firstName = 'Enter your first name';
  if (!f.lastName.trim()) errors.lastName = 'Enter your last name';
  if (!EMAIL.test(f.email.trim())) errors.email = 'Enter a valid email address';
  if (f.phone.replace(/\D/g, '').length < 7) {
    errors.phone = 'Enter a phone number including the country code';
  }
  if (!f.country) errors.country = 'Select your country';
  if (!f.paymentMethod) errors.paymentMethod = 'Choose how you will pay';
  if (f.bookingFor === 'someone') {
    if (!f.beneficiaryName.trim()) {
      errors.beneficiaryName = "Enter the guest's name";
    }
    if (!EMAIL.test(f.beneficiaryEmail.trim())) {
      errors.beneficiaryEmail = "Enter the guest's email address";
    }
  }
  return errors;
}

function isOnsite(method: string): boolean {
  return /onsite|on site|at the hotel/i.test(method);
}

function BookingForm({
  hotel,
  room,
  stay,
}: {
  hotel: HotelDetail;
  room: Room;
  stay: StayQuery;
}) {
  const countries = useMemo(
    () => countryNames().map((c) => ({ value: c, label: c })),
    [],
  );
  const paymentMethods = hotel.paymentMethods.length
    ? hotel.paymentMethods
    : DEFAULT_PAYMENT_METHODS;

  const [fields, setFields] = useState<BookingFields>({
    title: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    country: '',
    bookingFor: 'myself',
    beneficiaryName: '',
    beneficiaryEmail: '',
    reason: 'Business',
    question: '',
    paymentMethod: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BookingResult | null>(null);

  const nights = nightsBetween(stay.checkin, stay.checkout);
  const total = room.price !== null ? room.price * nights * stay.rooms : null;

  function set<K extends keyof BookingFields>(key: K, value: BookingFields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const found = validateBooking(fields);
    setErrors(found);
    const firstInvalid = Object.keys(found)[0];
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      const body: BookingRequest = {
        ...fields,
        hotelCode: hotel.code,
        roomId: room.id,
        roomToken: room.token,
        checkin: stay.checkin,
        checkout: stay.checkout,
        rooms: stay.rooms,
        adults: stay.adults,
        children: stay.children,
      };
      const data = await getJson<BookingResult>(`${API}/booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setResult(data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const guests = `${stay.adults} adult${stay.adults === 1 ? '' : 's'}${
    stay.children
      ? `, ${stay.children} child${stay.children === 1 ? '' : 'ren'}`
      : ''
  }`;

  const summary = (
    <aside className="panel p-5 space-y-3 lg:sticky lg:top-6">
      <h3 className="font-semibold" style={{ ...poppins, color: 'var(--ink)' }}>
        Your stay
      </h3>
      <div className="text-sm space-y-1">
        <p className="font-medium" style={{ color: 'var(--ink)' }}>
          {hotel.name}
        </p>
        <p style={{ color: 'var(--muted)' }}>{room.name}</p>
      </div>
      <dl className="text-sm space-y-1.5">
        {[
          ['Check-in', formatDate(stay.checkin)],
          ['Check-out', formatDate(stay.checkout)],
          ['Nights', String(nights)],
          ['Rooms', String(stay.rooms)],
          ['Guests', guests],
          ['Rate', `${formatMoney(room.price, room.currency)} / night`],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt style={{ color: 'var(--muted)' }}>{k}</dt>
            <dd className="text-right">{v}</dd>
          </div>
        ))}
      </dl>
      {total !== null && (
        <div
          className="flex justify-between items-baseline pt-3 border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          <span
            className="text-sm font-semibold"
            style={{ color: 'var(--ink)' }}
          >
            Estimated total
          </span>
          <span
            className="text-lg font-bold tabular-nums"
            style={{ color: 'var(--red)' }}
          >
            {formatMoney(total, room.currency)}
          </span>
        </div>
      )}
    </aside>
  );

  if (result) {
    const payOnline = !isOnsite(fields.paymentMethod) && !!result.paymentKey;
    return (
      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="panel p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2
            className="text-2xl font-bold mb-3"
            style={{ ...poppins, color: 'var(--ink)' }}
          >
            {payOnline
              ? 'Booking received — complete payment'
              : 'Booking received'}
          </h2>
          <p className="mb-6" style={{ color: 'var(--muted)' }}>
            {result.message || `A confirmation will be sent to ${fields.email}.`}
          </p>
          {result.reference && (
            <div
              className="mb-6 p-4 rounded-lg border inline-block"
              style={{
                background: 'rgba(91,185,210,0.1)',
                borderColor: 'rgba(91,185,210,0.4)',
              }}
            >
              <p
                className="text-xs uppercase tracking-wide font-semibold"
                style={{ color: 'var(--sky2)' }}
              >
                Booking reference
              </p>
              <p
                className="text-2xl font-bold font-mono mt-1"
                style={{ color: 'var(--ink)' }}
              >
                {result.reference}
              </p>
            </div>
          )}
          {payOnline ? (
            <div>
              <a
                href={`${API}/pay?key=${encodeURIComponent(result.paymentKey)}`}
                className="btn-primary inline-block px-8 py-3 rounded-lg text-white text-sm font-semibold"
              >
                Pay {total !== null ? formatMoney(total, room.currency) : 'now'}
              </a>
              <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
                You&apos;ll be taken to Smartbookings&apos; secure payment page.
              </p>
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Payment is settled at the hotel on arrival.
            </p>
          )}
          <p className="text-xs mt-6" style={{ color: 'var(--muted)' }}>
            Questions about your booking? Email{' '}
            <a href="mailto:reservation@eventsfactory.rw" className="underline">
              reservation@eventsfactory.rw
            </a>
          </p>
        </div>
        {summary}
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="grid lg:grid-cols-[1fr_320px] gap-6 items-start"
    >
      <div className="panel p-6 space-y-6">
        <h2
          className="text-xl font-bold"
          style={{ ...poppins, color: 'var(--ink)' }}
        >
          Guest details
        </h2>

        <fieldset>
          <legend
            className="text-sm font-medium mb-2"
            style={{ color: 'var(--ink)' }}
          >
            Who is this booking for?
          </legend>
          <div className="flex gap-2">
            {(
              [
                ['myself', 'Myself'],
                ['someone', 'Someone else'],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className="flex-1 flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm cursor-pointer"
                style={{
                  borderColor:
                    fields.bookingFor === value ? 'var(--red)' : 'var(--border)',
                  background:
                    fields.bookingFor === value
                      ? 'rgba(198,27,17,0.04)'
                      : 'var(--white)',
                }}
              >
                <input
                  type="radio"
                  name="bookingFor"
                  value={value}
                  checked={fields.bookingFor === value}
                  onChange={() => set('bookingFor', value)}
                  className="accent-primary-500"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid sm:grid-cols-[120px_1fr_1fr] gap-4">
          <Field label="Title" htmlFor="title" error={errors.title} required>
            <select
              id="title"
              value={fields.title}
              onChange={(e) => set('title', e.target.value)}
              className={`${inputBase} ${errors.title ? inputErr : inputOk}`}
            >
              <option value="">—</option>
              {TITLES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0) + t.slice(1).toLowerCase()}.
                </option>
              ))}
            </select>
          </Field>
          <TextField
            id="firstName"
            label="First name"
            value={fields.firstName}
            error={errors.firstName}
            onChange={(v) => set('firstName', v)}
            autoComplete="given-name"
          />
          <TextField
            id="lastName"
            label="Last name"
            value={fields.lastName}
            error={errors.lastName}
            onChange={(v) => set('lastName', v)}
            autoComplete="family-name"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <TextField
            id="email"
            label="Email"
            type="email"
            value={fields.email}
            error={errors.email}
            onChange={(v) => set('email', v)}
            autoComplete="email"
          />
          <TextField
            id="phone"
            label="Phone"
            type="tel"
            value={fields.phone}
            error={errors.phone}
            onChange={(v) => set('phone', v)}
            autoComplete="tel"
            placeholder="+250 7XX XXX XXX"
          />
        </div>

        <Field label="Country" htmlFor="country" error={errors.country} required>
          <SearchableSelect
            id="country"
            options={countries}
            value={fields.country}
            onChange={(v) => set('country', v)}
            placeholder="Select your country"
            hasError={!!errors.country}
          />
        </Field>

        {fields.bookingFor === 'someone' && (
          <div
            className="grid sm:grid-cols-2 gap-4 p-4 rounded-xl"
            style={{ background: 'var(--light)' }}
          >
            <TextField
              id="beneficiaryName"
              label="Guest's full name"
              value={fields.beneficiaryName}
              error={errors.beneficiaryName}
              onChange={(v) => set('beneficiaryName', v)}
            />
            <TextField
              id="beneficiaryEmail"
              label="Guest's email"
              type="email"
              value={fields.beneficiaryEmail}
              error={errors.beneficiaryEmail}
              onChange={(v) => set('beneficiaryEmail', v)}
            />
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Reason for travel" htmlFor="reason">
            <select
              id="reason"
              value={fields.reason}
              onChange={(e) => set('reason', e.target.value)}
              className={`${inputBase} ${inputOk}`}
            >
              {REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field
            label="Payment method"
            htmlFor="paymentMethod"
            error={errors.paymentMethod}
            required
          >
            <select
              id="paymentMethod"
              value={fields.paymentMethod}
              onChange={(e) => set('paymentMethod', e.target.value)}
              className={`${inputBase} ${
                errors.paymentMethod ? inputErr : inputOk
              }`}
            >
              <option value="">Select</option>
              {paymentMethods.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          label="Special requests or questions (optional)"
          htmlFor="question"
        >
          <textarea
            id="question"
            rows={3}
            value={fields.question}
            onChange={(e) => set('question', e.target.value)}
            className={`${inputBase} ${inputOk}`}
          />
        </Field>

        {submitError && (
          <p
            className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"
            role="alert"
          >
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full sm:w-auto px-8 py-3 rounded-lg text-white text-sm font-semibold disabled:opacity-60"
        >
          {submitting ? 'Booking…' : 'Confirm booking'}
        </button>
      </div>
      {summary}
    </form>
  );
}

// ---- Small pieces ----------------------------------------------------------

function Field({
  label,
  htmlFor,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-xs font-medium mb-1"
        style={{ color: 'var(--ink)' }}
      >
        {label}
        {required && <span className="text-red-600"> *</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  error,
  type = 'text',
  autoComplete,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <Field label={label} htmlFor={id} error={error} required>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={!!error}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputBase} ${error ? inputErr : inputOk}`}
      />
    </Field>
  );
}

function NumberField({
  id,
  label,
  min,
  value,
  onChange,
}: {
  id: string;
  label: string;
  min: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label} htmlFor={id}>
      <input
        id={id}
        type="number"
        min={min}
        max={20}
        value={value}
        onChange={(e) =>
          onChange(Math.max(min, parseInt(e.target.value, 10) || min))
        }
        className={`${inputBase} ${inputOk}`}
      />
    </Field>
  );
}

function Stars({ count }: { count: number }) {
  const n = Math.round(count);
  if (!n) return null;
  return (
    <p
      className="text-sm leading-none"
      style={{ color: '#E0A100' }}
      aria-label={`${n} star hotel`}
    >
      {'★'.repeat(n)}
      <span style={{ color: 'var(--border)' }}>{'★'.repeat(5 - n)}</span>
    </p>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="panel p-10 text-center">
      <div
        className="animate-spin w-10 h-10 border-4 rounded-full mx-auto mb-4"
        style={{ borderColor: 'var(--red)', borderTopColor: 'transparent' }}
      />
      <p style={{ color: 'var(--muted)' }}>{label}</p>
    </div>
  );
}

function ErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="panel p-10 text-center">
      <p className="text-red-600 mb-4">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="btn-primary px-6 py-2.5 rounded-lg text-white text-sm font-semibold"
      >
        Try again
      </button>
      <p className="text-xs mt-4" style={{ color: 'var(--muted)' }}>
        If this keeps happening, email{' '}
        <a href="mailto:reservation@eventsfactory.rw" className="underline">
          reservation@eventsfactory.rw
        </a>
      </p>
    </div>
  );
}
