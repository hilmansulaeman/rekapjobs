import {
  redirect,
  useLoaderData,
} from 'react-router';
import type { Route } from './+types/login';
import { isAuthenticated } from '~/lib/auth.server';

export async function loader({ request }: Route.LoaderArgs) {
  if (await isAuthenticated(request)) {
    throw redirect('/');
  }
  const url = new URL(request.url);
  const error = url.searchParams.get('error');
  return { error };
}

export default function Login() {
  const { error } = useLoaderData<typeof loader>();

  const errorMessage =
    error === 'invalid_google_state'
      ? 'Login session expired. Please try again.'
      : error === 'unauthorized_account'
        ? 'This Google account is not allowed to access the app.'
        : error === 'google_oauth_config'
          ? 'Google OAuth config is missing in deployment. Check GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI, and SESSION_SECRET in production env.'
          : error === 'google_oauth_redirect_mismatch'
            ? 'Google OAuth redirect URI mismatch. Add your production callback URL to Google Cloud Console and set GOOGLE_OAUTH_REDIRECT_URI to the same URL.'
      : error === 'google_login_failed'
        ? 'Google login failed. Please try again.'
        : error === 'user_sheet_create_permission'
          ? 'Google login success, but creating personal spreadsheet failed. Set GOOGLE_USER_SHEETS_FOLDER_ID to a Drive folder shared to service account as Editor.'
        : error === 'master_sheet_permission'
          ? 'Google login success, but provisioning failed: share your Master Spreadsheet to service account email (Editor access), then try again.'
        : error === 'google_oauth_cancelled'
          ? 'Google login was cancelled.'
          : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-3 text-center text-2xl font-bold tracking-tight text-slate-900">
          Job Tracker
        </h1>
        <p className="mb-6 text-center text-sm text-slate-500">
          Login with Google. On first sign-in, you will connect your own spreadsheet once.
        </p>
        {errorMessage && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-700">
            <p>{errorMessage}</p>
          </div>
        )}
        <a
          href="/auth/google"
          className="inline-flex w-full items-center justify-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path
              fill="currentColor"
              d="M21.35 11.1h-9.18v2.98h5.27c-.23 1.5-1.75 4.4-5.27 4.4-3.17 0-5.75-2.62-5.75-5.86s2.58-5.86 5.75-5.86c1.8 0 3 .77 3.69 1.43l2.51-2.43C16.78 4.19 14.7 3.2 12.17 3.2 7.11 3.2 3 7.38 3 12.52s4.11 9.32 9.17 9.32c5.29 0 8.8-3.72 8.8-8.96 0-.6-.06-1.05-.15-1.48Z"
            />
          </svg>
          Continue with Google
        </a>
      </div>
    </main>
  );
}
