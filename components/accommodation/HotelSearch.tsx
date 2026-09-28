'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AmenityFilter,
  Hotel,
  HotelListResult,
  StayQuery,
  formatPrice,
  parseStayQuery,
} from '@/lib/accommodation';
import DateRangePicker from './DateRangePicker';
import {
  API,
  ErrorPanel,
  Icon,
  IconName,
  Spinner,
  Stars,
  SupportCard,
  amenityIcon,
  getJson,
  pillButton,
  stayParams,
} from './ui';

// ---- Search bar ------------------------------------------------------------

function Counter({
  id,
  label,
  icon,
  min,
  value,
  onChange,
}: {
  id: string;
  label: string;
  icon: IconName;
  min: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label htmlFor={id} className="block px-4 py-3 cursor-text">
      <span
        className="block text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--muted)' }}
      >
        {label}
      </span>
      <span className="flex items-center gap-2 mt-0.5">
        <span style={{ color: 'var(--red)' }}>
          <Icon name={icon} className="w-[18px] h-[18px]" />
        </span>
        <input
          id={id}
          type="number"
          min={min}
          max={20}
          value={value}
          onChange={(e) =>
            onChange(Math.max(min, parseInt(e.target.value, 10) || min))
          }
          className="w-12 text-[15px] font-medium bg-transparent focus:outline-none"
          style={{ color: 'var(--ink)' }}
        />
      </span>
    </label>
  );
}

