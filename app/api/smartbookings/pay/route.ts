import { NextRequest, NextResponse } from 'next/server';
import { smartbookingsFetch } from '@/lib/smartbookings';

// Mastercard gateways Smartbookings may create sessions on: live first, then
// test (its current merchant, TESTBOK000012, is on the test gateway). A session
// only exists on the host that created it, and Checkout.js must come from that
// host, so each session is looked up rather than the host being configured.
const GATEWAY_HOSTS = (
  process.env.SMARTBOOKINGS_GATEWAY_HOSTS ||
  'https://ap-gateway.mastercard.com,https://test-gateway.mastercard.com'
)
  .split(',')
  .map((h) => h.trim().replace(/\/+$/, ''))
  .filter(Boolean);

async function findGateway(sessionId: string): Promise<string | null> {
  const found = await Promise.all(
    GATEWAY_HOSTS.map(async (host) => {
      try {
        const res = await fetch(
          `${host}/checkout/api/retrieveWsapiVersion/${encodeURIComponent(sessionId)}`,
          { cache: 'no-store' },
        );
        const data = (await res.json()) as { wsapiVersion?: string };
        return data.wsapiVersion ? host : null;
      } catch {
        return null;
      }
    }),
  );
  return found.find(Boolean) ?? null;
}

// Opens a Mastercard checkout session for a booking. Client-Payments-Portal is
// authorised by the 40-character key returned with the booking and answers
// with a hosted-checkout session:
//   { message: "payment Initialized",
//     data: { merchant, result: "SUCCESS", "session.id", successIndicator, … } }
// The page shows it with Checkout.js (lib/payment.ts), as registration does,
// loaded from the gateway that holds the session.
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

    const gateway = await findGateway(sessionId);
    if (!gateway) {
      return NextResponse.json(
        { message: 'Could not start the payment. Please try again.' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      sessionId,
      successIndicator,
      checkoutScriptUrl: `${gateway}/static/checkout/checkout.min.js`,
    });
  } catch (error) {
    console.error('Smartbookings payment error:', error);
    return NextResponse.json(
      { message: 'Could not start the payment. Please try again.' },
      { status: 500 },
    );
  }
}
