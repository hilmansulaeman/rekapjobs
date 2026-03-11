import { redirect } from 'react-router';
import type { Route } from './+types/auth.google.callback';
import {
  clearOAuthStateCookie,
  createUserSession,
  isAllowedGoogleAccount,
  serializePendingGoogleProfileCookie,
  readOAuthState,
} from '~/lib/auth.server';
import {
  getGoogleProfileFromCode,
  getOAuthRedirectUriForRequest,
} from '~/lib/google.server';
import { log } from '~/lib/logger.server';
import { getProvisionedUserByEmail } from '~/lib/user-spreadsheets.server';

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
      getOAuthRedirectUriForRequest(request.url),
    );

    if (!isAllowedGoogleAccount(profile.email)) {
      log('warn', 'google_login_blocked', { email: profile.email });
      throw redirectToLogin('unauthorized_account');
    }

    const user = await getProvisionedUserByEmail(profile);

    if (!user) {
      throw redirect('/onboarding/spreadsheet', {
        headers: {
          'Set-Cookie': await serializePendingGoogleProfileCookie(profile),
        },
      });
    }

    const response = await createUserSession(request, user);
    response.headers.append('Set-Cookie', clearCookie);
    return response;
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    const rawMessage = (error as Error).message;
    const message = rawMessage.toLowerCase();
    const mappedError =
      message.includes('failed to create user spreadsheet') ||
      message.includes('google_user_sheets_folder_id')
        ? 'user_sheet_create_permission'
        :
      message.includes('cannot access google_master_spreadsheet_id') ||
      message.includes('caller does not have permission') ||
      message.includes('permission denied')
        ? 'master_sheet_permission'
        : 'google_login_failed';

    log('error', 'google_login_failed', {
      error: rawMessage,
      mappedError,
    });

    throw redirectToLogin(mappedError);
  }
}
