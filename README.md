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

`/accommodation` currently embeds Smartbookings' own event hotel search
(`mim.smartbookings.rw/Event-Hotels/<event code>/…`) in an iframe, the same way
`cbff-sme-2026` does. Search, booking and payment all happen inside the frame.

A native booking flow is built in
[components/HotelBooking.tsx](components/HotelBooking.tsx) but not mounted:
`Client-HotelsList` and `Client-HotelDetail` return an empty-bodied 500 for the
EAMJA token (a random token gets a proper 403, so the key is accepted and the
failure is server-side). Once Smartbookings fix that, render `<HotelBooking />`
in [app/accommodation/page.tsx](app/accommodation/page.tsx) instead of the
iframe.

The native flow uses the Smartbookings client API
(`https://smartbookings.rw`). The event token (`SMARTBOOKINGS_TOKEN`, default
in [lib/smartbookings.ts](lib/smartbookings.ts)) scopes results to EAMJA's
hotels and stays server-side, like the SmartEvent code.

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
- Response field names aren't documented, so
  [lib/accommodation.ts](lib/accommodation.ts) normalises hotels and rooms from
  the names Smartbookings' own pages use (`hotcode`, `star`, `cover`,
  `room_id`, `token`) plus the obvious alternatives.

The check-in/check-out defaults come from Smartbookings, so the event dates
are managed in the Smartbookings admin.

## Not included

Group registration (present in `cbff-sme-2026`) is intentionally left out —
this flow registers a single delegate.

## Layout

| Path | Purpose |
| --- | --- |
| [app/registration/page.tsx](app/registration/page.tsx) | The whole registration flow |
| [app/accommodation/page.tsx](app/accommodation/page.tsx) | Accommodation page (Smartbookings iframe) |
| [components/HotelBooking.tsx](components/HotelBooking.tsx) | Native hotel search, rooms and booking (not mounted yet) |
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
