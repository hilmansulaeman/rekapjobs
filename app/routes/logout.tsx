import { redirect } from 'react-router';
import type { Route } from './+types/logout';
import {
  clearOAuthStateCookie,
  clearPendingGoogleProfileCookie,
  destroyUserSession,
} from '~/lib/auth.server';

export async function action({ request }: Route.ActionArgs) {
  if (request.method.toUpperCase() !== 'POST') {
    throw redirect('/login');
  }

  const response = await destroyUserSession(request);
  response.headers.append('Set-Cookie', await clearPendingGoogleProfileCookie());
  response.headers.append('Set-Cookie', await clearOAuthStateCookie());
  return response;
}

export async function loader() {
  throw redirect('/login');
}

export default function LogoutRoute() {
  return null;
}
