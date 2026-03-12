import type { JobApplication } from '~/lib/types';

function progressColor(progress: string): string {
  const p = progress.toLowerCase();
  if (p === 'rejected') return 'bg-red-600 text-white';
  if (p === 'accepted') return 'bg-emerald-600 text-white';
  if (p === 'offered') return 'bg-indigo-600 text-white';
  if (p === 'interview') return 'bg-amber-500 text-slate-900';
  if (p === 'withdrawn') return 'bg-slate-500 text-white';
  return 'bg-blue-600 text-white';
}

export function ExpenseCard({ entry }: { entry: JobApplication }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-900">
            {entry.role}
          </h3>
          <p className="truncate text-sm text-slate-600">{entry.company}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${progressColor(entry.progress)}`}
        >
          {entry.progress}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <p><span className="font-medium text-slate-800">Status:</span> {entry.status}</p>
        <p><span className="font-medium text-slate-800">Date:</span> {entry.dateApplying}</p>
        <p className="col-span-2"><span className="font-medium text-slate-800">Via:</span> {entry.appliedVia}</p>
      </div>

      {entry.linkJobs && (
        <a
          href={entry.linkJobs}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-xs font-medium text-blue-700 underline underline-offset-2"
        >
          Open Job Link
        </a>
      )}

      {entry.event && (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
          {entry.event}
        </p>
      )}
    </article>
  );
}
