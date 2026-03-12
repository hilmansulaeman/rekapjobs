import { data, useLoaderData } from 'react-router';
import type { Route } from './+types/recap';
import { requireAuth } from '~/lib/auth.server';
import { getAllApplications, getApplicationStats } from '~/lib/sheets.server';

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request);
  const [stats, rows] = await Promise.all([
    getApplicationStats(user.spreadsheetId),
    getAllApplications(user.spreadsheetId, 300),
  ]);

  const byCompany = new Map<string, number>();
  for (const row of rows) {
    const company = row[3] ?? 'Unknown';
    byCompany.set(company, (byCompany.get(company) ?? 0) + 1);
  }

  const topCompanies = [...byCompany.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([company, count]) => ({ company, count }));

  return data({ stats, topCompanies });
}

export default function Recap() {
  const { stats, topCompanies } = useLoaderData<typeof loader>();

  const statCards = [
    { label: 'Total Applied', value: stats.total ?? 0 },
    { label: 'Interview', value: stats.interview ?? 0 },
    { label: 'Offered', value: stats.offered ?? 0 },
    { label: 'Accepted', value: stats.accepted ?? 0 },
    { label: 'Rejected', value: stats.rejected ?? 0 },
    { label: 'Withdrawn', value: stats.withdrawn ?? 0 },
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col bg-white px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-24">
      <h1 className="mb-4 text-xl font-bold tracking-tight text-slate-900">
        Application Stats
      </h1>

      <section className="grid grid-cols-2 gap-3">
        {statCards.map((item) => (
          <article key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{item.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{item.value}</p>
          </article>
        ))}
      </section>

      <section className="mt-5 rounded-xl border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Top Companies Applied</h2>
        {topCompanies.length === 0 ? (
          <p className="text-xs text-slate-500">No data yet.</p>
        ) : (
          <div className="space-y-2">
            {topCompanies.map((item) => (
              <div key={item.company} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="truncate text-slate-700">{item.company}</span>
                <span className="font-semibold text-slate-900">{item.count}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
