import { redirect } from 'react-router';
import type { Route } from './+types/auth.google';
import {
  isAuthenticated,
  serializeOAuthStateCookie,
} from '~/lib/auth.server';
import {
  getGoogleAuthUrl,
  getOAuthRedirectUriForRequest,
} from '~/lib/google.server';
import { log } from '~/lib/logger.server';

export async function loader({ request }: Route.LoaderArgs) {
  if (await isAuthenticated(request)) {
    throw redirect('/');
  }

  try {
    const state = crypto.randomUUID();
    const authUrl = getGoogleAuthUrl(
      state,
      getOAuthRedirectUriForRequest(request.url),
    );

    throw redirect(authUrl, {
      headers: {
        'Set-Cookie': await serializeOAuthStateCookie(state),
      },
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    const rawMessage = (error as Error).message;
    const message = rawMessage.toLowerCase();
    const mappedError =
      message.includes('missing google oauth config') ||
      message.includes('google_oauth_client_id') ||
      message.includes('google_oauth_client_secret')
        ? 'google_oauth_config'
        : 'google_login_failed';

    log('error', 'google_auth_start_failed', {
      error: rawMessage,
      mappedError,
    });

    throw redirect(`/login?error=${encodeURIComponent(mappedError)}`);
  }
}
