import type { Metadata } from 'next';
import { connection } from 'next/server';
import MediaRegistration from './MediaRegistration';
import { MEDIA_DEADLINE, mediaRegistrationOpen } from '@/lib/media';

export const metadata: Metadata = {
  title: 'Media registration',
  description:
    "Media accreditation for the 23rd East African Magistrates' and Judges' Association conference in Kigali.",
};

export default async function MediaPage() {
  // Render per request so the page closes on time instead of being cached as
  // open from build time.
  await connection();
  return (
    <MediaRegistration
      initiallyOpen={mediaRegistrationOpen()}
      deadline={MEDIA_DEADLINE.toISOString()}
    />
  );
}
