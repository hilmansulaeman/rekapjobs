import { data, Form, redirect, useActionData, useLoaderData, useNavigation } from 'react-router';
import type { Route } from './+types/onboarding.spreadsheet';
import {
  clearPendingGoogleProfileCookie,
  createUserSession,
  isAllowedGoogleAccount,
  readPendingGoogleProfile,
} from '~/lib/auth.server';
import { linkSpreadsheetForUser } from '~/lib/user-spreadsheets.server';

export async function loader({ request }: Route.LoaderArgs) {
  const profile = await readPendingGoogleProfile(request);
  if (!profile) {
    throw redirect('/login');
  }

  if (!isAllowedGoogleAccount(profile.email)) {
    throw redirect('/login?error=unauthorized_account', {
      headers: {
        'Set-Cookie': await clearPendingGoogleProfileCookie(),
      },
    });
  }

  return data({
    email: profile.email,
    serviceAccountEmail:
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? 'service-account@email',
  });
}

export async function action({ request }: Route.ActionArgs) {
  const profile = await readPendingGoogleProfile(request);
  if (!profile) {
    throw redirect('/login');
  }

  if (!isAllowedGoogleAccount(profile.email)) {
    throw redirect('/login?error=unauthorized_account', {
      headers: {
        'Set-Cookie': await clearPendingGoogleProfileCookie(),
      },
    });
  }

  const formData = await request.formData();
  const spreadsheetInput = (formData.get('spreadsheetId') as string | null)?.trim() ?? '';

  if (!spreadsheetInput) {
    return data(
      { error: 'Spreadsheet ID / URL is required.' },
      { status: 400 },
    );
  }

  try {
    const user = await linkSpreadsheetForUser(profile, spreadsheetInput);
    const response = await createUserSession(request, user);
    response.headers.append('Set-Cookie', await clearPendingGoogleProfileCookie());
    return response;
  } catch (error) {
    return data(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}

export default function SpreadsheetOnboarding() {
  const { email, serviceAccountEmail } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as
    | { error?: string }
    | undefined;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col bg-white px-4 py-6">
      <h1 className="mb-2 text-xl font-bold tracking-tight text-slate-900">
        Setup Spreadsheet
      </h1>
      <p className="mb-5 text-sm text-slate-600">
        Welcome <span className="font-medium text-slate-800">{email}</span>. Paste your spreadsheet URL or ID.
      </p>

      <ol className="mb-5 list-decimal space-y-2 pl-5 text-sm text-slate-600">
        <li>Create a Google Spreadsheet in your account.</li>
        <li>
          Share it as <span className="font-semibold text-slate-800">Editor</span> to:
          <div className="mt-1 rounded-md bg-slate-100 px-2 py-1 text-xs break-all text-slate-800">
            {serviceAccountEmail}
          </div>
        </li>
        <li>Paste the spreadsheet URL/ID below, then continue.</li>
      </ol>

      <Form method="post" className="space-y-3">
        <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
          Spreadsheet URL or ID
        </label>
        <input
          type="text"
          name="spreadsheetId"
          required
          disabled={isSubmitting}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-900 disabled:opacity-50"
        />

        {actionData?.error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 break-words">
            {actionData.error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : 'Continue'}
        </button>
      </Form>
    </main>
  );
}
