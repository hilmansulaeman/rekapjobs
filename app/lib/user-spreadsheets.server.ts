import { log } from './logger.server';
import { getServiceDriveClient, getServiceSheetsClient } from './google.server';
import type { SessionUser } from './auth.server';

const USERS_TAB_TITLE = 'users';
const USER_HEADERS = [
  'Email',
  'Name',
  'Spreadsheet ID',
  'Spreadsheet URL',
  'Created At',
] as const;
const EXPENSE_HEADERS = [
  'Timestamp',
  'Item',
  'Category',
  'Amount',
  'Method',
  'Date',
  'Source',
] as const;

function getMasterSpreadsheetId() {
  const id = process.env.GOOGLE_MASTER_SPREADSHEET_ID;
  if (!id) {
    throw new Error(
      'Missing GOOGLE_MASTER_SPREADSHEET_ID. Set it to the spreadsheet used to store user mappings.',
    );
  }
  return id;
}

function getCurrentMonth() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  if (!year || !month) {
    throw new Error('Failed to determine current month.');
  }
  return `${year}-${month}`;
}

async function ensureUsersTab() {
  const sheets = getServiceSheetsClient();
  const spreadsheetId = getMasterSpreadsheetId();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });

  const hasUsersTab = (meta.data.sheets ?? []).some(
    (sheet) => sheet.properties?.title === USERS_TAB_TITLE,
  );

  if (!hasUsersTab) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title: USERS_TAB_TITLE },
            },
          },
        ],
      },
    });
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${USERS_TAB_TITLE}'!A1:E1`,
    valueInputOption: 'RAW',
    requestBody: { values: [Array.from(USER_HEADERS)] },
  });
}

type StoredUser = {
  rowNumber: number;
  email: string;
  name: string;
  spreadsheetId: string;
  spreadsheetUrl?: string;
};

async function findStoredUserByEmail(email: string): Promise<StoredUser | null> {
  await ensureUsersTab();

  const sheets = getServiceSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getMasterSpreadsheetId(),
    range: `'${USERS_TAB_TITLE}'!A2:E`,
  });

  const rows = res.data.values ?? [];
  const lowerEmail = email.trim().toLowerCase();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if ((row[0] ?? '').trim().toLowerCase() !== lowerEmail) continue;

    return {
      rowNumber: i + 2,
      email: row[0] ?? '',
      name: row[1] ?? '',
      spreadsheetId: row[2] ?? '',
      spreadsheetUrl: row[3] ?? undefined,
    };
  }

  return null;
}

async function createUserSpreadsheet(name: string, email: string) {
  const sheets = getServiceSheetsClient();
  const drive = getServiceDriveClient();
  const month = getCurrentMonth();

  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: `DuitLog - ${name}`,
      },
      sheets: [
        {
          properties: {
            title: month,
          },
        },
      ],
    },
  });

  const spreadsheetId = created.data.spreadsheetId;
  if (!spreadsheetId) {
    throw new Error('Failed to create user spreadsheet.');
  }

  const spreadsheetUrl =
    created.data.spreadsheetUrl ??
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${month}'!A1:G1`,
    valueInputOption: 'RAW',
    requestBody: { values: [Array.from(EXPENSE_HEADERS)] },
  });

  try {
    await drive.permissions.create({
      fileId: spreadsheetId,
      sendNotificationEmail: false,
      requestBody: {
        type: 'user',
        role: 'writer',
        emailAddress: email,
      },
    });
  } catch (error) {
    log('warn', 'user_spreadsheet_share_failed', {
      email,
      error: (error as Error).message,
    });
  }

  return { spreadsheetId, spreadsheetUrl };
}

async function upsertStoredUser(user: {
  rowNumber?: number;
  email: string;
  name: string;
  spreadsheetId: string;
  spreadsheetUrl?: string;
}) {
  await ensureUsersTab();

  const sheets = getServiceSheetsClient();
  const values = [
    user.email,
    user.name,
    user.spreadsheetId,
    user.spreadsheetUrl ?? '',
    new Date().toISOString(),
  ];

  if (user.rowNumber) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: getMasterSpreadsheetId(),
      range: `'${USERS_TAB_TITLE}'!A${user.rowNumber}:E${user.rowNumber}`,
      valueInputOption: 'RAW',
      requestBody: { values: [values] },
    });
    return;
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: getMasterSpreadsheetId(),
    range: `'${USERS_TAB_TITLE}'!A:E`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [values] },
  });
}

export async function getOrCreateProvisionedUser(profile: {
  email: string;
  name: string;
  picture?: string;
}): Promise<SessionUser> {
  const existing = await findStoredUserByEmail(profile.email);

  if (existing?.spreadsheetId) {
    await upsertStoredUser({
      rowNumber: existing.rowNumber,
      email: profile.email,
      name: profile.name,
      spreadsheetId: existing.spreadsheetId,
      spreadsheetUrl: existing.spreadsheetUrl,
    });

    return {
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      spreadsheetId: existing.spreadsheetId,
      spreadsheetUrl: existing.spreadsheetUrl,
    };
  }

  const created = await createUserSpreadsheet(profile.name, profile.email);
  await upsertStoredUser({
    rowNumber: existing?.rowNumber,
    email: profile.email,
    name: profile.name,
    spreadsheetId: created.spreadsheetId,
    spreadsheetUrl: created.spreadsheetUrl,
  });

  log('info', 'user_spreadsheet_created', {
    email: profile.email,
    spreadsheetId: created.spreadsheetId,
  });

  return {
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
    spreadsheetId: created.spreadsheetId,
    spreadsheetUrl: created.spreadsheetUrl,
  };
}
