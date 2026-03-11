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
