'use client';

import { useEffect, useRef, useState } from 'react';
import {
  HotelDetail,
  Room,
  StayQuery,
  formatPrice,
  nightsBetween,
  parseStayQuery,
} from '@/lib/accommodation';
import {
  CheckCircle,
  Icon,
  IconName,
  SupportCard,
  amenityIcon,
  formatDate,
  inputBase,
  inputOk,
  isoFromNow,
  pillButton,
  plural,
  poppins,
  stayParams,
} from './ui';

// Everything on this page comes from Client-HotelDetail; a section or row with
// no data is left out rather than shown empty.

// Facilities with a detail worth its own line ("Internet: wireless in entire
// property (Free)") go under Property details/information, not the grid.
const DETAIL_FACILITIES: Record<string, string> = {
  languages: 'Languages',
  internet: 'Internet',
  parking: 'Parking',
};

function key(label: string): string {
  return label.trim().toLowerCase();
}

function propertyDetails(hotel: HotelDetail): { label: string; detail: string }[] {
  return hotel.facilities
    .filter((f) => f.detail && DETAIL_FACILITIES[key(f.label)])
    .map((f) => ({ label: DETAIL_FACILITIES[key(f.label)], detail: f.detail }));
}

function facilityGrid(hotel: HotelDetail): string[] {
  return hotel.facilities
    .filter((f) => key(f.label) !== 'languages')
    .map((f) =>
      f.detail && !DETAIL_FACILITIES[key(f.label)] ? `${f.label} (${f.detail})` : f.label,
    );
}

function houseRules(hotel: HotelDetail): [string, string][] {
  const { checkIn, checkOut, children, pets } = hotel.houseRules;
  return (
    [
      ['Check-in', checkIn],
      ['Check-out', checkOut],
      ['Children', children],
      ['Pets', pets],
    ] as [string, string][]
  ).filter(([, v]) => v);
}

