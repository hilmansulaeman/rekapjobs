import { data, useLoaderData } from 'react-router';
import type { Route } from './+types/history';
import { getRecentExpenses } from '~/lib/sheets.server';
import { requireAuth } from '~/lib/auth.server';
import type { ExpenseEntry } from '~/lib/types';
import { ExpenseCard } from '~/components/expense-card';

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  try {
    const rows = await getRecentExpenses(20);
    const entries: ExpenseEntry[] = rows.map((row) => ({
      timestamp: row[0] ?? '',
      item: row[1] ?? '',
      category: row[2] ?? '',
      amount: Number(row[3]) || 0,
      method: row[4] ?? '',
      date: row[5] ?? '',
      note: row[6] ?? '',
    }));
    return data({ entries });
  } catch {
    return data({ entries: [] as ExpenseEntry[], error: 'Failed to load expenses' });
  }
}

export default function History() {
  const loaderData = useLoaderData<typeof loader>();
  const error = 'error' in loaderData ? (loaderData.error as string) : null;
  const entries = loaderData.entries as ExpenseEntry[];

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col bg-white">
      <header className="shrink-0 px-4 pt-6 pb-2">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Recent Expenses
        </h1>
      </header>

      {error && (
        <p className="px-4 text-sm text-red-600">{error}</p>
      )}

      {entries.length === 0 && !error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
          <span className="text-5xl">🧾</span>
          <p className="text-lg font-semibold text-slate-700">
            No expenses yet
          </p>
          <p className="text-sm text-slate-400">
            Start logging your expenses from the Add tab.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-4 pt-2 pb-4">
          {entries.map((entry, i) => (
            <ExpenseCard key={`${entry.timestamp}-${i}`} entry={entry} />
          ))}
        </div>
      )}
    </main>
  );
}
