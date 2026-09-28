import SiteHeader from '@/components/SiteHeader';
import HotelBooking from '@/components/HotelBooking';

// Native version of /accommodation, built on the Smartbookings client API
// instead of an iframe. Both stay live until one is chosen.

// Conference dates, matching the range the /accommodation iframe opens on.
const CONFERENCE_STAY = {
  checkin: '2026-11-28',
  checkout: '2026-12-07',
  rooms: 1,
  adults: 1,
  children: 0,
};

export default function AccommodationTwoPage() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--light)' }}
    >
      <SiteHeader
        eyebrow="Conference Accommodation"
        title="Book your hotel"
        active="/accommodation-2"
      />
      <main
        className="flex-1 w-full"
        style={{ maxWidth: 1160, margin: '0 auto', padding: '40px 24px 64px' }}
      >
        <HotelBooking initialStay={CONFERENCE_STAY} />
      </main>
    </div>
  );
}
