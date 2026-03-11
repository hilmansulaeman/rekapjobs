import { data, Form, useActionData, useLoaderData, useNavigation } from 'react-router';
import type { Route } from './+types/settings';
import { requireAuth } from '~/lib/auth.server';
import { customSourcesCookie } from '~/lib/cookies.server';
import { SOURCES } from '~/lib/constants';

async function getSources(cookieHeader: string | null): Promise<string[]> {
  const raw = await customSourcesCookie.parse(cookieHeader);
  return Array.isArray(raw) && raw.length > 0 ? raw : [...SOURCES];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request);
  const sources = await getSources(request.headers.get('Cookie'));
  return data({ sources, user });
}

export async function action({ request }: Route.ActionArgs) {
  await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get('intent') as string;
  let sources = await getSources(request.headers.get('Cookie'));

  if (intent === 'add') {
    const name = (formData.get('name') as string)?.trim();
    if (name && !sources.includes(name)) {
      sources = [...sources, name];
    }
  } else if (intent === 'delete') {
    const name = formData.get('name') as string;
    if (sources.length > 1) {
      sources = sources.filter((s) => s !== name);
    }
  } else if (intent === 'edit') {
    const oldName = formData.get('oldName') as string;
    const newName = (formData.get('newName') as string)?.trim();
    if (newName && !sources.includes(newName)) {
      sources = sources.map((s) => (s === oldName ? newName : s));
    }
  }

  return data(
    { ok: true, sources },
    { headers: { 'Set-Cookie': await customSourcesCookie.serialize(sources) } }
  );
}

export default function Settings() {
  const { sources, user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const displaySources = (actionData?.sources ?? sources) as string[];

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col bg-white px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-24">
      <h1 className="mb-6 text-xl font-bold tracking-tight text-slate-900">
        Settings
      </h1>

      <section className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
          Account
        </h2>
        <p className="text-sm font-semibold text-slate-900">{user.name}</p>
        <p className="text-sm text-slate-500">{user.email}</p>
        {user.spreadsheetUrl && (
          <a
            href={user.spreadsheetUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white"
          >
            Open My Spreadsheet
          </a>
        )}
      </section>

      {/* Paid From Sources */}
      <section>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
          Paid From — Nama Source
        </h2>

        <ul className="mb-4 flex flex-col gap-2">
          {displaySources.map((source) => (
            <li key={source} className="flex items-center gap-2">
              <span className="flex-1 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700">
                {source}
              </span>
              <Form method="post" className="inline-flex">
                <input type="hidden" name="intent" value="delete" />
                <input type="hidden" name="name" value={source} />
                <button
                  type="submit"
                  disabled={isSubmitting || displaySources.length <= 1}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-40"
                >
                  Hapus
                </button>
              </Form>
            </li>
          ))}
        </ul>

        {/* Add new source */}
        <Form method="post" className="flex gap-2">
          <input type="hidden" name="intent" value="add" />
          <input
            type="text"
            name="name"
            placeholder="Nama baru (e.g. Rini)"
            required
            disabled={isSubmitting}
            className="flex-1 rounded-lg border-2 border-slate-200 px-4 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-900 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:bg-slate-800 disabled:opacity-50"
          >
            Tambah
          </button>
        </Form>
        <p className="mt-2 text-xs text-slate-400">
          Minimal harus ada 1 source aktif.
        </p>
      </section>
    </main>
  );
}
