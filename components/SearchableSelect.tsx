'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  id?: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hasError?: boolean;
  describedBy?: string;
}

// Used for long option lists (country of residence, for example) where a plain
// <select> is unwieldy. Falls back to showing every option when the query is
// empty.
export default function SearchableSelect({
  id,
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  hasError = false,
  describedBy,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, query]);

  const selectedLabel = options.find((opt) => opt.value === value)?.label;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        id={id}
        aria-describedby={describedBy}
        onClick={() => setOpen((prev) => !prev)}
        className="w-full px-3 py-2 text-sm border rounded-lg text-left flex items-center justify-between gap-2 bg-white focus:ring-2 focus:outline-none"
        style={{
          borderColor: hasError ? '#ef4444' : 'var(--border)',
          color: selectedLabel ? 'var(--text)' : 'var(--muted)',
        }}
      >
        <span className="truncate">{selectedLabel || placeholder}</span>
        <svg
          className="w-4 h-4 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          style={{ color: 'var(--muted)' }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div
          className="absolute z-30 mt-1 w-full bg-white border rounded-lg shadow-lg overflow-hidden"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full px-2 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2"
              style={{ borderColor: 'var(--border)' }}
            />
          </div>
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li
                className="px-3 py-2 text-sm"
                style={{ color: 'var(--muted)' }}
              >
                No matches
              </li>
            ) : (
              filtered.map((opt) => (
                <li key={opt.value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                      setQuery('');
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                    style={{
                      color: opt.value === value ? 'var(--red)' : 'var(--text)',
                      fontWeight: opt.value === value ? 600 : 400,
                    }}
                  >
                    {opt.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
