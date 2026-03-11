import { google } from 'googleapis';
import { log } from './logger.server';

// Singleton — reuse across requests in the same server instance
let _sheets: ReturnType<typeof google.sheets> | null = null;

function normalizePrivateKey(raw: string | undefined): string {
  if (!raw) {
    throw new Error(
      'Missing GOOGLE_PRIVATE_KEY. Set it in .env using the service account private key.'
    );
  }

  const trimmed = raw.trim();
  const unquoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1)
      : trimmed;

  const normalized = unquoted.replace(/\\n/g, '\n');

  if (
    !normalized.includes('-----BEGIN PRIVATE KEY-----') ||
    normalized.includes('REPLACE_WITH_YOUR_KEY')
  ) {
    throw new Error(
      'Invalid GOOGLE_PRIVATE_KEY. Use the real service account key from Google Cloud JSON (single line with literal \\n in .env).'
    );
  }

  return normalized;
}

function getSheetsClient() {
  if (_sheets) return _sheets;

  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

  if (!serviceAccountEmail || serviceAccountEmail.includes('your-service-account')) {
    throw new Error(
      'Invalid GOOGLE_SERVICE_ACCOUNT_EMAIL. Set it to your real service account email in .env.'
    );
  }

  const privateKey = normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY);

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: serviceAccountEmail,
      private_key: privateKey
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  _sheets = google.sheets({ version: 'v4', auth });
  return _sheets;
}

export async function getAvailableMonths(): Promise<string[]> {
  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.get({
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
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

export async function appendExpense(
  month: string,
  row: string[]
): Promise<void> {
  try {
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
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
  month: string,
  limit?: number
): Promise<string[][]> {
  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
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
