import { redirect } from 'react-router';
import type { Route } from './+types/auth.google.callback';
import {
  clearOAuthStateCookie,
  createUserSession,
  readOAuthState,
} from '~/lib/auth.server';
import {
  buildGoogleRedirectUri,
  getGoogleProfileFromCode,
} from '~/lib/google.server';
import { log } from '~/lib/logger.server';
import { getOrCreateProvisionedUser } from '~/lib/user-spreadsheets.server';

function redirectToLogin(error: string) {
  return redirect(`/login?error=${encodeURIComponent(error)}`);
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const cookieState = await readOAuthState(request);
  const clearCookie = await clearOAuthStateCookie();

  if (!state || !code || !cookieState || state !== cookieState) {
    throw redirect(`/login?error=${encodeURIComponent('invalid_google_state')}`, {
      headers: { 'Set-Cookie': clearCookie },
    });
  }

  try {
    const profile = await getGoogleProfileFromCode(
      code,
      buildGoogleRedirectUri(request.url),
    );
    const user = await getOrCreateProvisionedUser(profile);
    const response = await createUserSession(request, user);
    response.headers.append('Set-Cookie', clearCookie);
    return response;
  } catch (error) {
    log('error', 'google_login_failed', {
      error: (error as Error).message,
    });

    throw redirectToLogin('google_login_failed');
  }
}
