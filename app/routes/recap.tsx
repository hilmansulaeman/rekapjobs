import { useMemo } from 'react';
import {
  data,
  Form,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';
import type { Route } from './+types/recap';
import { requireAuth } from '~/lib/auth.server';
import {
  getExpenseTotalByMonth,
  getLatestRecapRowByMonth,
  upsertRecapByMonth,
} from '~/lib/sheets.server';

type RecapRow = {
  timestamp: string;
  month: string;
  income: number;
  expense: number;
  savings: number;
  total: number;
};

function parseAmount(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return 0;

  const normalized = raw.replace(/[^\d-]/g, '');
  if (!normalized || normalized === '-') return 0;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getCurrentMonth() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  return y && m ? `${y}-${m}` : '';
}

function toPositiveNumber(raw: FormDataEntryValue | null) {
  const value = String(raw ?? '').replace(/,/g, '').trim();
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : NaN;
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request);
  const url = new URL(request.url);
  const month = url.searchParams.get('month') ?? getCurrentMonth();

  const savedRow = await getLatestRecapRowByMonth(user.spreadsheetId, month);
  const expenseTotal = await getExpenseTotalByMonth(user.spreadsheetId, month);
  const savedEntry: RecapRow | null = savedRow
    ? {
        timestamp: savedRow.values[0] ?? '',
        month: savedRow.values[1] ?? month,
        income: parseAmount(savedRow.values[2]),
        expense: expenseTotal,
        savings: parseAmount(savedRow.values[4]),
        total:
          parseAmount(savedRow.values[2]) - expenseTotal - parseAmount(savedRow.values[4]),
      }
    : null;

  return data({ month, savedEntry, expenseTotal });
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireAuth(request);
  const formData = await request.formData();

  const month = String(formData.get('month') ?? '').trim();
  const income = toPositiveNumber(formData.get('income'));
  const savings = toPositiveNumber(formData.get('savings'));

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return data({ success: false as const, error: 'Month is invalid.' }, { status: 400 });
  }

  if (Number.isNaN(income) || Number.isNaN(savings)) {
    return data({ success: false as const, error: 'Income and savings must be valid numbers.' }, { status: 400 });
  }

  const expense = await getExpenseTotalByMonth(user.spreadsheetId, month);
  const total = income - expense - savings;
  const now = new Date();
  const jakartaDate = new Date(
    now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }),
  );
  const timestamp = `${jakartaDate.getMonth() + 1}/${jakartaDate.getDate()}/${jakartaDate.getFullYear()} ${String(jakartaDate.getHours()).padStart(2, '0')}:${String(jakartaDate.getMinutes()).padStart(2, '0')}:${String(jakartaDate.getSeconds()).padStart(2, '0')}`;

  await upsertRecapByMonth(user.spreadsheetId, month, [
    timestamp,
    month,
    String(income),
    String(expense),
    String(savings),
    String(total),
  ]);

  return redirect(`/recap?month=${month}`);
}

export default function Recap() {
  const { month, savedEntry, expenseTotal } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as
    | { error?: string }
    | undefined;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const displayTotal = useMemo(() => savedEntry?.total ?? 0, [savedEntry]);
  const displayExpense = useMemo(() => expenseTotal, [expenseTotal]);

  const defaultIncome = savedEntry?.income;
  const defaultSavings = savedEntry?.savings;
  const submitLabel = savedEntry ? 'Update Rekap' : 'Simpan Rekap';

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col bg-white px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-24">
      <h1 className="mb-4 text-xl font-bold tracking-tight text-slate-900">Rekap Uang</h1>

      <section className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Total terbaru</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">IDR {displayTotal.toLocaleString('id-ID')}</p>
      </section>

      <Form method="post" className="space-y-3 rounded-xl border border-slate-200 p-4">
        <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">Bulan</label>
        <input
          type="month"
          name="month"
          defaultValue={month}
          required
          disabled={isSubmitting}
          className="w-full rounded-lg border-2 border-slate-200 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-900 disabled:opacity-50"
        />

        <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">Pendapatan</label>
        <input
          type="number"
          min="0"
          step="1"
          name="income"
          defaultValue={defaultIncome}
          required
          disabled={isSubmitting}
          className="w-full rounded-lg border-2 border-slate-200 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-900 disabled:opacity-50"
        />

        <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">Pengeluaran</label>
        <input
          type="number"
          min="0"
          step="1"
          value={displayExpense}
          readOnly
          disabled
          className="w-full rounded-lg border-2 border-slate-200 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-900 disabled:opacity-50"
        />
        <p className="-mt-1 text-xs text-slate-500">Nilai ini otomatis dari data halaman Add (bulan yang dipilih).</p>

        <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">Tabungan</label>
        <input
          type="number"
          min="0"
          step="1"
          name="savings"
          defaultValue={defaultSavings}
          required
          disabled={isSubmitting}
          className="w-full rounded-lg border-2 border-slate-200 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-900 disabled:opacity-50"
        />

        {actionData?.error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {actionData.error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isSubmitting ? 'Menyimpan...' : submitLabel}
        </button>
      </Form>

      <section className="mt-4 rounded-xl border border-slate-200 p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Rekap bulan {month}</h2>
        {!savedEntry ? (
          <p className="text-xs text-slate-500">Belum ada pendapatan/tabungan tersimpan untuk bulan ini.</p>
        ) : (
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <div className="flex justify-between">
              <span>Pendapatan</span>
              <span>IDR {savedEntry.income.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between">
              <span>Pengeluaran</span>
              <span>IDR {displayExpense.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between">
              <span>Tabungan</span>
              <span>IDR {savedEntry.savings.toLocaleString('id-ID')}</span>
            </div>
            <div className="mt-1 flex justify-between font-semibold text-slate-900">
              <span>Total</span>
              <span>IDR {displayTotal.toLocaleString('id-ID')}</span>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
