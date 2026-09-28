'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon, isoFromNow } from './ui';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function fromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Six rows of dates for a month grid, including the tail of the previous and
// head of the next month (shown faded).
function monthCells(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const count = first.getDay() + new Date(year, month + 1, 0).getDate() > 35 ? 42 : 35;
  return Array.from(
    { length: count },
    (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
  );
}

function shortLabel(iso: string): string {
  return fromIso(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Two-month arrival/departure picker. The first click sets arrival, the second
// sets departure (a click on or before arrival restarts the range).
export default function DateRangePicker({
  checkin,
  checkout,
  onChange,
}: {
  checkin: string;
  checkout: string;
  onChange: (checkin: string, checkout: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [view, setView] = useState(() => {
    const d = fromIso(checkin || isoFromNow(0));
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const ref = useRef<HTMLDivElement>(null);
  const today = isoFromNow(0);

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false);
        setDraftStart(null);
      }
    }
    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        setDraftStart(null);
      }
    }
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  function pick(iso: string) {
    if (!draftStart || iso <= draftStart) {
      setDraftStart(iso);
      return;
    }
    onChange(draftStart, iso);
    setDraftStart(null);
    setOpen(false);
  }

  function shift(months: number) {
    setView(({ year, month }) => {
      const d = new Date(year, month + months, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  // While choosing, the range previews up to the hovered date.
  const rangeStart = draftStart ?? checkin;
  const rangeEnd = draftStart ? (hover && hover > draftStart ? hover : null) : checkout;

  const months = [0, 1].map((offset) => {
    const d = new Date(view.year, view.month + offset, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  return (
    <div ref={ref} className="relative h-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="w-full h-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <span style={{ color: 'var(--red)' }}>
          <Icon name="calendar" className="w-5 h-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium" style={{ color: 'var(--ink)' }}>
            Arrival – Departure
          </span>
          <span className="block text-sm truncate" style={{ color: 'var(--muted)' }}>
            {checkin && checkout
              ? `${shortLabel(checkin)} - ${shortLabel(checkout)}`
              : 'Select dates'}
          </span>
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose arrival and departure dates"
          className="absolute z-30 left-0 top-full mt-2 bg-white border rounded-2xl shadow-xl p-5 w-[min(92vw,640px)]"
          style={{ borderColor: 'var(--border)' }}
        >
          <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
            {draftStart
              ? `Arrival ${shortLabel(draftStart)} — now choose departure`
              : 'Choose your arrival date'}
          </p>
          <div className="grid sm:grid-cols-2 gap-6">
            {months.map(({ year, month }, i) => (
              <div key={`${year}-${month}`}>
                <div className="flex items-center justify-between mb-3">
                  <button
                    type="button"
                    onClick={() => shift(-1)}
                    aria-label="Previous month"
                    className={`p-1 rounded hover:bg-gray-100 ${i === 0 ? '' : 'invisible'}`}
                  >
                    <Icon name="chevronLeft" />
                  </button>
                  <span className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>
                    {new Date(year, month, 1).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() => shift(1)}
                    aria-label="Next month"
                    className={`p-1 rounded hover:bg-gray-100 ${i === 1 ? '' : 'invisible'}`}
                  >
                    <Icon name="chevronRight" />
                  </button>
                </div>
                <div className="grid grid-cols-7 text-center text-xs" style={{ color: 'var(--muted)' }}>
                  {WEEKDAYS.map((d) => (
                    <span key={d} className="py-1">
                      {d}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-y-1 text-center text-sm">
                  {monthCells(year, month).map((date) => {
                    const iso = toIso(date);
                    const inMonth = date.getMonth() === month;
                    const past = iso < today;
                    const isStart = iso === rangeStart;
                    const isEnd = iso === rangeEnd;
                    const inRange =
                      !!rangeStart && !!rangeEnd && iso > rangeStart && iso < rangeEnd;
                    return (
                      <button
                        key={iso}
                        type="button"
                        disabled={past || !inMonth}
                        onClick={() => pick(iso)}
                        onMouseEnter={() => setHover(iso)}
                        aria-pressed={isStart || isEnd}
                        aria-label={date.toDateString()}
                        className="h-9 rounded-lg border disabled:cursor-default"
                        style={{
                          color:
                            inMonth && (isStart || isEnd)
                              ? 'var(--white)'
                              : past || !inMonth
                                ? '#C5CDD4'
                                : 'var(--ink)',
                          background:
                            !inMonth
                              ? 'transparent'
                              : isStart || isEnd
                              ? 'var(--red)'
                              : inRange
                                ? 'rgba(198,27,17,0.08)'
                                : 'transparent',
                          borderColor:
                            inMonth && iso === today && !isStart && !isEnd
                              ? 'var(--red)'
                              : 'transparent',
                        }}
                      >
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
