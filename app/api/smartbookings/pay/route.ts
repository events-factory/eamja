import { NextRequest, NextResponse } from 'next/server';
import { SMARTBOOKINGS_API_URL } from '@/lib/smartbookings';

// Opens the Smartbookings payment portal for a booking. The portal is
// authorised by an `Authorization` header, which a plain browser navigation
// can't send, so the request is made here and the result handed back: a
// redirect when the portal answers with a checkout URL, or the portal page
// itself otherwise.
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key') ?? '';
  if (!/^[a-f0-9]{16,64}$/i.test(key)) {
    return NextResponse.json({ message: 'Invalid payment link.' }, { status: 400 });
  }

  try {
    const response = await fetch(`${SMARTBOOKINGS_API_URL}/Client-Payments-Portal`, {
      headers: { Authorization: key },
      cache: 'no-store',
      redirect: 'manual',
    });

    const location = response.headers.get('location');
    if (location) {
      return NextResponse.redirect(new URL(location, SMARTBOOKINGS_API_URL));
    }

    const text = await response.text();
    try {
      const data = JSON.parse(text) as Record<string, unknown>;
      const url = ['url', 'payment_url', 'checkout_url', 'link', 'redirect']
        .map((k) => data[k])
        .find((v): v is string => typeof v === 'string' && /^https?:\/\//.test(v));
      if (url) return NextResponse.redirect(url);
      return NextResponse.json(data, { status: response.status });
    } catch {
      // An HTML portal: its relative assets resolve against Smartbookings'
      // own <base href="/views/">, which has to point back at their host.
      const html = text.replace(
        /<base href="\/views\/">/i,
        `<base href="${SMARTBOOKINGS_API_URL}/views/">`,
      );
      return new NextResponse(html, {
        status: response.status,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
  } catch (error) {
    console.error('Smartbookings payment error:', error);
    return NextResponse.json(
      { message: 'Could not open the payment page. Please try again.' },
      { status: 500 },
    );
  }
}
