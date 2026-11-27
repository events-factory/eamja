'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import DelegateForm from '@/components/registration/DelegateForm';
import PaymentSummary from '@/components/registration/PaymentSummary';
import { useCardPayment } from '@/components/registration/useCardPayment';
import { extractCurrency } from '@/lib/payment';
import {
  SMARTEVENT_API,
  EMAIL_INPUT,
  FIRST_NAME_INPUT,
  IMAGE_TYPE,
  LAST_NAME_INPUT,
  buildDelegateForm,
  confirmationEmailSent,
  decodeHtml,
  messageList,
  smartEventJson,
  smartEventPost,
  valuesFromGroups,
  type FormInputGroup,
  type FormValues,
} from '@/lib/registration';

// What Registration-Form-Data-Retriever returns for a valid update token. An
// unknown or expired token comes back as just `{ message: [...] }`.
interface Registration {
  message?: string | string[];
  category?: { name_english: string; fee: string; is_free: 'YES' | 'NO' };
  data?: FormInputGroup[];
  record_unique_data?: {
    ticket_id: number;
    attendence_type: string;
    accompanied: string;
    registration_status: string;
    badge_id: string;
    amount_to_pay: number;
    amount_received: number;
  };
}

type State =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'invalid'; messages: string[] }
  | { kind: 'error' }
  | { kind: 'ready'; registration: Required<Registration> };

export default function UpdateRegistrationPage() {
  return (
    // useSearchParams needs a Suspense boundary to prerender.
    <Suspense
      fallback={
        <Shell>
          <LoadingPanel />
        </Shell>
      }
    >
      <UpdateRegistration />
    </Suspense>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--light)' }}
    >
      <SiteHeader
        eyebrow="Conference Registration"
        title="Update your registration"
      />
      <main
        className="flex-1"
        style={{
          maxWidth: 1160,
          margin: '0 auto',
          width: '100%',
          padding: '40px 16px 64px',
        }}
      >
        {children}
      </main>
    </div>
  );
}

