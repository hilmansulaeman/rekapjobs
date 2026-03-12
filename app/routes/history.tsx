import {
  data,
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
} from 'react-router';
import type { Route } from './+types/history';
import { useMemo, useState } from 'react';
import { requireAuth } from '~/lib/auth.server';
import { getAllApplications } from '~/lib/sheets.server';
import type { JobApplication } from '~/lib/types';
import { ExpenseCard } from '~/components/expense-card';
import { PROGRESS_OPTIONS } from '~/lib/constants';

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request);

  try {
    const rows = await getAllApplications(user.spreadsheetId, 200);
    const entries: JobApplication[] = rows.map((row) => ({
      timestamp: row[0] ?? '',
      role: row[1] ?? '',
      status: row[2] ?? '',
      company: row[3] ?? '',
      dateApplying: row[4] ?? '',
      appliedVia: row[5] ?? '',
      linkJobs: row[6] ?? '',
      progress: row[7] ?? '',
      event: row[8] ?? '',
    }));

    return data({ entries });
  } catch {
    return data({
      entries: [] as JobApplication[],
      error: 'Failed to load applications',
    });
  }
}

export default function History() {
  const loaderData = useLoaderData<typeof loader>();
  const entries = loaderData.entries as JobApplication[];
  const error = 'error' in loaderData ? String(loaderData.error) : '';
  const [progressFilter, setProgressFilter] = useState('All');

  const filtered = useMemo(() => {
    if (progressFilter === 'All') return entries;
    return entries.filter((entry) => entry.progress === progressFilter);
  }, [entries, progressFilter]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col bg-white">
      <header className="px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-2">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Application History
        </h1>
        <p className="text-sm text-slate-500">Latest {entries.length} records</p>
      </header>

      <div className="flex flex-wrap gap-2 px-4 pb-2">
        {['All', ...PROGRESS_OPTIONS].map((progress) => (
          <button
            key={progress}
            onClick={() => setProgressFilter(progress)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              progressFilter === progress
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {progress}
          </button>
        ))}
      </div>

      {error && <p className="px-4 text-sm text-red-600">{error}</p>}

      {filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-slate-500">
          No application data found for this filter.
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-4 pb-4 pt-2">
          {filtered.map((entry, i) => (
            <ExpenseCard key={`${entry.timestamp}-${entry.company}-${i}`} entry={entry} />
          ))}
        </div>
      )}
    </main>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? error.statusText || 'Something went wrong'
    : error instanceof Error
      ? error.message
      : 'Something went wrong';

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center bg-white px-6 text-center">
      <h1 className="text-xl font-bold text-slate-900">Something went wrong</h1>
      <p className="mt-2 text-sm text-slate-500">{message}</p>
      <a href="/" className="mt-6 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white">
        Go home
      </a>
    </main>
  );
}
