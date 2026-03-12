import { log } from './logger.server';
import { getServiceSheetsClient } from './google.server';

const APPLICATIONS_SHEET_TITLE = 'Applications';

const APPLICATION_HEADERS = [
  'Timestamp',
  'Role',
  'Status',
  'Company',
  'Date Applying',
  'Applied Via',
  'Link Jobs',
  'Progress',
  'Event',
] as const;

// ─── Ensure Sheet Exists ───────────────────────────────────────────────────

export async function ensureApplicationsSheet(
  spreadsheetId: string,
): Promise<void> {
  const sheets = getServiceSheetsClient();
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });

  const exists = (res.data.sheets ?? []).some(
    (sheet) => sheet.properties?.title === APPLICATIONS_SHEET_TITLE,
  );

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title: APPLICATIONS_SHEET_TITLE },
            },
          },
        ],
      },
    });
  }

  // Always ensure header row is correct
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${APPLICATIONS_SHEET_TITLE}'!A1:I1`,
    valueInputOption: 'RAW',
    requestBody: { values: [Array.from(APPLICATION_HEADERS)] },
  });
}

// ─── Append ────────────────────────────────────────────────────────────────

export async function appendJobApplication(
  spreadsheetId: string,
  row: string[],
): Promise<void> {
  try {
    const sheets = getServiceSheetsClient();
    await ensureApplicationsSheet(spreadsheetId);
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${APPLICATIONS_SHEET_TITLE}'!A:I`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });
    log('info', 'sheets_append_job_success', {});
  } catch (err) {
    const error = err as Error;
    log('error', 'sheets_append_job_error', { error: error.message });
    throw err;
  }
}

// ─── Read ──────────────────────────────────────────────────────────────────

export async function getAllApplications(
  spreadsheetId: string,
  limit?: number,
): Promise<string[][]> {
  try {
    const sheets = getServiceSheetsClient();
    await ensureApplicationsSheet(spreadsheetId);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${APPLICATIONS_SHEET_TITLE}'!A:I`,
    });
    const values = res.data.values ?? [];
    const rows = values.slice(1); // skip header
    const bounded = limit ? rows.slice(-limit) : rows;
    return bounded.reverse() as string[][];
  } catch (err) {
    const error = err as Error;
    log('error', 'sheets_get_jobs_error', { error: error.message });
    throw err;
  }
}

// ─── Update Progress ───────────────────────────────────────────────────────

export async function getApplicationStats(
  spreadsheetId: string,
): Promise<Record<string, number>> {
  try {
    const rows = await getAllApplications(spreadsheetId);
    const stats: Record<string, number> = {
      total: rows.length,
      applied: 0,
      interview: 0,
      offered: 0,
      accepted: 0,
      rejected: 0,
      withdrawn: 0,
    };
    for (const row of rows) {
      const progress = (row[7] ?? '').toLowerCase();
      if (progress in stats) {
        stats[progress]++;
      }
    }
    return stats;
  } catch (err) {
    const error = err as Error;
    log('error', 'sheets_get_stats_error', { error: error.message });
    throw err;
  }
}

// ─── Timestamp helper ──────────────────────────────────────────────────────

export function getJakartaTimestamp(): string {
  const now = new Date();
  const jakartaDate = new Date(
    now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }),
  );
  return `${jakartaDate.getMonth() + 1}/${jakartaDate.getDate()}/${jakartaDate.getFullYear()} ${String(jakartaDate.getHours()).padStart(2, '0')}:${String(jakartaDate.getMinutes()).padStart(2, '0')}:${String(jakartaDate.getSeconds()).padStart(2, '0')}`;
}