export function SearchBar({
  initial,
  place,
  onSearch,
}: {
  initial: StayQuery;
  place: string;
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

  const divider = { borderColor: 'var(--border)' };

  return (
    <form onSubmit={submit} id="hotel-search">
      <div
        className="bg-white border rounded-2xl shadow-sm grid grid-cols-3 lg:grid-cols-[1.3fr_1.4fr_repeat(3,0.6fr)_auto] items-stretch"
        style={divider}
      >
        <div
          className="col-span-3 lg:col-span-1 px-4 py-3 border-b lg:border-b-0 lg:border-r"
          style={divider}
        >
          <span
            className="block text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--muted)' }}
          >
            Place
          </span>
          <span
            className="flex items-center gap-2 mt-0.5 text-[15px] font-medium"
            style={{ color: 'var(--ink)' }}
          >
            <span style={{ color: 'var(--red)' }}>
              <Icon name="pin" className="w-[18px] h-[18px]" />
            </span>
            {place}
          </span>
        </div>
        <div
          className="col-span-3 lg:col-span-1 border-b lg:border-b-0 lg:border-r"
          style={divider}
        >
          <DateRangePicker
            checkin={form.checkin}
            checkout={form.checkout}
            onChange={(checkin, checkout) =>
              setForm({ ...form, checkin, checkout })
            }
          />
        </div>
        <div className="border-r" style={divider}>
          <Counter
            id="rooms"
            label="Room"
            icon="bed"
            min={1}
            value={form.rooms}
            onChange={(rooms) => setForm({ ...form, rooms })}
          />
        </div>
        <div className="border-r" style={divider}>
          <Counter
            id="adults"
            label="Adult"
            icon="user"
            min={1}
            value={form.adults}
            onChange={(adults) => setForm({ ...form, adults })}
          />
        </div>
        <div className="lg:border-r" style={divider}>
          <Counter
            id="children"
            label="Child"
            icon="baby"
            min={0}
            value={form.children}
            onChange={(children) => setForm({ ...form, children })}
          />
        </div>
        <div className="col-span-3 lg:col-span-1 p-3 flex items-center">
          <button type="submit" className={`${pillButton} w-full px-6 h-12 text-[15px]`}>
            <Icon name="search" className="w-[18px] h-[18px]" strokeWidth={2.25} />
            Check availability
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </form>
  );
}

// ---- Hotel list ------------------------------------------------------------

function StaySummary({ stay, place }: { stay: StayQuery; place: string }) {
  const us = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${m}/${d}/${y}`;
  };
  const rows: [string, number][] = [
    ['Number of Room', stay.rooms],
    ['Adults', stay.adults],
    ['Children', stay.children],
  ];
  return (
    <div className="panel p-4 text-sm" style={{ borderRadius: 12 }}>
      <p className="font-semibold" style={{ color: 'var(--ink)' }}>
        Location
      </p>
      <p style={{ color: 'var(--muted)' }}>{place}</p>
      <p className="mt-3" style={{ color: 'var(--muted)' }}>
        Check in - Check out
      </p>
      <p className="font-medium" style={{ color: 'var(--ink)' }}>
        {us(stay.checkin)} - {us(stay.checkout)}
      </p>
      <dl className="mt-2 pt-2 border-t space-y-1.5" style={{ borderColor: 'var(--border)' }}>
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <dt style={{ color: 'var(--text)' }}>{k}</dt>
            <dd style={{ color: 'var(--ink)' }}>{v}</dd>
          </div>
        ))}
      </dl>
      <button
        type="button"
        onClick={() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          document.querySelector<HTMLButtonElement>('#hotel-search button[aria-haspopup]')?.focus();
        }}
        className="mt-4 w-full h-10 rounded-full border font-semibold transition-colors hover:bg-red-50"
        style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
      >
        Check Availability
      </button>
    </div>
  );
}

function AmenityTiles({
  amenities,
  selected,
  onToggle,
}: {
  amenities: AmenityFilter[];
  selected: string[];
  onToggle: (key: string) => void;
}) {
  if (!amenities.length) return null;
  return (
    <div className="panel p-4" style={{ borderRadius: 12 }}>
      <p className="font-semibold text-sm mb-3" style={{ color: 'var(--ink)' }}>
        Filter By
      </p>
      <div className="grid grid-cols-3 gap-2">
        {amenities.map((a) => {
          const on = selected.includes(a.key);
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => onToggle(a.key)}
              aria-pressed={on}
              className="min-h-[76px] flex flex-col items-center justify-center gap-1.5 p-2 rounded-lg border text-center text-xs leading-tight transition-colors"
              style={{
                borderColor: on ? 'var(--red)' : 'var(--border)',
                background: on ? 'rgba(198,27,17,0.06)' : 'var(--white)',
                color: on ? 'var(--red)' : 'var(--text)',
              }}
            >
              <Icon name={amenityIcon(a.key)} className="w-5 h-5" />
              {a.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PriceFilter({
  min,
  max,
  onApply,
}: {
  min: string;
  max: string;
  onApply: (min: string, max: string) => void;
}) {
  const [draft, setDraft] = useState({ min, max });
  const ref = useRef<HTMLDetailsElement>(null);
  const active = !!(min || max);

  function apply(next: { min: string; max: string }) {
    onApply(next.min, next.max);
    if (ref.current) ref.current.open = false;
  }

  return (
    <details ref={ref} className="relative">
      <summary
        className="list-none cursor-pointer inline-flex items-center gap-2 h-10 px-4 rounded-lg border bg-white text-sm [&::-webkit-details-marker]:hidden"
        style={{
          borderColor: active ? 'var(--red)' : 'var(--border)',
          color: active ? 'var(--red)' : 'var(--text)',
        }}
      >
        {active ? `$${min || 0} – ${max ? `$${max}` : 'any'}` : 'Price'}
        <Icon name="chevronDown" />
      </summary>
      <div
        className="absolute z-20 mt-2 w-64 bg-white border rounded-xl shadow-lg p-4 space-y-3"
        style={{ borderColor: 'var(--border)' }}
      >
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          Price per night (USD)
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(['min', 'max'] as const).map((k) => (
            <input
              key={k}
              type="number"
              min={0}
              inputMode="numeric"
              placeholder={k === 'min' ? 'Min' : 'Max'}
              aria-label={k === 'min' ? 'Minimum price' : 'Maximum price'}
              value={draft[k]}
              onChange={(e) =>
                setDraft({ ...draft, [k]: e.target.value.replace(/\D/g, '') })
              }
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30"
              style={{ borderColor: 'var(--border)' }}
            />
          ))}
        </div>
        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => {
              setDraft({ min: '', max: '' });
              apply({ min: '', max: '' });
            }}
            className="text-sm"
            style={{ color: 'var(--muted)' }}
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => apply(draft)}
            className="btn-primary px-4 py-1.5 rounded-lg text-white text-sm font-semibold"
          >
            Apply
          </button>
        </div>
      </div>
    </details>
  );
}

function StarFilter({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="relative inline-flex">
      <span className="sr-only">Star category</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="appearance-none h-10 pl-4 pr-9 rounded-lg border bg-white text-sm cursor-pointer focus:outline-none"
        style={{
          borderColor: value ? 'var(--red)' : 'var(--border)',
          color: value ? 'var(--red)' : 'var(--text)',
        }}
      >
        <option value={0}>Star Category</option>
        {[5, 4, 3, 2, 1].map((n) => (
          <option key={n} value={n}>
            {n} star{n === 1 ? '' : 's'}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-3 top-3" style={{ color: 'var(--muted)' }}>
        <Icon name="chevronDown" />
      </span>
    </label>
  );
}

// 1, 2, …, 13 style page list around the current page.
function pageItems(page: number, last: number): (number | '…')[] {
  const pages = new Set([1, last, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);
  const items: (number | '…')[] = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) items.push('…');
    items.push(p);
  });
  return items;
}

function Pagination({
  page,
  last,
  onChange,
}: {
  page: number;
  last: number;
  onChange: (page: number) => void;
}) {
  if (last <= 1) return null;
  const box =
    'h-10 min-w-10 px-3 rounded-lg border bg-white text-sm disabled:opacity-40';
  return (
    <nav className="flex items-center justify-center gap-2 mt-8" aria-label="Pages">
      <button
        type="button"
        className={box}
        style={{ borderColor: 'var(--border)' }}
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
      >
        ‹ Previous
      </button>
      {pageItems(page, last).map((item, i) =>
        item === '…' ? (
          <span key={`gap-${i}`} className="px-1" style={{ color: 'var(--muted)' }}>
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            className={box}
            aria-current={item === page ? 'page' : undefined}
            onClick={() => onChange(item)}
            style={
              item === page
                ? { background: 'var(--red)', borderColor: 'var(--red)', color: 'white' }
                : { borderColor: 'var(--border)' }
            }
          >
            {item}
          </button>
        ),
      )}
      <button
        type="button"
        className={box}
        style={{ borderColor: 'var(--border)' }}
        disabled={page >= last}
        onClick={() => onChange(page + 1)}
      >
        Next ›
      </button>
    </nav>
  );
}

function HotelCard({ hotel, onOpen }: { hotel: Hotel; onOpen: () => void }) {
  return (
    <article
      className="bg-white border rounded-2xl overflow-hidden flex flex-col sm:flex-row transition-shadow hover:shadow-md"
      style={{ borderColor: 'var(--border)' }}
    >
      <button
        type="button"
        onClick={onOpen}
        className="sm:w-52 shrink-0 aspect-[16/10] sm:aspect-auto bg-gray-100"
        aria-label={`View ${hotel.name}`}
      >
        {hotel.image && (
          // Smartbookings serves covers at arbitrary sizes from its own host.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hotel.image} alt="" loading="lazy" className="w-full h-full object-cover" />
        )}
      </button>
      <div className="flex-1 min-w-0 p-5">
        {hotel.category && (
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            {hotel.category}
          </p>
        )}
        <h3 className="text-lg font-semibold leading-snug" style={{ color: 'var(--ink)' }}>
          <button type="button" onClick={onOpen} className="text-left hover:underline">
            {hotel.name}
          </button>
        </h3>
        <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: 'var(--muted)' }}>
          <Stars count={hotel.stars} className="text-base" />
          {hotel.city && (
            <span className="inline-flex items-center gap-1">
              <Icon name="pin" className="w-3.5 h-3.5" />
              {hotel.city}
            </span>
          )}
        </div>
        {hotel.description && (
          <p className="text-sm mt-2 line-clamp-2" style={{ color: 'var(--text)' }}>
            {hotel.description}
          </p>
        )}
      </div>
      <div
        className="sm:w-44 shrink-0 p-5 flex sm:flex-col items-center sm:items-end justify-between gap-3 border-t sm:border-t-0 sm:border-l"
        style={{ borderColor: 'var(--border)' }}
      >
        {hotel.priceFrom !== null && (
          <p className="sm:text-right leading-tight">
            <span className="block text-xs" style={{ color: 'var(--muted)' }}>
              from
            </span>
            <span className="block text-2xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
              {formatPrice(hotel.priceFrom, hotel.currency)}
            </span>
            <span className="block text-xs mt-1" style={{ color: 'var(--muted)' }}>
              / night
            </span>
          </p>
        )}
        <button type="button" onClick={onOpen} className={`${pillButton} h-10 px-5 text-sm`}>
          Show Prices
        </button>
      </div>
    </article>
  );
}

export function HotelList({
  stay,
  place,
  amenities,
  onOpen,
}: {
  stay: StayQuery;
  place: string;
  amenities: AmenityFilter[];
  onOpen: (hotel: Hotel) => void;
}) {
  const query = stayParams(stay).toString();
  const [page, setPage] = useState(1);
  const [pageQuery, setPageQuery] = useState(query);
  const [selected, setSelected] = useState<string[]>([]);
  const [star, setStar] = useState(0);
  const [price, setPrice] = useState({ min: '', max: '' });
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    data?: HotelListResult;
    error?: string;
  } | null>(null);

  // A new search starts again from the first page.
  if (pageQuery !== query) {
    setPageQuery(query);
    setPage(1);
  }

  const q = new URLSearchParams(query);
  q.set('page', String(page));
  if (selected.length) q.set('amenities', selected.join(','));
  if (star) q.set('star', String(star));
  if (price.min) q.set('min', price.min);
  if (price.max) q.set('max', price.max);
  const url = `${API}/hotels?${q}`;
  const requestKey = `${url}#${attempt}`;

  // Each result carries the request it answers, so a stale one reads as
  // loading rather than showing the previous search.
  useEffect(() => {
    let cancelled = false;
    getJson<HotelListResult>(url)
      .then((data) => !cancelled && setResult({ key: requestKey, data }))
      .catch((e: Error) => !cancelled && setResult({ key: requestKey, error: e.message }));
    return () => {
      cancelled = true;
    };
  }, [url, requestKey]);

  const current = result?.key === requestKey ? result : null;
  const data = current?.data ?? null;

  function changePage(next: number) {
    setPage(next);
    document.getElementById('hotel-results')?.scrollIntoView({ behavior: 'smooth' });
  }

  const first = data ? (data.page - 1) * data.perPage + 1 : 0;
  const lastShown = data ? first + data.hotels.length - 1 : 0;

  return (
    <div className="grid lg:grid-cols-[300px_1fr] gap-6 items-start">
      <aside className="space-y-4">
        <StaySummary stay={stay} place={place} />
        <AmenityTiles
          amenities={amenities}
          selected={selected}
          onToggle={(key) => {
            setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));
            setPage(1);
          }}
        />
        <SupportCard />
      </aside>

      <section id="hotel-results" aria-live="polite" className="min-w-0 scroll-mt-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <PriceFilter
            min={price.min}
            max={price.max}
            onApply={(min, max) => {
              setPrice({ min, max });
              setPage(1);
            }}
          />
          <StarFilter
            value={star}
            onChange={(s) => {
              setStar(s);
              setPage(1);
            }}
          />
          {data && (
            <p className="ml-auto text-sm" style={{ color: 'var(--muted)' }}>
              {data.total} {data.total === 1 ? 'property' : 'properties'} found
              {data.hotels.length > 0 && ` · showing ${first}–${lastShown}`}
            </p>
          )}
        </div>

        {current?.error ? (
          <ErrorPanel message={current.error} onRetry={() => setAttempt((n) => n + 1)} />
        ) : !data ? (
          <Spinner label="Finding available hotels…" />
        ) : data.hotels.length === 0 ? (
          <div className="panel p-10 text-center" style={{ color: 'var(--muted)' }}>
            No hotels match this search. Try other dates or fewer filters.
          </div>
        ) : (
          <div className="space-y-4">
            {data.hotels.map((hotel) => (
              <HotelCard key={hotel.code} hotel={hotel} onOpen={() => onOpen(hotel)} />
            ))}
          </div>
        )}

        {data && <Pagination page={page} last={data.lastPage} onChange={changePage} />}
      </section>
    </div>
  );
}

