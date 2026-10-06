'use client';

import { useMemo, useState } from 'react';
import SearchableSelect from '@/components/SearchableSelect';
import PaymentModal from '@/components/PaymentModal';
import { countryNames } from '@/lib/countries';
import { PaymentSession, processPayment } from '@/lib/payment';
import {
  BookingRequest,
  HotelDetail,
  Room,
  StayQuery,
  formatMoney,
  nightsBetween,
} from '@/lib/accommodation';
import {
  API,
  Field,
  TextField,
  formatDate,
  getJson,
  inputBase,
  inputErr,
  inputOk,
  poppins,
} from './ui';

const TITLES = ['MR', 'MRS', 'MS', 'DR', 'PROF', 'HON'];
const REASONS = ['Business', 'Leisure'];
const DEFAULT_PAYMENT_METHODS = ['MasterCard', 'Visa Card'];

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

export default function BookingForm({
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
  const [paymentSession, setPaymentSession] = useState<PaymentSession | null>(
    null,
  );
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const [paid, setPaid] = useState(false);
  const [checkoutScript, setCheckoutScript] = useState<string>();

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

  // Opens Mastercard's embedded checkout for the booking, the same way
  // registration does: the gateway reports back through Checkout.js callbacks
  // and a matching successIndicator confirms the payment.
  async function pay(booking: BookingResult) {
    setPaying(true);
    setPayError('');
    try {
      const { sessionId, successIndicator, checkoutScriptUrl } = await getJson<{
        sessionId: string;
        successIndicator: string;
        checkoutScriptUrl: string;
      }>(`${API}/pay?key=${encodeURIComponent(booking.paymentKey)}`);
      const session: PaymentSession = {
        sessionId,
        token: successIndicator,
        orderId: booking.reference || sessionId,
      };
      setCheckoutScript(checkoutScriptUrl);
      setPaymentSession(session);
      const outcome = await processPayment(session, checkoutScriptUrl);
      setPaymentSession(null);
      if (outcome.success) {
        setPaid(true);
      } else {
        setPayError(outcome.error || 'Payment was not completed. Please try again.');
      }
    } catch (err) {
      setPaymentSession(null);
      setPayError((err as Error).message);
    } finally {
      setPaying(false);
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
            style={{ color: 'var(--ink)' }}
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
        {paymentSession && (
          <PaymentModal
            isOpen
            session={paymentSession}
            amount={total ?? 0}
            currency={room.currency}
            itemLabel="Booking"
            gatewayScriptUrl={checkoutScript}
            categoryName={`${hotel.name} · ${room.name}`}
            customerEmail={fields.email}
            onClose={() => {
              // Closing the modal counts as cancelling; Checkout.js doesn't
              // report it, so the pending payment is resolved here.
              window.cancelCallback?.();
            }}
          />
        )}
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
            className="text-2xl font-semibold mb-3"
            style={{ ...poppins, color: 'var(--ink)' }}
          >
            {paid
              ? 'Booking confirmed'
              : payOnline
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
          {paid ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              Payment received. Your booking is confirmed.
            </div>
          ) : payOnline ? (
            <div>
              <button
                type="button"
                onClick={() => pay(result)}
                disabled={paying}
                className="btn-primary inline-block px-8 py-3 rounded-lg text-white text-sm font-semibold disabled:opacity-60"
              >
                {paying
                  ? 'Opening secure payment…'
                  : `Pay ${total !== null ? formatMoney(total, room.currency) : 'now'}`}
              </button>
              {payError && (
                <p className="text-sm text-red-600 mt-3" role="alert">
                  {payError}
                </p>
              )}
              <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
                Card payments are processed securely by Mastercard.
              </p>
            </div>
          ) : isOnsite(fields.paymentMethod) ? (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Payment is settled at the hotel on arrival.
            </p>
          ) : (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Payment instructions will be sent to {fields.email}.
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
          className="text-xl font-semibold"
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
                // The value goes back to Smartbookings as it sent it,
                // including its "Onsite Payement" spelling.
                <option key={m} value={m}>
                  {m.replace(/Payement/i, 'Payment')}
                </option>
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
