import {
  createCookie,
  createCookieSessionStorage,
  redirect,
} from 'react-router';

export type SessionUser = {
  email: string;
  name: string;
  picture?: string;
  spreadsheetId: string;
  spreadsheetUrl?: string;
};

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: 'duitlog_session',
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
    sameSite: 'lax',
    secrets: [process.env.SESSION_SECRET!],
    secure: process.env.NODE_ENV === 'production'
  }
});

const oauthStateCookie = createCookie('duitlog_oauth_state', {
  httpOnly: true,
  maxAge: 60 * 10,
  path: '/',
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
});

type PendingGoogleProfile = {
  email: string;
  name: string;
  picture?: string;
};

const pendingGoogleProfileCookie = createCookie('duitlog_pending_google_profile', {
  httpOnly: true,
  maxAge: 60 * 10,
  path: '/',
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  secrets: [process.env.SESSION_SECRET!],
});

function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch?.[1]) return urlMatch[1];

  const rawMatch = trimmed.match(/^[a-zA-Z0-9-_]{20,}$/);
  if (rawMatch) return trimmed;

  return '';
}

function getSpreadsheetOverrideId(): string | null {
  const raw = process.env.GOOGLE_SPREADSHEET_ID?.trim();
  if (!raw) return null;

  const parsed = extractSpreadsheetId(raw);
  return parsed || null;
}

function getSession(request: Request) {
  return sessionStorage.getSession(request.headers.get('Cookie'));
}

export function isAllowedGoogleAccount(email: string) {
  const allowedEmails = (process.env.ALLOWED_GOOGLE_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const allowedDomain = (process.env.ALLOWED_GOOGLE_DOMAIN ?? '')
    .trim()
    .toLowerCase();

  const normalizedEmail = email.trim().toLowerCase();
  if (allowedEmails.length > 0) {
    return allowedEmails.includes(normalizedEmail);
  }

  if (allowedDomain) {
    return normalizedEmail.endsWith(`@${allowedDomain}`);
  }

  return true;
}

function readSessionUser(session: Awaited<ReturnType<typeof getSession>>): SessionUser | null {
  if (session.get('authenticated') !== true) {
    return null;
  }

  const email = session.get('user_email');
  const name = session.get('user_name');
  const spreadsheetId = session.get('user_spreadsheet_id');

  if (
    typeof email !== 'string' ||
    typeof name !== 'string' ||
    typeof spreadsheetId !== 'string'
  ) {
    return null;
  }

  const picture = session.get('user_picture');
  const spreadsheetUrl = session.get('user_spreadsheet_url');
  const overrideSpreadsheetId = getSpreadsheetOverrideId();
  const effectiveSpreadsheetId = overrideSpreadsheetId ?? spreadsheetId;
  const effectiveSpreadsheetUrl = overrideSpreadsheetId
    ? `https://docs.google.com/spreadsheets/d/${overrideSpreadsheetId}/edit`
    : (typeof spreadsheetUrl === 'string' ? spreadsheetUrl : undefined);

  return {
    email,
    name,
    spreadsheetId: effectiveSpreadsheetId,
    picture: typeof picture === 'string' ? picture : undefined,
    spreadsheetUrl: effectiveSpreadsheetUrl,
  };
}

export async function createUserSession(
  request: Request,
  user: SessionUser,
): Promise<Response> {
  const overrideSpreadsheetId = getSpreadsheetOverrideId();
  const effectiveSpreadsheetId = overrideSpreadsheetId ?? user.spreadsheetId;
  const effectiveSpreadsheetUrl = overrideSpreadsheetId
    ? `https://docs.google.com/spreadsheets/d/${overrideSpreadsheetId}/edit`
    : (user.spreadsheetUrl ?? '');

  const session = await getSession(request);
  session.set('authenticated', true);
  session.set('user_email', user.email);
  session.set('user_name', user.name);
  session.set('user_picture', user.picture ?? '');
  session.set('user_spreadsheet_id', effectiveSpreadsheetId);
  session.set('user_spreadsheet_url', effectiveSpreadsheetUrl);

  return redirect('/', {
    headers: { 'Set-Cookie': await sessionStorage.commitSession(session) },
  });
}

export async function serializeOAuthStateCookie(state: string) {
  return oauthStateCookie.serialize(state);
}

export async function readOAuthState(request: Request): Promise<string | null> {
  const parsed = await oauthStateCookie.parse(request.headers.get('Cookie'));
  return typeof parsed === 'string' ? parsed : null;
}

export async function clearOAuthStateCookie() {
  return oauthStateCookie.serialize('', { maxAge: 0 });
}

export async function serializePendingGoogleProfileCookie(
  profile: PendingGoogleProfile,
) {
  return pendingGoogleProfileCookie.serialize(profile);
}

export async function readPendingGoogleProfile(
  request: Request,
): Promise<PendingGoogleProfile | null> {
  const parsed = await pendingGoogleProfileCookie.parse(
    request.headers.get('Cookie'),
  );
  if (!parsed || typeof parsed !== 'object') return null;

  const email = (parsed as Record<string, unknown>).email;
  const name = (parsed as Record<string, unknown>).name;
  const picture = (parsed as Record<string, unknown>).picture;

  if (typeof email !== 'string' || typeof name !== 'string') return null;
  return {
    email,
    name,
    picture: typeof picture === 'string' ? picture : undefined,
  };
}

export async function clearPendingGoogleProfileCookie() {
  return pendingGoogleProfileCookie.serialize('', { maxAge: 0 });
}

export async function destroyUserSession(request: Request) {
  const session = await getSession(request);
  return redirect('/login', {
    headers: { 'Set-Cookie': await sessionStorage.destroySession(session) },
  });
}

export async function requireAuth(request: Request): Promise<SessionUser> {
  const session = await getSession(request);
  const user = readSessionUser(session);
  if (!user) {
    throw redirect('/login');
  }
  return user;
}

export async function isAuthenticated(request: Request): Promise<boolean> {
  const session = await getSession(request);
  return readSessionUser(session) !== null;
}

export async function getOptionalUser(
  request: Request,
): Promise<SessionUser | null> {
  const session = await getSession(request);
  return readSessionUser(session);
}
