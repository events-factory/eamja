import { NextRequest, NextResponse } from 'next/server';
import { SMARTEVENT_API_URL, EVENT_CODE } from '@/lib/smartevent';

// Endpoints that SmartEvent expects as multipart form data, with the event
// code carried in the body rather than a header.
const REGISTRATION_ENDPOINTS = [
  'Display-Registration-Categories',
  'Display-Categories-Form-Inputs',
  'Register-Delegate',
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyRequest(request, path, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyRequest(request, path, 'POST');
}

// Proxies browser calls to SmartEvent so the event code never reaches the
// client. The request body is rebuilt rather than streamed through, because the
// event code has to be injected and any client-supplied one dropped.
async function proxyRequest(
  request: NextRequest,
  pathSegments: string[],
  method: string,
) {
  try {
    const path = pathSegments.join('/');
    const url = `${SMARTEVENT_API_URL}/${path}`;

    const isRegistrationEndpoint = REGISTRATION_ENDPOINTS.some((endpoint) =>
      path.includes(endpoint),
    );

    const headers: Record<string, string> = {};
    if (path.includes('Registration-Page-Api')) {
      headers['Authorization'] = EVENT_CODE;
    }

    let body: FormData | URLSearchParams | string | undefined;

    if (method === 'GET') {
      headers['Content-Type'] = 'application/json';
    } else if (isRegistrationEndpoint) {
      try {
        const incomingFormData = await request.clone().formData();
        const newFormData = new FormData();
        newFormData.append('event_code', EVENT_CODE);
        incomingFormData.forEach((value, key) => {
          if (key !== 'event_code') newFormData.append(key, value);
        });
        // Content-Type is left unset so fetch adds the multipart boundary.
        body = newFormData;
      } catch {
        // Some callers send JSON instead; fall back to url-encoded form data.
        try {
          const formParams = new URLSearchParams();
          formParams.append('event_code', EVENT_CODE);
          const jsonBody = await request.json();
          Object.entries(jsonBody).forEach(([key, value]) => {
            if (key !== 'event_code') formParams.append(key, String(value));
          });
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
          body = formParams;
        } catch {
          headers['Content-Type'] = 'application/json';
        }
      }
    } else {
      headers['Content-Type'] = 'application/json';
      try {
        body = await request.text();
      } catch {
        body = undefined;
      }
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body instanceof FormData ? body : body?.toString() || undefined,
    });

    const data = await response.text();

    return new NextResponse(data, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('SmartEvent proxy error:', error);
    return NextResponse.json(
      { message: 'Proxy error', error: String(error) },
      { status: 500 },
    );
  }
}
