# EAMJA — Conference Registration

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

## Not included

Group registration (present in `cbff-sme-2026`) is intentionally left out —
this flow registers a single delegate.

## Layout

| Path | Purpose |
| --- | --- |
| [app/registration/page.tsx](app/registration/page.tsx) | The whole registration flow |
| [app/api/smartevent/[...path]/route.ts](app/api/smartevent/) | Proxy that injects the event code |
| [app/api/smartevent/Initialize-Payment/route.ts](app/api/smartevent/Initialize-Payment/route.ts) | Opens a card checkout session |
| [lib/payment.ts](lib/payment.ts) | Mastercard Checkout.js integration |
| [lib/smartevent.ts](lib/smartevent.ts) | API URL and event code |
| [components/PaymentModal.tsx](components/PaymentModal.tsx) | Embedded checkout modal |
| [components/SearchableSelect.tsx](components/SearchableSelect.tsx) | Filterable dropdown for long option lists |
