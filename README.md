# EAMJA — Conference Registration & Accommodation

Registration flow for the East African Magistrates' and Judges' Association
conference, built on the SmartEvent registration API. It follows the same
approach as the `mededafrica-abstract-submission` and `cbff-sme-2026` projects
and talks to the same endpoints.

## Getting started

```bash
npm install
npm run dev     # http://localhost:3000/registration
```

`/` redirects to `/registration`.

## Event code

The EAMJA Conference event code is set in `.env.local` (gitignored). The code
stays server-side — the browser only ever calls this app's own
`/api/smartevent/*` routes.

```bash
# .env.local
SMARTEVENT_API_URL=https://app.smartevent.rw/Api
SMARTEVENT_EVENT_CODE=<the EAMJA event code>
```

Fallbacks live in [lib/smartevent.ts](lib/smartevent.ts). Point these at
`https://sandbox.smartevent.rw/Api` to test against sandbox instead.

## How the flow works

1. `GET /Registration-Page-Api` — reads the event's attendance type. A `HYBRID`
   event shows an in-person/virtual chooser first; otherwise it is skipped.
2. `POST /Display-Registration-Categories` — the delegate category cards.
3. `POST /Display-Categories-Form-Inputs` — the form for the chosen category,
   rendered as one step per input group with per-step validation.
4. Paid categories open the Mastercard embedded checkout
   (`/api/smartevent/Initialize-Payment` → `Initiate-Gateway-Session`).
   Free categories and bank transfer skip straight to step 5. The EAMJA
   categories are currently free, so this step does not run today — the
   card path stays wired for when a paid category is added.
5. `POST /Register-Delegate` — saves the registration and returns the
   registration number shown on the confirmation screen.

Form fields are driven entirely by SmartEvent, so field changes made in the
SmartEvent dashboard appear here without a deploy. Selects with more than 12
options (country lists) render as a searchable dropdown.

## Accommodation

There are two accommodation pages while one is chosen:

- `/accommodation` embeds Smartbookings' own event hotel search
  (`mim.smartbookings.rw/Event-Hotels/<event code>/…`) in an iframe, the same
  way `cbff-sme-2026` does. Search, booking and payment happen inside the frame.
- `/accommodation-2` is a native flow,
  [components/HotelBooking.tsx](components/HotelBooking.tsx): search → hotel →
  room → booking form, in the site's own design. It opens on the conference
  dates (28 Nov – 7 Dec 2026).

The native flow uses the Smartbookings client API
(`https://smartbookings.rw`). The `{{token}}` in its URLs is the **base64 of
the event code** (`SMARTBOOKINGS_EVENT_CODE`, default in
[lib/smartbookings.ts](lib/smartbookings.ts)). The raw code passes the key check
but then fails with an empty 500. The token stays server-side, like the
SmartEvent code.

| Step | Browser calls | Smartbookings endpoint |
| --- | --- | --- |
| Default dates | `GET /api/smartbookings/filters` | `GET /Client-FiltersList/` |
| Hotel list | `GET /api/smartbookings/hotels` | `GET /Client-HotelsList/{token}/{page}/Find` |
| Hotel + rooms | `GET /api/smartbookings/hotels/{code}` | `GET /Client-HotelDetail/{token}/{hotel}/Find` |
| Book a room | `POST /api/smartbookings/booking` | `POST /Client-BookingForm` (JSON) |
| Pay by card | `GET /api/smartbookings/pay?key=` | `GET /Client-Payments-Portal` (`Authorization` header) |

Quirks worth knowing:

- Dates are MM/DD/YYYY in query strings, but `Client-FiltersList` returns its
  default range as DD/MM/YYYY. `Client-BookingForm` takes `book_from`/`book_to`
  as epoch seconds at midnight Kigali time (UTC+2).
- The booking field is spelled `firs_tname`, and is sent that way on purpose.
- Failed calls come back as an empty-bodied 500, which the routes turn into a
  readable `{ message }`.
- [lib/accommodation.ts](lib/accommodation.ts) maps the responses onto the
  page's own types: hotels come from `data.facilities` (`hotelcode`,
  `hotelname`, `banner`, `minprice`, with `last_page` for paging), and hotel
  detail has the hotel under `hotel` with `rooms` (`roomcode`, `roomprice`,
  `amenties`), `payment` and `policies` alongside.
- `range` (price `min;max`) is required on HotelsList; without it the call
  fails. Hotel amenities filter as `<searchID>=1` using the keys from
  `Client-FiltersList` (an unknown key fails the call, so the route only
  forwards known ones), and `star` takes one rating. Room-amenity filters are
  ignored by HotelsList, so the page doesn't offer them.
- Card payment: `Client-Payments-Portal` (authorised with the key returned by
  the booking) answers with a Mastercard checkout session, which the booking
  screen opens in the same embedded checkout as registration. Smartbookings'
  merchant is currently on Mastercard's **test** gateway and will move to live
  credentials. A session only exists on the gateway that created it, so the pay
  route looks each session up on the hosts in `SMARTBOOKINGS_GATEWAY_HOSTS`
  (default: `ap-gateway`, then `test-gateway`) and the page loads Checkout.js
  from the one that has it. Test and live both work without a config change.
- HotelDetail doesn't issue a per-room token, so the booking route sends a
  unique random `token` with each booking.

## Not included

Group registration (present in `cbff-sme-2026`) is intentionally left out —
this flow registers a single delegate.

## Layout

| Path | Purpose |
| --- | --- |
| [app/registration/page.tsx](app/registration/page.tsx) | The whole registration flow |
| [app/accommodation/page.tsx](app/accommodation/page.tsx) | Accommodation page (Smartbookings iframe) |
| [app/accommodation-2/page.tsx](app/accommodation-2/page.tsx) | Accommodation page (native flow) |
| [components/HotelBooking.tsx](components/HotelBooking.tsx) | Native accommodation flow: list → hotel → booking, kept in the URL |
| [components/accommodation/](components/accommodation/) | Its screens: search bar and list, date picker, hotel page, booking form, shared UI |
| [app/api/smartbookings/](app/api/smartbookings/) | Smartbookings routes that add the event token |
| [app/api/smartevent/[...path]/route.ts](app/api/smartevent/) | Proxy that injects the event code |
| [app/api/smartevent/Initialize-Payment/route.ts](app/api/smartevent/Initialize-Payment/route.ts) | Opens a card checkout session |
| [lib/payment.ts](lib/payment.ts) | Mastercard Checkout.js integration |
| [lib/smartevent.ts](lib/smartevent.ts) | API URL and event code |
| [lib/smartbookings.ts](lib/smartbookings.ts) | Smartbookings URL, event token and fetch wrapper |
| [lib/accommodation.ts](lib/accommodation.ts) | Accommodation types, date formats and response normalisers |
| [lib/countries.ts](lib/countries.ts) | Country list for the booking form |
| [components/SiteHeader.tsx](components/SiteHeader.tsx) | Shared header and navigation |
| [components/PaymentModal.tsx](components/PaymentModal.tsx) | Embedded checkout modal |
| [components/SearchableSelect.tsx](components/SearchableSelect.tsx) | Filterable dropdown for long option lists |
