'use client';

import { useEffect, useRef } from 'react';
import {
  showEmbeddedCheckout,
  loadCheckoutScript,
  PaymentSession,
} from '@/lib/payment';

interface PaymentModalProps {
  session: PaymentSession;
  amount: number;
  currency: string;
  categoryName: string;
  customerEmail: string;
  onClose: () => void;
  isOpen: boolean;
}

export default function PaymentModal({
  session,
  amount,
  currency,
  categoryName,
  customerEmail,
  onClose,
  isOpen,
}: PaymentModalProps) {
  const paymentContainerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    const container = paymentContainerRef.current;

    if (isOpen && !initialized.current && session.sessionId) {
      initialized.current = true;
      loadCheckoutScript()
        .then(() => {
          // Checkout.js needs the target node to be in the DOM already.
          setTimeout(() => {
            try {
              showEmbeddedCheckout(
                session.sessionId,
                '#mastercard-payment-container',
              );
            } catch (error) {
              console.error('Failed to show embedded checkout:', error);
            }
          }, 100);
        })
        .catch((error) =>
          console.error('Failed to load Checkout script:', error),
        );
    }

    return () => {
      // Clear the gateway's injected iframe so a re-open starts clean.
      if (container) container.innerHTML = '';
    };
  }, [isOpen, session.sessionId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{
            background: 'linear-gradient(to right, var(--red2), var(--red))',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            </div>
            <div>
              <h2
                className="text-xl font-bold text-white"
                style={{ fontFamily: 'var(--font-poppins),sans-serif' }}
              >
                Secure Payment
              </h2>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>
                Powered by Mastercard
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div
          className="px-6 py-4 border-b"
          style={{ background: 'var(--light)', borderColor: 'var(--border)' }}
        >
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p style={{ color: 'var(--muted)' }} className="mb-1">
                Amount
              </p>
              <p
                className="text-2xl font-bold"
                style={{ color: 'var(--red)' }}
              >
                {currency} {amount.toLocaleString()}
              </p>
            </div>
            <div>
              <p style={{ color: 'var(--muted)' }} className="mb-1">
                Category
              </p>
              <p className="font-semibold" style={{ color: 'var(--text)' }}>
                {categoryName}
              </p>
            </div>
            <div className="col-span-2">
              <p style={{ color: 'var(--muted)' }} className="mb-1">
                Email
              </p>
              <p className="font-medium" style={{ color: 'var(--text)' }}>
                {customerEmail}
              </p>
            </div>
            <div className="col-span-2">
              <p style={{ color: 'var(--muted)' }} className="mb-1">
                Order ID
              </p>
              <p className="font-mono text-xs" style={{ color: 'var(--muted)' }}>
                {session.orderId}
              </p>
            </div>
          </div>
        </div>

        <div
          className="p-6 bg-white overflow-y-auto"
          style={{ maxHeight: '500px' }}
        >
          <div
            id="mastercard-payment-container"
            ref={paymentContainerRef}
            className="min-h-[400px]"
          />
        </div>

        <div
          className="px-6 py-4 border-t"
          style={{ background: 'var(--light)', borderColor: 'var(--border)' }}
        >
          <div
            className="flex items-start gap-2 text-xs"
            style={{ color: 'var(--muted)' }}
          >
            <svg
              className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
            <p>
              Your payment is secured with industry-standard encryption. Card
              details are never stored on our servers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