const TABS: { id: string; label: string; icon: IconName }[] = [
  { id: 'overview', label: 'Overview', icon: 'grid' },
  { id: 'rooms', label: 'Rooms', icon: 'bed' },
  { id: 'facilities', label: 'Facilities', icon: 'sparkles' },
  { id: 'gallery', label: 'Gallery', icon: 'image' },
  { id: 'house-rules', label: 'House rules', icon: 'rules' },
];

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-2xl font-bold" style={{ ...poppins, color: 'var(--ink)' }}>
        {title}
      </h2>
      {subtitle && (
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ---- Top: breadcrumb and hero ---------------------------------------------

function Breadcrumb({ hotel, onHome }: { hotel: HotelDetail; onHome: () => void }) {
  const [copied, setCopied] = useState(false);
  const city = hotel.city.split(',')[0].trim();
  const crumbs = [hotel.country, city].filter(Boolean);

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: hotel.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Dismissed share sheet or blocked clipboard: nothing to do.
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 min-w-0 flex-wrap">
        <button type="button" onClick={onHome} className="hover:underline" style={{ color: 'var(--muted)' }}>
          Hotels
        </button>
        {crumbs.map((c) => (
          <span key={c} className="flex items-center gap-2" style={{ color: 'var(--muted)' }}>
            <Icon name="chevronRight" className="w-3.5 h-3.5" />
            {c}
          </span>
        ))}
        <span className="flex items-center gap-2 font-medium min-w-0" style={{ color: 'var(--ink)' }}>
          <Icon name="chevronRight" className="w-3.5 h-3.5" />
          <span className="truncate">{hotel.name}</span>
        </span>
      </nav>
      <button
        type="button"
        onClick={share}
        className="flex items-center gap-1.5 shrink-0"
        style={{ color: 'var(--text)' }}
      >
        <Icon name="share" />
        {copied ? 'Link copied' : 'Share'}
      </button>
    </div>
  );
}

function Hero({
  hotel,
  onCheckAvailability,
}: {
  hotel: HotelDetail;
  onCheckAvailability: () => void;
}) {
  const [index, setIndex] = useState(0);
  const strip = useRef<HTMLDivElement>(null);
  const images = hotel.images;
  const current = images[index] ?? hotel.image;
  const highlights = hotel.facilities
    .filter((f) => key(f.label) !== 'languages')
    .slice(0, 6);

  function go(delta: number) {
    if (!images.length) return;
    const next = (index + delta + images.length) % images.length;
    setIndex(next);
    strip.current
      ?.querySelectorAll('button')
      [next]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  return (
    <section
      className="relative overflow-hidden rounded-3xl min-h-[440px] sm:min-h-[520px] flex items-end bg-gray-800"
      aria-label={`${hotel.name} photos`}
    >
      {current && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={current} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to top, rgba(10,12,15,0.88) 0%, rgba(10,12,15,0.45) 45%, rgba(10,12,15,0.05) 75%)',
        }}
      />

      <div className="relative w-full p-5 sm:p-7 flex flex-col lg:flex-row lg:items-end gap-6">
        <div className="flex-1 min-w-0 text-white">
          {hotel.stars > 0 && (
            <span
              className="inline-block text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-md mb-3"
              style={{ background: 'var(--red)' }}
            >
              {Math.round(hotel.stars)}-star {hotel.category || ''}
            </span>
          )}
          <h1
            className="text-3xl sm:text-5xl font-extrabold uppercase leading-tight break-words"
            style={poppins}
          >
            {hotel.name}
          </h1>
          {hotel.city && (
            <p className="flex items-center gap-1.5 mt-2 text-white/85">
              <Icon name="pin" />
              {hotel.city}
            </p>
          )}
          {highlights.length > 0 && (
            <ul className="flex flex-wrap gap-x-5 gap-y-2 mt-4 text-sm text-white/90">
              {highlights.map((f) => (
                <li key={f.label} className="flex items-center gap-1.5">
                  <Icon name={amenityIcon(f.label)} />
                  {f.label}
                </li>
              ))}
            </ul>
          )}
          {images.length > 1 && (
            <div className="flex items-center gap-3 mt-5">
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous photo"
                className="w-10 h-10 shrink-0 rounded-full bg-white/90 text-gray-800 flex items-center justify-center hover:bg-white"
              >
                <Icon name="chevronLeft" />
              </button>
              <div ref={strip} className="flex gap-2 overflow-x-auto no-scrollbar min-w-0">
                {images.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={`Photo ${i + 1}`}
                    aria-current={i === index}
                    className="shrink-0 w-24 h-16 sm:w-32 sm:h-20 rounded-lg overflow-hidden border-2"
                    style={{ borderColor: i === index ? 'var(--red)' : 'transparent' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next photo"
                className="w-10 h-10 shrink-0 rounded-full bg-white/90 text-gray-800 flex items-center justify-center hover:bg-white"
              >
                <Icon name="chevronRight" />
              </button>
            </div>
          )}
        </div>

        {hotel.priceFrom !== null && (
          <div className="bg-white/95 backdrop-blur rounded-2xl p-5 lg:w-64 shrink-0 text-right shadow-lg">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              From
            </p>
            <p style={{ color: 'var(--ink)' }}>
              <span className="text-3xl font-bold tabular-nums">
                {formatPrice(hotel.priceFrom, hotel.currency)}
              </span>
              <span className="text-sm" style={{ color: 'var(--muted)' }}>
                {' '}
                / night
              </span>
            </p>
            <button
              type="button"
              onClick={onCheckAvailability}
              className={`${pillButton} w-full h-10 mt-3 text-sm`}
            >
              Check Availability
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function Tabs() {
  const [active, setActive] = useState('overview');
  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b no-scrollbar"
      style={{ borderColor: 'var(--border)' }}
      aria-label="Sections"
    >
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => {
            setActive(t.id);
            scrollToId(t.id);
          }}
          className="flex items-center gap-2 px-4 py-3.5 text-[15px] whitespace-nowrap border-b-2 -mb-px"
          style={{
            borderColor: active === t.id ? 'var(--red)' : 'transparent',
            color: active === t.id ? 'var(--red)' : 'var(--text)',
          }}
        >
          <Icon name={t.icon} className="w-[18px] h-[18px]" />
          {t.label}
        </button>
      ))}
    </nav>
  );
}

// ---- Main column -----------------------------------------------------------

// Long descriptions are clamped to a few lines with a toggle. The toggle only
// appears when the text actually overflows the clamp at the current width.
function ReadMore({ text, lines = 6 }: { text: string; lines?: number }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, expanded]);

  return (
    <div>
      <p
        ref={ref}
        className="text-[15px] leading-7 whitespace-pre-line"
        style={{
          color: 'var(--text)',
          ...(expanded
            ? {}
            : {
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: lines,
                overflow: 'hidden',
              }),
        }}
      >
        {text}
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="mt-2 text-sm font-semibold inline-flex items-center gap-1"
          style={{ color: 'var(--red)' }}
        >
          {expanded ? 'Read less' : 'Read more'}
          <span className={expanded ? 'rotate-180' : ''}>
            <Icon name="chevronDown" />
          </span>
        </button>
      )}
    </div>
  );
}

