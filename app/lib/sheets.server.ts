import { log } from './logger.server';
import { getServiceSheetsClient } from './google.server';

const EXPENSE_HEADERS = [
  'Timestamp',
  'Item',
  'Category',
  'Amount',
  'Method',
  'Date',
  'Source',
] as const;

const RECAP_SHEET_TITLE = 'rekap';
const RECAP_HEADERS = [
  'Timestamp',
  'Month',
  'Income',
  'Expense',
  'Savings',
  'Total',
] as const;

export async function getAvailableMonths(
  spreadsheetId: string,
): Promise<string[]> {
  try {
    const sheets = getServiceSheetsClient();
    const res = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.title'
    });

    const titles = (res.data.sheets ?? [])
      .map((s) => s.properties?.title ?? '')
      .filter((title) => /^\d{4}-\d{2}$/.test(title));

    titles.sort();
    titles.reverse();

    log('info', 'sheets_get_months_success', {
      count: titles.length
    });
    return titles;
  } catch (err) {
    const error = err as Error;
    log('error', 'sheets_get_months_error', { error: error.message });
    throw err;
  }
}

export async function ensureMonthSheet(
  spreadsheetId: string,
  month: string,
): Promise<void> {
  const sheets = getServiceSheetsClient();
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });

  const exists = (res.data.sheets ?? []).some(
    (sheet) => sheet.properties?.title === month,
  );

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title: month },
            },
          },
        ],
      },
    });
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${month}'!A1:G1`,
    valueInputOption: 'RAW',
    requestBody: { values: [Array.from(EXPENSE_HEADERS)] },
  });
}

export async function appendExpense(
  spreadsheetId: string,
  month: string,
  row: string[]
): Promise<void> {
  try {
    const sheets = getServiceSheetsClient();
    await ensureMonthSheet(spreadsheetId, month);
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${month}'!A:G`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] }
    });
    log('info', 'sheets_append_success', { month });
  } catch (err) {
    const error = err as Error;
    log('error', 'sheets_append_error', { error: error.message });
    throw err;
  }
}

export async function getExpensesByMonth(
  spreadsheetId: string,
  month: string,
  limit?: number
): Promise<string[][]> {
  try {
    const sheets = getServiceSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${month}'!A:G`
    });
    const values = res.data.values ?? [];
    const rows = values.slice(1);
    const bounded = limit ? rows.slice(-limit) : rows;
    return bounded.reverse() as string[][];
  } catch (err) {
    const error = err as Error;
    log('error', 'sheets_get_error', { error: error.message });
    throw err;
  }
}

export async function getExpenseTotalByMonth(
  spreadsheetId: string,
  month: string,
): Promise<number> {
  try {
    const rows = await getExpensesByMonth(spreadsheetId, month);
    return rows.reduce((sum, row) => {
      const amount = Number((row[3] ?? '').toString().replace(/,/g, ''));
      return Number.isFinite(amount) ? sum + amount : sum;
    }, 0);
  } catch (err) {
    const message = (err as { message?: string })?.message ?? '';
    if (
      message.includes('Unable to parse range') ||
      message.includes('Range')
    ) {
      return 0;
    }
    throw err;
  }
}

async function ensureRecapSheet(spreadsheetId: string): Promise<void> {
  const sheets = getServiceSheetsClient();
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });

  const exists = (res.data.sheets ?? []).some(
    (sheet) => sheet.properties?.title === RECAP_SHEET_TITLE,
  );

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title: RECAP_SHEET_TITLE },
            },
          },
        ],
      },
    });
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${RECAP_SHEET_TITLE}'!A1:F1`,
    valueInputOption: 'RAW',
    requestBody: { values: [Array.from(RECAP_HEADERS)] },
  });
}

export async function appendRecap(
  spreadsheetId: string,
  row: string[],
): Promise<void> {
  const sheets = getServiceSheetsClient();
  await ensureRecapSheet(spreadsheetId);
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${RECAP_SHEET_TITLE}'!A:F`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

export async function getRecapByMonth(
  spreadsheetId: string,
  month: string,
): Promise<string[][]> {
  const sheets = getServiceSheetsClient();
  await ensureRecapSheet(spreadsheetId);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${RECAP_SHEET_TITLE}'!A:F`,
  });

  const values = res.data.values ?? [];
  const rows = values.slice(1);
  const filtered = rows.filter((row) => (row[1] ?? '') === month);
  return filtered.reverse() as string[][];
}
