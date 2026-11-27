'use client';

import { useCallback, useEffect, useState } from 'react';
import SiteHeader from '@/components/SiteHeader';
import DelegateForm from '@/components/registration/DelegateForm';
import {
  buildDelegateForm,
  messageList,
  smartEventJson,
  smartEventPost,
  type FormInputGroup,
  type FormValues,
} from '@/lib/registration';
import { MEDIA_CATEGORY_ID } from '@/lib/media';

const CLOSED_MESSAGE =
  'Media registration has closed. For accreditation enquiries, please contact the organising committee.';

type State =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; groups: FormInputGroup[] };

export default function MediaRegistration({
  initiallyOpen,
  deadline,
}: {
  initiallyOpen: boolean;
  deadline: string;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [submitting, setSubmitting] = useState(false);
  const [registrationNumber, setRegistrationNumber] = useState<
    string | null
  >(null);

  // A tab left open past the deadline closes too.
  useEffect(() => {
    if (!open) return;
    const ms = new Date(deadline).getTime() - Date.now();
    if (ms <= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
      return;
    }
    // setTimeout overflows past ~24.8 days; re-render well before then.
    const timer = setTimeout(() => setOpen(false), Math.min(ms, 2 ** 31 - 1));
    return () => clearTimeout(timer);
  }, [open, deadline]);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const res = await smartEventJson<{ data?: FormInputGroup[] }>(
        '/Display-Categories-Form-Inputs',
        {
          category: MEDIA_CATEGORY_ID,
          attendence: 'PHYSICAL',
          operation: 'get-form-inputs',
        },
      );
      if (!Array.isArray(res.data) || res.data.length === 0) {
        setState({ kind: 'error' });
        return;
      }
      setState({ kind: 'ready', groups: res.data });
    } catch {
      setState({ kind: 'error' });
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    // Mount-time fetch of the MEDIA form.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [open, load]);

  async function handleSubmit(values: FormValues): Promise<string[] | void> {
    if (state.kind !== 'ready') return;
    if (Date.now() >= new Date(deadline).getTime()) {
      setOpen(false);
      return;
    }
    setSubmitting(true);
    try {
      const form = buildDelegateForm(state.groups, values);
      form.append('ticket_id', String(MEDIA_CATEGORY_ID));
      form.append('attendence_type', 'PHYSICAL');
      form.append('accompanied', 'NO');
      form.append('registration_type', 'single');
      form.append('grand_total', '0');
      form.append('order_id', '');
      form.append('payment_token', '');
      form.append('payment_session', '');
      form.append('acknowleadgment', '');

      const result = await smartEventPost<{
        success?: boolean;
        message?: string | string[];
        registration_number?: string | number;
      }>('/Register-Delegate', form);

      if (!result.ok || result.success === false) {
        return messageList(
          result.message,
          'Registration failed. Please try again.',
        );
      }
      setRegistrationNumber(
        result.registration_number != null
          ? String(result.registration_number)
          : '',
      );
    } catch {
      return [
        'Something went wrong while submitting your registration. Please try again.',
      ];
    } finally {
      setSubmitting(false);
    }
  }

  let body: React.ReactNode;
  if (registrationNumber !== null) {
    body = (
      <Notice
        tone="success"
        title="Media registration received"
        message="Thank you. Your accreditation request has been received and a confirmation email is on its way."
        registrationNumber={registrationNumber}
      />
    );
  } else if (!open) {
    body = (
      <Notice
        tone="closed"
        title="Media registration has closed"
        message={CLOSED_MESSAGE}
      />
    );
  } else if (state.kind === 'loading') {
    body = (
      <div className="panel p-10 text-center">
        <div
          className="animate-spin w-12 h-12 border-4 rounded-full mx-auto mb-4"
          style={{ borderColor: 'var(--red)', borderTopColor: 'transparent' }}
        />
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      </div>
    );
  } else if (state.kind === 'error') {
    body = (
      <div className="panel p-10 text-center">
        <p className="text-red-600 mb-4">
          Failed to load the registration form. Please try again.
        </p>
        <button
          onClick={load}
          className="btn-primary px-6 py-2.5 rounded-lg text-white text-sm font-semibold"
        >
          Try again
        </button>
      </div>
    );
  } else {
    body = (
      <>
        <p
          className="mb-5 text-sm sm:text-base"
          style={{ color: 'var(--text)' }}
        >
          Journalists and media crews covering the conference can register
          here. Please include a clear profile photo.
        </p>
        <DelegateForm
          groups={state.groups}
          submitLabel="Submit registration"
          submitting={submitting}
          onSubmit={handleSubmit}
        />
      </>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--light)' }}
    >
      <SiteHeader eyebrow="Media Accreditation" title="Media registration" />
      <main
        className="flex-1"
        style={{
          maxWidth: 1160,
          margin: '0 auto',
          width: '100%',
          padding: '40px 16px 64px',
        }}
      >
        {body}
      </main>
    </div>
  );
}

function Notice({
  tone,
  title,
  message,
  registrationNumber,
}: {
  tone: 'success' | 'closed';
  title: string;
  message: string;
  registrationNumber?: string;
}) {
  return (
    <div className="flex justify-center">
      <div className="panel p-8 text-center max-w-lg w-full">
        {tone === 'success' && (
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        )}
        <h2
          className="text-2xl font-bold mb-4"
          style={{
            color: 'var(--ink)',
            fontFamily: 'var(--font-poppins),sans-serif',
          }}
        >
          {title}
        </h2>
        <p style={{ color: 'var(--muted)' }}>{message}</p>
        {registrationNumber && (
          <div
            className="mt-6 p-4 rounded-lg border"
            style={{
              background: 'rgba(91,185,210,0.1)',
              borderColor: 'rgba(91,185,210,0.4)',
            }}
          >
            <p
              className="text-xs uppercase tracking-wide font-semibold"
              style={{ color: 'var(--sky2)' }}
            >
              Registration number
            </p>
            <p
              className="text-2xl font-bold font-mono mt-1"
              style={{ color: 'var(--ink)' }}
            >
              {registrationNumber}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              Keep this for check-in.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
