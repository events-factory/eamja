declare global {
  interface Window {
    Checkout?: {
      configure: (config: unknown) => void;
      showEmbeddedPage: (target: string) => void;
    };
    completeCallback?: (result: {
      resultIndicator: string;
      sessionId: string;
      status: string;
    }) => void;
    errorCallback?: (error: { 'error.explanation'?: string }) => void;
    cancelCallback?: () => void;
  }
}

const GATEWAY_SCRIPT_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL_JS ||
  'https://ap-gateway.mastercard.com/static/checkout/checkout.min.js';

export interface PaymentConfig {
  orderId: string;
  amount: number;
  currency: string;
  categoryName: string;
  categoryId?: number;
  attendenceType?: string;
  customerEmail?: string;
  customerName?: string;
}

export interface PaymentSession {
  sessionId: string;
  token: string;
  orderId: string;
}

export interface PaymentResult {
  success: boolean;
  orderId: string;
  transactionId?: string;
  paymentToken?: string;
  paymentSession?: string;
  error?: string;
}

export async function initializePayment(
  config: PaymentConfig,
): Promise<PaymentSession | null> {
  try {
    const response = await fetch('/api/smartevent/Initialize-Payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: config.amount,
        currency: config.currency,
        category_name: config.categoryName,
        category_id: config.categoryId,
        attendence_type: config.attendenceType || 'PHYSICAL',
        customer_email: config.customerEmail,
        customer_name: config.customerName,
        order_id: config.orderId,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const sessionData = data.data || data;
    const sessionId =
      sessionData.payment_session || sessionData.session_id || data.session_id;
    const token =
      sessionData.token ||
      sessionData.payment_token ||
      data.payment_token ||
      sessionData.successIndicator;
    const orderId =
      sessionData.orderId ||
      sessionData.order_id ||
      data.order_id ||
      config.orderId;

    if (!sessionId || !token) return null;

    return { sessionId, token, orderId };
  } catch {
    return null;
  }
}

export async function loadCheckoutScript(): Promise<void> {
  if (window.Checkout) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GATEWAY_SCRIPT_URL;
    script.setAttribute('data-error', 'errorCallback');
    script.setAttribute('data-cancel', 'cancelCallback');
    script.setAttribute('data-complete', 'completeCallback');
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error('Failed to load Mastercard Checkout script'));
    document.head.appendChild(script);
  });
}

export function showEmbeddedCheckout(
  sessionId: string,
  targetElement = '#payment-container',
): void {
  if (!window.Checkout) throw new Error('Checkout.js not loaded');

  window.Checkout.configure({ session: { id: sessionId } });
  window.Checkout.showEmbeddedPage(targetElement);
}

// Resolves once the gateway reports back through one of its three global
// callbacks. The embedded checkout itself is rendered by PaymentModal.
export async function processPayment(
  session: PaymentSession,
): Promise<PaymentResult> {
  return new Promise((resolve) => {
    const cleanup = () => {
      delete window.completeCallback;
      delete window.errorCallback;
      delete window.cancelCallback;
    };

    loadCheckoutScript()
      .then(() => {
        window.completeCallback = (result) => {
          if (result.resultIndicator === session.token) {
            resolve({
              success: true,
              orderId: session.orderId,
              transactionId: result.resultIndicator,
              paymentToken: session.token,
              paymentSession: session.sessionId,
            });
          } else {
            resolve({
              success: false,
              orderId: session.orderId,
              error: 'Payment verification failed',
            });
          }
          cleanup();
        };

        window.errorCallback = (error) => {
          resolve({
            success: false,
            orderId: session.orderId,
            error: error?.['error.explanation'] || 'Payment processing failed',
          });
          cleanup();
        };

        window.cancelCallback = () => {
          resolve({
            success: false,
            orderId: session.orderId,
            error: 'Payment cancelled by user',
          });
          cleanup();
        };
      })
      .catch((error) => {
        resolve({
          success: false,
          orderId: session.orderId,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to load payment gateway',
        });
      });
  });
}

// SmartEvent returns fees as display strings such as "USD 100".
export function parseFeeAmount(feeString: string): number {
  const match = feeString.match(/[\d,]+\.?\d*/);
  if (match) return parseFloat(match[0].replace(/,/g, ''));
  return 0;
}

export function requiresPayment(categoryFee: string): boolean {
  const normalized = categoryFee.toUpperCase();
  return (
    !normalized.includes('FREE') &&
    !normalized.includes('$0') &&
    !normalized.includes('0.00') &&
    parseFeeAmount(categoryFee) > 0
  );
}

export function extractCurrency(feeString: string): string {
  const match = feeString.match(/[A-Z]{3}/);
  return match ? match[0] : 'USD';
}
