import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';

export const sessionOptions = {
  password: process.env.SESSION_SECRET || 'cr_local_secret_change_me_32chars!!',
  cookieName: 'cr_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60,
    sameSite: 'lax',
  },
};

export function getSession() {
  return getIronSession(cookies(), sessionOptions);
}
