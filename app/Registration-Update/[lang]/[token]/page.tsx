import { redirect } from 'next/navigation';

// Mirrors SmartEvent's own invitation link,
// /Registration-Update/<lang>/<registration_update_token>, so the email
// template only needs its domain pointed at this site.
export default async function RegistrationUpdateLink({
  params,
}: {
  params: Promise<{ lang: string; token: string }>;
}) {
  const { token } = await params;
  redirect(`/registration/update?token=${encodeURIComponent(token)}`);
}
