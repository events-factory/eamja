import { NextRequest, NextResponse } from 'next/server';
import { smartbookingsFetch } from '@/lib/smartbookings';

// Mastercard gateway Smartbookings creates its checkout sessions on. Checkout.js
// must come from the same host as the session.
const GATEWAY_HOST = (
  process.env.SMARTBOOKINGS_GATEWAY_HOST || 'https://ap-gateway.mastercard.com'
).replace(/\/+$/, '');

// Opens a Mastercard checkout session for a booking. Client-Payments-Portal is
// authorised by the 40-character key returned with the booking and answers
// with a hosted-checkout session:
//   { message: "payment Initialized",
//     data: { merchant, result: "SUCCESS", "session.id", successIndicator, … } }
// The page shows it with Checkout.js (lib/payment.ts), as registration does.
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key') ?? '';
  if (!/^[a-f0-9]{16,64}$/i.test(key)) {
    return NextResponse.json({ message: 'Invalid payment link.' }, { status: 400 });
  }

  try {
    const { ok, status, data } = await smartbookingsFetch(
      'Client-Payments-Portal',
      { headers: { Authorization: key } },
    );
    if (!ok) return NextResponse.json(data, { status });

    const session = ((data as { data?: Record<string, unknown> }).data ?? {}) as Record<
      string,
      unknown
    >;
    const sessionId = String(session['session.id'] ?? '');
    const successIndicator = String(session.successIndicator ?? '');
    if (session.result !== 'SUCCESS' || !sessionId || !successIndicator) {
      return NextResponse.json(
        { message: 'Could not start the payment. Please try again.' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      sessionId,
      successIndicator,
      checkoutScriptUrl: `${GATEWAY_HOST}/static/checkout/checkout.min.js`,
    });
  } catch (error) {
    console.error('Smartbookings payment error:', error);
    return NextResponse.json(
      { message: 'Could not start the payment. Please try again.' },
      { status: 500 },
    );
  }
}