// The page delegates land on from the registration-update link SmartEvent
// emails them: https://<site>/registration/update?token=<update token>.
// It works while public registration is closed.
function UpdateRegistration() {
  const searchParams = useSearchParams();
  const token =
    searchParams.get('token') ||
    searchParams.get('registration_update_token') ||
    '';

  const [state, setState] = useState<State>({ kind: 'loading' });
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [emailSent, setEmailSent] = useState(true);
  const [payment, setPayment] = useState<{
    transactionId: string;
    orderId: string;
  } | null>(null);
  const card = useCardPayment();

  const load = useCallback(async () => {
    if (!token) {
      setState({ kind: 'missing' });
      return;
    }
    setState({ kind: 'loading' });
    try {
      const res = await smartEventJson<Registration>(
        '/Registration-Form-Data-Retriever',
        { registration_update_token: token },
      );
      if (Array.isArray(res.data) && res.record_unique_data && res.category) {
        setState({
          kind: 'ready',
          registration: res as Required<Registration>,
        });
      } else {
        setState({
          kind: 'invalid',
          messages: messageList(
            res.message,
            'This link is not valid any more.',
          ),
        });
      }
    } catch {
      setState({ kind: 'error' });
    }
  }, [token]);

  useEffect(() => {
    // Mount-time fetch of the delegate's saved registration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (saved) {
    return (
      <Shell>
        <SuccessPanel emailSent={emailSent} payment={payment} />
      </Shell>
    );
  }

  if (state.kind === 'loading') {
    return (
      <Shell>
        <LoadingPanel label="Loading your registration…" />
      </Shell>
    );
  }

  if (state.kind === 'error') {
    return (
      <Shell>
        <div className="panel p-10 text-center">
          <p className="text-red-600 mb-4">
            Failed to load your registration. Please try again.
          </p>
          <button
            onClick={load}
            className="btn-primary px-6 py-2.5 rounded-lg text-white text-sm font-semibold"
          >
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  if (state.kind === 'missing' || state.kind === 'invalid') {
    return (
      <Shell>
        <LinkProblem
          token={token}
          messages={state.kind === 'invalid' ? state.messages : []}
        />
      </Shell>
    );
  }

  const { registration } = state;
  const record = registration.record_unique_data;
  const outstanding = Math.max(
    0,
    Number(record.amount_to_pay || 0) - Number(record.amount_received || 0),
  );

  async function handleSubmit(values: FormValues): Promise<string[] | void> {
    let paid: {
      orderId?: string;
      paymentToken?: string;
      paymentSession?: string;
      transactionId?: string;
    } = {};

    const isBankTransfer = Object.values(values).some(
      (v) => typeof v === 'string' && v.toLowerCase().includes('bank transfer'),
    );

    // An unpaid balance on a paid category goes through the card gateway
    // before the update is saved.
    if (outstanding > 0 && !isBankTransfer) {
      const result = await card.pay({
        orderId: `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        amount: outstanding,
        currency: extractCurrency(registration.category.fee),
        categoryName: decodeHtml(registration.category.name_english),
        categoryId: record.ticket_id,
        attendenceType: record.attendence_type,
        customerEmail: (values[EMAIL_INPUT] as string) || '',
        customerName:
          `${values[FIRST_NAME_INPUT] || ''} ${values[LAST_NAME_INPUT] || ''}`.trim(),
      });
      if (!result.success) {
        return [result.error || 'Payment was not completed. Please try again.'];
      }
      paid = result;
    }

    setSubmitting(true);
    try {
      // A saved photo the delegate removed goes out blank so SmartEvent
      // clears it, rather than keeping the old one.
      const imageInputs = registration.data
        .flatMap((group) => group.inputs)
        .filter(({ input }) => input.inputtype.id === IMAGE_TYPE)
        .map(({ input }) => input.inputcode);
      const form = buildDelegateForm(registration.data, values, imageInputs);
      form.append('ticket_id', String(record.ticket_id));
      form.append('attendence_type', record.attendence_type || 'PHYSICAL');
      form.append('accompanied', record.accompanied || 'NO');
      form.append('registration_update_token', token);
      if (paid.transactionId) {
        form.append('order_id', paid.orderId || '');
        form.append('payment_token', paid.paymentToken || '');
        form.append('payment_session', paid.paymentSession || '');
        form.append('acknowleadgment', paid.transactionId);
      }

      const result = await smartEventPost<{
        success?: boolean;
        message?: string | string[];
      }>('/Update-Delegate', form);

      if (!result.ok || result.success === false) {
        return messageList(
          result.message,
          'Your changes could not be saved. Please try again.',
        );
      }
      if (paid.transactionId && paid.orderId) {
        setPayment({
          transactionId: paid.transactionId,
          orderId: paid.orderId,
        });
      }
      setEmailSent(confirmationEmailSent(result.message));
      setSaved(true);
    } catch {
      return [
        'Something went wrong while saving your registration. Please try again.',
      ];
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Shell>
      <p className="mb-5 text-sm sm:text-base" style={{ color: 'var(--text)' }}>
        You are registered as{' '}
        <strong className="capitalize">
          {decodeHtml(registration.category.name_english).toLowerCase()}
        </strong>
        . Check your details below, add your profile photo if asked, and save
        any changes.
      </p>
      <DelegateForm
        groups={registration.data}
        initialValues={valuesFromGroups(registration.data)}
        submitLabel={outstanding > 0 ? 'Proceed to payment' : 'Save changes'}
        submitting={submitting}
        processing={card.processing}
        footer={
          outstanding > 0 && (
            <PaymentSummary fee={registration.category.fee} due={outstanding} />
          )
        }
        onSubmit={handleSubmit}
      />
      {card.modal}
    </Shell>
  );
}

function LoadingPanel({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="panel p-10 text-center">
      <div
        className="animate-spin w-12 h-12 border-4 rounded-full mx-auto mb-4"
        style={{ borderColor: 'var(--red)', borderTopColor: 'transparent' }}
      />
      <p style={{ color: 'var(--muted)' }}>{label}</p>
    </div>
  );
}

function SuccessPanel({
  emailSent,
  payment,
}: {
  emailSent: boolean;
  payment: { transactionId: string; orderId: string } | null;
}) {
  return (
    <div className="flex justify-center">
      <div className="panel p-8 text-center max-w-lg w-full">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-10 h-10 text-green-600"
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
          className="text-2xl font-bold mb-4"
          style={{
            color: 'var(--ink)',
            fontFamily: 'var(--font-poppins),sans-serif',
          }}
        >
          {payment ? 'Payment received — details saved' : 'Registration updated'}
        </h2>
        <p style={{ color: 'var(--muted)' }}>
          Thank you. Your details are saved.
          {emailSent && ' A confirmation email is on its way.'} You can use the
          same link to make further changes.
        </p>
        {payment && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-left">
            <h3 className="text-sm font-semibold text-green-800 mb-3">
              Payment details
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span style={{ color: 'var(--muted)' }}>Transaction ID</span>
                <span className="font-mono font-medium truncate">
                  {payment.transactionId}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span style={{ color: 'var(--muted)' }}>Order ID</span>
                <span className="font-mono font-medium truncate">
                  {payment.orderId}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span style={{ color: 'var(--muted)' }}>Status</span>
                <span className="text-green-600 font-medium">Paid</span>
              </div>
            </div>
          </div>
        )}
        <div
          className="mt-6 pt-6 border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
            Need somewhere to stay? Book a partner hotel at the event rate.
          </p>
          <Link
            href="/accommodation-2"
            className="btn-primary inline-block px-6 py-2.5 rounded-lg text-white text-sm font-semibold"
          >
            Book accommodation
          </Link>
        </div>
      </div>
    </div>
  );
}

// Shown for a missing, unknown or expired token. Given the old token,
// SmartEvent can email a fresh link to the address the registration used.
function LinkProblem({
  token,
  messages,
}: {
  token: string;
  messages: string[];
}) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<
    | { kind: 'idle' }
    | { kind: 'sending' }
    | { kind: 'sent' }
    | { kind: 'failed'; messages: string[] }
  >({ kind: 'idle' });

  async function requestLink(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus({ kind: 'failed', messages: ['Enter a valid email address.'] });
      return;
    }
    setStatus({ kind: 'sending' });
    try {
      const res = await fetch(
        `${SMARTEVENT_API}/Registration-Update-Link-Request`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            registration_update_token: token,
            user_language: 'english',
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        setStatus({
          kind: 'failed',
          messages: messageList(
            data.message,
            'We could not send a new link. Please check the address and try again.',
          ),
        });
        return;
      }
      setStatus({ kind: 'sent' });
    } catch {
      setStatus({
        kind: 'failed',
        messages: ['Something went wrong. Please try again.'],
      });
    }
  }

  return (
    <div className="panel p-6 sm:p-8 max-w-xl mx-auto">
      <h2
        className="text-xl font-semibold mb-2"
        style={{
          color: 'var(--ink)',
          fontFamily: 'var(--font-poppins),sans-serif',
        }}
      >
        {token
          ? 'This link has expired or is not valid'
          : 'Registration link needed'}
      </h2>
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        {token
          ? 'Links are personal and expire after a while. Enter the email address you registered with and we will email you a new link.'
          : 'This page opens from the update link in your registration email. Please open the link from that email.'}
      </p>
      {messages.length > 0 && (
        <p className="mt-3 text-sm text-red-600">{messages.join(' ')}</p>
      )}

      {/* SmartEvent issues a new link only in exchange for the old token, so
          without one there is nothing to request. */}
      {!token ? null : status.kind === 'sent' ? (
        <div className="mt-6 p-4 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
          A new link is on its way to <strong>{email}</strong>. Check your
          inbox, and your spam folder if it does not arrive in a few minutes.
        </div>
      ) : (
        <form onSubmit={requestLink} className="mt-6" noValidate>
          <label
            htmlFor="link-email"
            className="block text-sm font-medium mb-1.5"
            style={{ color: 'var(--text)' }}
          >
            Email address
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="link-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:outline-none border-gray-300 focus:ring-primary-500/30 focus:border-primary-500"
              autoComplete="email"
            />
            <button
              type="submit"
              disabled={status.kind === 'sending'}
              className="btn-primary px-6 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
            >
              {status.kind === 'sending' ? 'Sending…' : 'Send me a new link'}
            </button>
          </div>
          {status.kind === 'failed' && (
            <p className="mt-2 text-sm text-red-600">
              {status.messages.join(' ')}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
