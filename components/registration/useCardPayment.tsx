'use client';

import { useRef, useState } from 'react';
import PaymentModal from '@/components/PaymentModal';
import {
  initializePayment,
  processPayment,
  type PaymentConfig,
  type PaymentResult,
  type PaymentSession,
} from '@/lib/payment';

// Opens the Mastercard embedded checkout for a registration fee and resolves
// with the gateway's result. Render `modal` somewhere on the page.
export function useCardPayment() {
  const [processing, setProcessing] = useState(false);
  const [checkout, setCheckout] = useState<{
    session: PaymentSession;
    config: PaymentConfig;
  } | null>(null);
  const [open, setOpen] = useState(false);
  // Closing the modal never fires a gateway callback, so it settles the
  // pending payment itself.
  const settle = useRef<((result: PaymentResult) => void) | null>(null);

  async function pay(config: PaymentConfig): Promise<PaymentResult> {
    setProcessing(true);
    const session = await initializePayment(config);
    setProcessing(false);
    if (!session) {
      return {
        success: false,
        orderId: config.orderId,
        error: 'Failed to initialize payment. Please try again.',
      };
    }

    setCheckout({ session, config });
    setOpen(true);
    const result = await new Promise<PaymentResult>((resolve) => {
      settle.current = resolve;
      processPayment(session).then(resolve);
    });
    settle.current = null;
    setOpen(false);
    return result;
  }

  const modal = checkout && (
    <PaymentModal
      session={checkout.session}
      amount={checkout.config.amount}
      currency={checkout.config.currency}
      categoryName={checkout.config.categoryName}
      customerEmail={checkout.config.customerEmail || ''}
      isOpen={open}
      onClose={() =>
        settle.current?.({
          success: false,
          orderId: checkout.session.orderId,
          error: 'Payment cancelled by user',
        })
      }
    />
  );

  return { pay, processing, modal };
}
