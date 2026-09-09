import { NextRequest, NextResponse } from 'next/server';
import { SMARTEVENT_API_URL } from '@/lib/smartevent';

// Opens a Mastercard hosted-checkout session through SmartEvent. The browser
// only ever sees the session id and token, which is what Checkout.js needs.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      order_id,
      amount,
      currency,
      category_name,
      category_id,
      customer_email,
      customer_name,
      attendence_type = 'PHYSICAL',
    } = body;

    if (!amount || !currency) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing required fields: amount, currency',
        },
        { status: 400 },
      );
    }

    const formData = new URLSearchParams();
    formData.append('application', 'registration');
    formData.append('category', String(category_id || ''));
    formData.append('attendence', attendence_type);
    if (order_id) formData.append('order_id', order_id);
    formData.append('amount', String(amount));
    formData.append('currency', currency);
    if (category_name) formData.append('category_name', category_name);
    if (customer_email) formData.append('customer_email', customer_email);
    if (customer_name) formData.append('customer_name', customer_name);

    const backendResponse = await fetch(
      `${SMARTEVENT_API_URL}/Initiate-Gateway-Session`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      },
    );

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to create payment session',
          error: errorText,
        },
        { status: backendResponse.status },
      );
    }

    const backendData = await backendResponse.json();
    const sessionData = backendData.data || backendData;
    const sessionId = sessionData.payment_session || sessionData.session_id;
    const token =
      sessionData.token ||
      sessionData.payment_token ||
      sessionData.successIndicator;

    if (!sessionId || !token) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid payment session response',
          data: backendData,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        result: 'SUCCESS',
        payment_session: sessionId,
        token,
        orderId: sessionData.orderId || order_id,
      },
      session_id: sessionId,
      payment_token: token,
      order_id: sessionData.orderId || order_id,
      amount,
      currency,
      category_name,
      customer_email,
      customer_name,
      message: 'Payment session initialized successfully',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to initialize payment session',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { success: false, message: 'Method not allowed. Use POST.' },
    { status: 405 },
  );
}
