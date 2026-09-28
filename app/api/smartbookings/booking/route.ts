import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { SMARTBOOKINGS_TOKEN, smartbookingsFetch } from '@/lib/smartbookings';
import {
  BookingRequest,
  isIsoDate,
  toKigaliEpoch,
} from '@/lib/accommodation';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(b: Partial<BookingRequest>): string | null {
  const required: (keyof BookingRequest)[] = [
    'title',
    'firstName',
    'lastName',
    'email',
    'phone',
    'country',
    'paymentMethod',
    'hotelCode',
    'roomId',
  ];
  for (const key of required) {
    if (!String(b[key] ?? '').trim()) return 'Please complete all required fields.';
  }
  if (!EMAIL.test(String(b.email))) return 'Enter a valid email address.';
  if (b.bookingFor === 'someone') {
    if (!b.beneficiaryName?.trim()) return "Enter the guest's name.";
    if (!EMAIL.test(String(b.beneficiaryEmail))) {
      return "Enter a valid email address for the guest.";
    }
  }
  if (!isIsoDate(b.checkin) || !isIsoDate(b.checkout) || b.checkout <= b.checkin) {
    return 'Choose valid check-in and check-out dates.';
  }
  return null;
}

function firstString(raw: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string' || typeof value === 'number') {
      const s = String(value).trim();
      if (s) return s;
    }
  }
  return '';
}

// Submits a room booking. Field names match Smartbookings' Client-BookingForm
// exactly, including its `firs_tname` spelling.
export async function POST(request: NextRequest) {
  let body: Partial<BookingRequest>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid request.' }, { status: 400 });
  }

  const error = validate(body);
  if (error) return NextResponse.json({ message: error }, { status: 400 });
  const b = body as BookingRequest;

  const payload = {
    title: b.title,
    firs_tname: b.firstName.trim(),
    last_name: b.lastName.trim(),
    email: b.email.trim(),
    booking_for: b.bookingFor === 'someone' ? 'someone' : 'myself',
    beneficiername: b.bookingFor === 'someone' ? b.beneficiaryName.trim() : '',
    beneficieremail: b.bookingFor === 'someone' ? b.beneficiaryEmail.trim() : '',
    number_of_room: Math.max(1, Number(b.rooms) || 1),
    askquestion: b.question?.trim() ?? '',
    coming_on: `${b.checkin} 00:00:00`,
    country: b.country,
    phone: b.phone.trim(),
    payment_method: b.paymentMethod,
    reason: b.reason || 'Business',
    hotel_code: b.hotelCode,
    room_code: b.roomId,
    book_from: toKigaliEpoch(b.checkin),
    book_to: toKigaliEpoch(b.checkout),
    adult: Math.max(1, Number(b.adults) || 1),
    child: Math.max(0, Number(b.children) || 0),
    // A unique token per booking (the Postman sample uses
    // "tokenuniqueme4444"); HotelDetail doesn't issue one per room.
    token: b.roomToken || randomUUID().replace(/-/g, ''),
  };

  try {
    const { ok, status, data } = await smartbookingsFetch('Client-BookingForm', {
      method: 'POST',
      // Same event token as the HotelsList/HotelDetail URLs.
      headers: {
        'Content-Type': 'application/json',
        Authorization: SMARTBOOKINGS_TOKEN,
      },
      body: JSON.stringify(payload),
    });
    if (!ok) return NextResponse.json(data, { status });

    const raw = (data ?? {}) as Record<string, unknown>;
    return NextResponse.json({
      reference: firstString(raw, [
        'booking_code',
        'booking_id',
        'bookingcode',
        'reference',
        'code',
        'id',
      ]),
      // Client-Payments-Portal is authorised with a 40-character key, which
      // is expected back with the booking.
      paymentKey: firstString(raw, [
        'payment_token',
        'paymentkey',
        'token',
        'key',
      ]),
      message: firstString(raw, ['message', 'msg']),
    });
  } catch (err) {
    console.error('Smartbookings booking error:', err);
    return NextResponse.json(
      { message: 'Could not complete the booking. Please try again.' },
      { status: 500 },
    );
  }
}