function Overview({ hotel }: { hotel: HotelDetail }) {
  const details = propertyDetails(hotel);
  if (!hotel.description && !details.length) return null;
  return (
    <section id="overview" className="scroll-mt-6 grid md:grid-cols-2 gap-8">
      {hotel.description && (
        <div>
          <SectionHeading title="About this property" />
          <ReadMore text={hotel.description} />
        </div>
      )}
      {details.length > 0 && (
        <div>
          <SectionHeading title="Property details" />
          <ul className="space-y-4">
            {details.map((d) => (
              <li key={d.label} className="flex gap-3">
                <span
                  className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(198,27,17,0.08)', color: 'var(--red)' }}
                >
                  <Icon name={amenityIcon(d.label)} className="w-5 h-5" />
                </span>
                <span>
                  <span className="block font-semibold" style={{ color: 'var(--ink)' }}>
                    {d.label}
                  </span>
                  <span className="block text-sm" style={{ color: 'var(--muted)' }}>
                    {d.detail}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function RoomCard({ room, onSelect }: { room: Room; onSelect: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const soldOut = room.roomsLeft === 0;
  const amenities = expanded ? room.amenities : room.amenities.slice(0, 6);
  const meta: [IconName, string][] = (
    [
      ['user', room.guests ? plural(room.guests, 'Guest', 'Guests') : ''],
      ['bed', room.bedrooms],
      ['ruler', room.size],
    ] as [IconName, string][]
  ).filter(([, v]) => v);

  return (
    <article
      className="bg-white border rounded-2xl flex flex-col md:flex-row"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="flex-1 min-w-0 p-5">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>
          {room.name || 'Room'}
        </h3>
        {meta.length > 0 && (
          <p className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            {meta.map(([icon, label]) => (
              <span key={label} className="inline-flex items-center gap-1.5">
                <Icon name={icon} />
                {label}
              </span>
            ))}
          </p>
        )}
        {amenities.length > 0 && (
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 mt-4 text-sm" style={{ color: 'var(--text)' }}>
            {amenities.map((a) => (
              <li key={a} className="flex gap-2">
                <CheckCircle />
                {a}
              </li>
            ))}
          </ul>
        )}
        {room.amenities.length > 6 && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="mt-3 text-sm font-medium"
            style={{ color: 'var(--red)' }}
          >
            {expanded ? 'Show less' : 'and more...'}
          </button>
        )}
      </div>
      <div
        className="md:w-52 shrink-0 p-5 flex md:flex-col items-center md:items-end justify-between md:justify-center gap-3 border-t md:border-t-0 md:border-l"
        style={{ borderColor: 'var(--border)' }}
      >
        <p className="md:text-right leading-tight">
          <span className="block text-2xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
            {formatPrice(room.price, room.currency)}
          </span>
          <span className="block text-sm" style={{ color: 'var(--muted)' }}>
            per night
          </span>
          {room.roomsLeft !== null && room.roomsLeft > 0 && room.roomsLeft <= 10 && (
            <span className="block text-xs mt-1 text-amber-700">
              {plural(room.roomsLeft, 'room', 'rooms')} left
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={onSelect}
          disabled={soldOut}
          className={`${pillButton} h-11 px-6 text-[15px]`}
        >
          {soldOut ? 'Sold out' : 'Select Room'}
        </button>
      </div>
    </article>
  );
}

function Rooms({
  hotel,
  stay,
  onSelectRoom,
}: {
  hotel: HotelDetail;
  stay: StayQuery;
  onSelectRoom: (room: Room) => void;
}) {
  return (
    <section id="rooms" className="scroll-mt-6">
      <SectionHeading
        title="Available Rooms"
        subtitle={`For ${formatDate(stay.checkin)} – ${formatDate(stay.checkout)} · ${plural(
          stay.adults,
          'adult',
          'adults',
        )}${stay.children ? `, ${plural(stay.children, 'child', 'children')}` : ''}`}
      />
      {hotel.rooms.length === 0 ? (
        <div className="panel p-8 text-center" style={{ color: 'var(--muted)' }}>
          No rooms are available for these dates. Try different dates.
        </div>
      ) : (
        <div className="space-y-4">
          {hotel.rooms.map((room) => (
            <RoomCard key={room.id} room={room} onSelect={() => onSelectRoom(room)} />
          ))}
        </div>
      )}
    </section>
  );
}

function Facilities({ hotel }: { hotel: HotelDetail }) {
  const items = facilityGrid(hotel);
  if (!items.length) return null;
  return (
    <section id="facilities" className="scroll-mt-6">
      <SectionHeading title="Facilities" />
      <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-3">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-[15px]" style={{ color: 'var(--text)' }}>
            <CheckCircle />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Gallery({ hotel }: { hotel: HotelDetail }) {
  if (hotel.images.length < 2) return null;
  return (
    <section id="gallery" className="scroll-mt-6">
      <SectionHeading title="Gallery" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {hotel.images.map((src) => (
          <a
            key={src}
            href={src}
            target="_blank"
            rel="noreferrer"
            className="block aspect-[4/3] rounded-xl overflow-hidden bg-gray-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" loading="lazy" className="w-full h-full object-cover hover:scale-105 transition-transform" />
          </a>
        ))}
      </div>
    </section>
  );
}

function HouseRules({ hotel }: { hotel: HotelDetail }) {
  const rules = houseRules(hotel);
  if (!rules.length) return null;
  return (
    <section id="house-rules" className="scroll-mt-6">
      <SectionHeading title="House rules" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {rules.map(([label, value]) => (
          <div key={label} className="panel p-4" style={{ borderRadius: 12 }}>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {label}
            </p>
            <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
              {value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---- Sidebar ---------------------------------------------------------------

function SidebarCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel p-5" style={{ borderRadius: 16 }}>
      <h3 className="text-lg font-semibold mb-3" style={{ ...poppins, color: 'var(--ink)' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function InfoRows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="space-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4">
          <dt className="shrink-0" style={{ color: 'var(--muted)' }}>
            {label}
          </dt>
          <dd className="text-right font-medium" style={{ color: 'var(--ink)' }}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// Card-brand badges for Visa and Mastercard; any other method Smartbookings
// lists is shown by its own name.
function PaymentBadge({ method }: { method: string }) {
  const base = 'inline-flex items-center h-8 px-3 border rounded-md text-xs leading-none';
  if (/visa/i.test(method)) {
    return (
      <span className={`${base} font-extrabold italic tracking-wide`} style={{ color: '#1A1F71', borderColor: 'var(--border)' }}>
        VISA
      </span>
    );
  }
  if (/master/i.test(method)) {
    return (
      <span className={`${base} font-bold`} style={{ color: '#EB5A1B', borderColor: 'var(--border)' }}>
        mastercard
      </span>
    );
  }
  return (
    <span className={`${base} font-semibold uppercase tracking-wide`} style={{ color: 'var(--text)', borderColor: 'var(--border)' }}>
      {method.replace(/Payement/i, 'Payment')}
    </span>
  );
}

function BookYourStay({
  hotel,
  stay,
  onChangeStay,
}: {
  hotel: HotelDetail;
  stay: StayQuery;
  onChangeStay: (stay: StayQuery) => void;
}) {
  const [form, setForm] = useState(stay);
  const [guestsOpen, setGuestsOpen] = useState(false);
  const [error, setError] = useState('');
  const nights = nightsBetween(form.checkin, form.checkout);
  const valid = nights > 0;
  const total =
    hotel.priceFrom !== null && valid ? hotel.priceFrom * nights * form.rooms : null;

  function submit() {
    const result = parseStayQuery(stayParams(form));
    if (typeof result === 'string') {
      setError(result);
      return;
    }
    setError('');
    onChangeStay(result);
    scrollToId('rooms');
  }

  const dateField = (id: 'checkin' | 'checkout', label: string) => (
    <div>
      <label htmlFor={`book-${id}`} className="block text-sm mb-1.5" style={{ color: 'var(--muted)' }}>
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--red)' }}>
          <Icon name="calendar" />
        </span>
        <input
          id={`book-${id}`}
          type="date"
          min={id === 'checkout' ? form.checkin : isoFromNow(0)}
          value={form[id]}
          onChange={(e) => setForm({ ...form, [id]: e.target.value })}
          className={`${inputBase} ${inputOk} h-12 pl-10 text-[15px]`}
        />
      </div>
    </div>
  );

  const stepButton = (
    label: string,
    k: 'adults' | 'children',
    delta: -1 | 1,
    disabled: boolean,
  ) => (
    <button
      type="button"
      aria-label={`${delta < 0 ? 'Fewer' : 'More'} ${label.toLowerCase()}`}
      disabled={disabled}
      onClick={() => setForm({ ...form, [k]: form[k] + delta })}
      className="w-8 h-8 rounded-full border disabled:opacity-40"
      style={{ borderColor: 'var(--border)' }}
    >
      {delta < 0 ? '−' : '+'}
    </button>
  );

  const counter = (label: string, k: 'adults' | 'children', min: number) => (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm">{label}</span>
      <span className="flex items-center gap-2">
        {stepButton(label, k, -1, form[k] <= min)}
        <span className="w-5 text-center tabular-nums">{form[k]}</span>
        {stepButton(label, k, 1, form[k] >= 20)}
      </span>
    </div>
  );

  return (
    <div id="book" className="panel overflow-hidden scroll-mt-6" style={{ borderRadius: 16 }}>
      <h3 className="px-5 py-4 text-xl font-semibold text-white" style={{ ...poppins, background: 'var(--red)' }}>
        Book your stay
      </h3>
      <div className="p-5 space-y-4">
        {dateField('checkin', 'Check-in')}
        {dateField('checkout', 'Check-out')}

        <div className="relative">
          <span className="block text-sm mb-1.5" style={{ color: 'var(--muted)' }}>
            Guests
          </span>
          <button
            type="button"
            onClick={() => setGuestsOpen((o) => !o)}
            aria-expanded={guestsOpen}
            className={`${inputBase} ${inputOk} h-12 text-[15px] flex items-center justify-between text-left`}
          >
            {plural(form.adults, 'Adult', 'Adults')}, {plural(form.children, 'Child', 'Children')}
            <Icon name="chevronDown" />
          </button>
          {guestsOpen && (
            <div className="mt-2 border rounded-lg px-3 py-2" style={{ borderColor: 'var(--border)' }}>
              {counter('Adults', 'adults', 1)}
              {counter('Children', 'children', 0)}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="book-rooms" className="block text-sm mb-1.5" style={{ color: 'var(--muted)' }}>
            Rooms
          </label>
          <div className="relative">
            <select
              id="book-rooms"
              value={form.rooms}
              onChange={(e) => setForm({ ...form, rooms: Number(e.target.value) })}
              className={`${inputBase} ${inputOk} h-12 text-[15px] appearance-none pr-10`}
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {plural(n, 'Room', 'Rooms')}
                </option>
              ))}
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted)' }}>
              <Icon name="chevronDown" />
            </span>
          </div>
        </div>

        {total !== null && (
          <div className="flex items-baseline justify-between pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <span style={{ color: 'var(--muted)' }}>
              {formatPrice(hotel.priceFrom, hotel.currency)} × {plural(nights, 'night', 'nights')}
              {form.rooms > 1 && ` × ${plural(form.rooms, 'room', 'rooms')}`}
            </span>
            <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
              {formatPrice(total, hotel.currency)}
            </span>
          </div>
        )}
        {total !== null && (
          <p className="text-xs -mt-2" style={{ color: 'var(--muted)' }}>
            Based on the lowest room rate; pick a room below for its price.
          </p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="button" onClick={submit} className={`${pillButton} w-full h-12 text-base`}>
          Check Availability
        </button>
      </div>
    </div>
  );
}

function Sidebar({
  hotel,
  stay,
  onChangeStay,
}: {
  hotel: HotelDetail;
  stay: StayQuery;
  onChangeStay: (stay: StayQuery) => void;
}) {
  const rules = houseRules(hotel).map(([label, value]): [string, string] => [
    label === 'Check-in' || label === 'Check-out' ? `${label} time` : label,
    value,
  ]);
  const info: [string, string][] = propertyDetails(hotel).map((d) => [
    d.label === 'Internet' ? 'Wi-Fi' : d.label,
    d.detail,
  ]);
  if (hotel.extraBeds !== null) {
    info.push(['Extra beds', hotel.extraBeds ? 'Available' : 'Not available']);
  }

  return (
    <aside className="space-y-5 lg:sticky lg:top-6">
      <BookYourStay
        key={stayParams(stay).toString()}
        hotel={hotel}
        stay={stay}
        onChangeStay={onChangeStay}
      />
      {hotel.cancellation.length > 0 && (
        <SidebarCard title="Good to know">
          <ul className="space-y-2 text-sm" style={{ color: 'var(--text)' }}>
            {hotel.cancellation.map((p) => (
              <li key={p.type + p.description} className="flex gap-2">
                <span aria-hidden="true">•</span>
                <span>
                  {p.type && (
                    <span className="font-medium" style={{ color: 'var(--ink)' }}>
                      {p.type}:{' '}
                    </span>
                  )}
                  {p.description}
                </span>
              </li>
            ))}
          </ul>
        </SidebarCard>
      )}
      {rules.length > 0 && (
        <SidebarCard title="House rules">
          <InfoRows rows={rules} />
        </SidebarCard>
      )}
      {hotel.paymentMethods.length > 0 && (
        <SidebarCard title="Accepted payment methods">
          <div className="flex flex-wrap gap-2">
            {hotel.paymentMethods.map((m) => (
              <PaymentBadge key={m} method={m} />
            ))}
          </div>
        </SidebarCard>
      )}
      {info.length > 0 && (
        <SidebarCard title="Property information">
          <InfoRows rows={info} />
        </SidebarCard>
      )}
      <SupportCard />
    </aside>
  );
}

// ---- Page ------------------------------------------------------------------

export default function HotelDetailView({
  hotel,
  stay,
  onHome,
  onChangeStay,
  onSelectRoom,
}: {
  hotel: HotelDetail;
  stay: StayQuery;
  onHome: () => void;
  onChangeStay: (stay: StayQuery) => void;
  onSelectRoom: (room: Room) => void;
}) {
  // The sticky price bar only shows once the hero's price card has scrolled
  // out of view, so the two never sit on screen together.
  const heroRef = useRef<HTMLDivElement>(null);
  const [showBar, setShowBar] = useState(false);
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setShowBar(!entry.isIntersecting), {
      threshold: 0,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="space-y-6 pb-24">
      <Breadcrumb hotel={hotel} onHome={onHome} />
      <div ref={heroRef}>
        <Hero hotel={hotel} onCheckAvailability={() => scrollToId('book')} />
      </div>
      <Tabs />

      <div className="grid lg:grid-cols-[1fr_360px] gap-10 items-start pt-4">
        <div className="space-y-14 min-w-0">
          <Overview hotel={hotel} />
          <Rooms hotel={hotel} stay={stay} onSelectRoom={onSelectRoom} />
          <Facilities hotel={hotel} />
          <Gallery hotel={hotel} />
          <HouseRules hotel={hotel} />
        </div>
        <Sidebar hotel={hotel} stay={stay} onChangeStay={onChangeStay} />
      </div>

      {showBar && hotel.priceFrom !== null && (
        <div className="fixed inset-x-0 bottom-0 z-40 text-white shadow-[0_-8px_24px_rgba(0,0,0,0.15)]" style={{ background: 'var(--red)' }}>
          <div className="flex items-center justify-between gap-4 px-6 py-3" style={{ maxWidth: 1160, margin: '0 auto' }}>
            <p className="leading-tight">
              From{' '}
              <span className="text-2xl font-bold tabular-nums">
                {formatPrice(hotel.priceFrom, hotel.currency)}
              </span>{' '}
              / night
            </p>
            <button
              type="button"
              onClick={() => scrollToId('book')}
              className="rounded-full bg-white px-6 h-11 font-semibold shrink-0"
              style={{ color: 'var(--red)' }}
            >
              Check Availability
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
