// Media self-registration at /media. It uses SmartEvent's MEDIA category and
// closes itself at the deadline below: the page checks the time on every
// request, and the SmartEvent proxy refuses MEDIA registrations after it.

export const MEDIA_CATEGORY_ID = 213;

// Sunday 29 November 2026, 08:00 Kigali time (UTC+2).
export const MEDIA_DEADLINE = new Date('2026-11-29T08:00:00+02:00');

export function mediaRegistrationOpen(now: number = Date.now()): boolean {
  return now < MEDIA_DEADLINE.getTime();
}
