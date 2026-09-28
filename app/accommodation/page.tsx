import SiteHeader from '@/components/SiteHeader';

// Smartbookings' own event hotel search, pre-filled with the conference dates.
// Search, room selection, booking and payment all happen inside the frame.
const BOOKING_URL =
  'https://mim.smartbookings.rw/Event-Hotels/6352677cb785a/1/Search?place=Rwanda&bookingrange=11%2F28%2F2026+-+12%2F07%2F2026&roomnum=1&adult=1&child=0';

// Smartbookings is cross-origin and doesn't report its height, so the frame
// can't be sized to its content. Instead it gets a fixed height tall enough for
// the hotel list and detail pages, with its own scrolling turned off, and the
// page scrolls as one. Anything taller than FRAME_HEIGHT is cut off, so raise
// it if a page ends up clipped.
const FRAME_HEIGHT = 4500;

export default function AccommodationPage() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--light)' }}
    >
      <SiteHeader
        eyebrow="Conference Accommodation"
        title="Book your hotel"
        active="/accommodation"
      />
      <main
        className="flex-1 w-full"
        style={{ maxWidth: 1160, margin: '0 auto', padding: '24px 24px 64px' }}
      >
        <p className="mb-4 max-w-2xl text-sm" style={{ color: 'var(--muted)' }}>
          Partner hotels have been selected for conference delegates. Book
          through the official platform below to get the negotiated event
          rates. Questions about a booking? Email{' '}
          <a
            href="mailto:reservation@eventsfactory.rw"
            className="underline"
            style={{ color: 'var(--sky2)' }}
          >
            reservation@eventsfactory.rw
          </a>
          .
        </p>
        <div
          className="panel overflow-hidden"
          style={{ borderTop: '3px solid var(--red)' }}
        >
          <iframe
            src={BOOKING_URL}
            title="Smartbookings — EAMJA conference hotels"
            width="100%"
            height={FRAME_HEIGHT}
            scrolling="no"
            style={{ display: 'block', border: 'none' }}
            allow="payment"
          />
        </div>
      </main>
    </div>
  );
}
