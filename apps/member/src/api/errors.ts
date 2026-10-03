// Copy for the reason codes raised by the booking rules (supabase/migrations/…_booking_functions.sql
// and src/lib/booking.ts use the same codes).

const COPY: Record<string, string> = {
  started: 'This session has already started.',
  needs_herding: 'This class needs a Herding assessment first.',
  needs_social: 'This class needs a Social clearance first.',
  vaccines: 'Vaccines need to be current on the day of the session.',
  already_booked: 'Already booked for this session.',
  full: 'This class is full. Join the waitlist or pick another time.',
  credits: 'Not enough credits left this month.',
  not_found: 'This session isn\'t available any more.',
  not_your_dog: 'That dog isn\'t on your account.',
  not_signed_in: 'Sign in to book.',
  not_cancellable: 'This booking can\'t be cancelled.',
  wrong_code: 'That code doesn\'t match this session. Check the sign at the entrance.',
  wrong_session: 'That code is for a different session.',
  too_early: 'Check-in opens an hour before the start.',
  too_late: 'This session has ended.',
  not_booked: 'There\'s no booking to check in to.',
  too_soon: 'Spots can only be held until the day before a session.',
  weak_password: 'Use at least 8 characters.',
  cancelled: 'The partner cancelled this session. Pick another time.',
  waitlist_closed: 'The waitlist for this session is closed.',
  already_waiting: 'Already on the waitlist for this session.',
  not_full: 'A spot just opened. Book it now.',
  // Supabase Auth
  already_registered: 'There\'s already an account with this email. Sign in, or use Forgot password if you never set one.',
  user_already_exists: 'There\'s already an account with this email. Sign in instead.',
  over_email_send_rate_limit: 'We just sent you an email. Wait a minute before asking for another.',
  over_request_rate_limit: 'Too many tries just now. Wait a minute and try again.',
  otp_expired: 'That code is wrong or has expired. Check the latest email, or send a new code.',
  invalid_credentials: 'That email and password don\'t match.',
  email_not_confirmed: 'Confirm your email first. We\'ve sent you a new code.',
  email_address_invalid: 'That email address doesn\'t look right.',
  same_password: 'Pick a password you haven\'t used here before.',
  signup_disabled: 'New accounts are paused right now. Try again later.',
};

/** Short, human sentence for an error code or a raw error. */
export function errorCopy(e: unknown) {
  const msg = typeof e === 'string' ? e : e instanceof Error ? e.message : (e as { message?: string })?.message ?? '';
  return COPY[msg] ?? (msg || 'Something went wrong. Try again.');
}

/** Short reason used on 01j's skipped list. */
export const SHORT: Record<string, string> = {
  started: 'already started',
  needs_herding: 'needs a Herding assessment',
  needs_social: 'needs a Social clearance',
  vaccines: 'vaccines expire before then',
  already_booked: 'already booked',
  full: 'full',
  credits: 'not enough credits',
  not_found: 'not on the schedule',
  too_soon: 'too soon to hold',
  cancelled: 'cancelled by the partner',
};
