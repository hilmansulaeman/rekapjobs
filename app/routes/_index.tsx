import { useCallback, useEffect, useState } from 'react';
import {
  data,
  isRouteErrorResponse,
  useActionData,
  useNavigation,
  useRouteError,
} from 'react-router';
import { toast } from 'sonner';
import type { Route } from './+types/_index';
import { requireAuth } from '~/lib/auth.server';
import { appendJobApplication, getJakartaTimestamp } from '~/lib/sheets.server';
import { jobApplicationSchema } from '~/lib/validation';
import { ExpenseForm } from '~/components/expense-form';
import {
  addPendingApplication,
  getPendingCount,
  registerBackgroundSync,
} from '~/lib/offline-queue';
import { isNetworkError } from '~/lib/month.server';
import { syncPendingExpenses } from '~/lib/sync';

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  return data({ ok: true });
}

type ActionData =
  | { success: true }
  | { success: false; errors: Record<string, string> }
  | { success: false; error: string; pending?: Record<string, string> };

export async function action({ request }: Route.ActionArgs) {
  const user = await requireAuth(request);
  const formData = await request.formData();

  const raw = {
    role: String(formData.get('role') ?? ''),
    status: String(formData.get('status') ?? ''),
    company: String(formData.get('company') ?? ''),
    dateApplying: String(formData.get('dateApplying') ?? ''),
    appliedVia: String(formData.get('appliedVia') ?? ''),
    linkJobs: String(formData.get('linkJobs') ?? ''),
    progress: String(formData.get('progress') ?? ''),
    event: String(formData.get('event') ?? ''),
  };

  const parsed = jobApplicationSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      if (!errors[key]) errors[key] = issue.message;
    }
    return data({ success: false as const, errors }, { status: 400 });
  }

  const d = parsed.data;
  const [year, month, day] = d.dateApplying.split('-');
  const dateApplying = `${Number(month)}/${Number(day)}/${year}`;

  const row = [
    getJakartaTimestamp(),
    d.role,
    d.status,
    d.company,
    dateApplying,
    d.appliedVia,
    d.linkJobs,
    d.progress,
    d.event,
  ];

  try {
    await appendJobApplication(user.spreadsheetId, row);
    return data({ success: true as const });
  } catch (err) {
    if (isNetworkError(err)) {
      return data({ success: false as const, error: 'offline', pending: raw });
    }
    return data(
      { success: false as const, error: 'Failed to save. Please try again.' },
      { status: 500 },
    );
  }
}

export default function Index() {
  const actionData = useActionData<typeof action>() as ActionData | undefined;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  const [formKey, setFormKey] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = useCallback(async () => {
    try {
      setPendingCount(await getPendingCount());
    } catch {
      setPendingCount(0);
    }
  }, []);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    refreshPendingCount();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshPendingCount]);

  async function handleOfflineSubmit(formData: FormData) {
    const payload = {
      role: String(formData.get('role') ?? ''),
      status: String(formData.get('status') ?? ''),
      company: String(formData.get('company') ?? ''),
      dateApplying: String(formData.get('dateApplying') ?? ''),
      appliedVia: String(formData.get('appliedVia') ?? ''),
      linkJobs: String(formData.get('linkJobs') ?? ''),
      progress: String(formData.get('progress') ?? ''),
      event: String(formData.get('event') ?? ''),
    };

    await addPendingApplication({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      formData: payload,
    });
    await registerBackgroundSync();
    await refreshPendingCount();
    toast('Saved offline. Will sync when online.');
    setFormKey((prev) => prev + 1);
  }

  useEffect(() => {
    if (!actionData) return;

    if (actionData.success) {
      toast.success('Application saved');
      setFormKey((prev) => prev + 1);
      return;
    }

    if ('pending' in actionData && actionData.pending) {
      const fd = new FormData();
      Object.entries(actionData.pending).forEach(([k, v]) => fd.set(k, v));
      handleOfflineSubmit(fd).catch(() => {
        toast.error('Failed to queue offline data.');
      });
      return;
    }

    if ('error' in actionData && actionData.error && actionData.error !== 'offline') {
      toast.error(actionData.error);
    }
  }, [actionData]);

  useEffect(() => {
    if (!isOnline || pendingCount === 0) return;
    syncPendingExpenses()
      .then(() => refreshPendingCount())
      .catch(() => undefined);
  }, [isOnline, pendingCount, refreshPendingCount]);

  const errors =
    actionData && !actionData.success && 'errors' in actionData
      ? actionData.errors
      : undefined;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col bg-white">
      <header className="px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-2">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Job Tracker
        </h1>
        <p className="text-sm text-slate-500">Track every job application in one place</p>
      </header>

      {!isOnline && (
        <div className="mx-4 mb-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
          You are offline. Entries will be queued and synced later.
        </div>
      )}

      {pendingCount > 0 && (
        <div className="mx-4 mb-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-center text-sm text-blue-800">
          {pendingCount} pending application{pendingCount > 1 ? 's' : ''}
        </div>
      )}

      <ExpenseForm
        key={formKey}
        errors={errors}
        isSubmitting={isSubmitting}
        isOnline={isOnline}
        onOfflineSubmit={handleOfflineSubmit}
      />
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
