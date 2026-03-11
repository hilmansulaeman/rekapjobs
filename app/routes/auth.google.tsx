import { redirect } from 'react-router';
import type { Route } from './+types/auth.google';
import {
  isAuthenticated,
  serializeOAuthStateCookie,
} from '~/lib/auth.server';
import { getGoogleAuthUrl } from '~/lib/google.server';

export async function loader({ request }: Route.LoaderArgs) {
  if (await isAuthenticated(request)) {
    throw redirect('/');
  }

  const state = crypto.randomUUID();
  const authUrl = getGoogleAuthUrl(state);

  throw redirect(authUrl, {
    headers: {
      'Set-Cookie': await serializeOAuthStateCookie(state),
    },
  });
}
