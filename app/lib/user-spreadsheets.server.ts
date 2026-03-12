import { log } from './logger.server';
import { getServiceDriveClient, getServiceSheetsClient } from './google.server';
import type { SessionUser } from './auth.server';

const USERS_TAB_TITLE = 'users';
const USER_HEADERS = [
  'Email',
  'Name',
  'Spreadsheet ID',
  'Created At',
] as const;
const APPLICATIONS_TAB_TITLE = 'Applications';
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

function getUserSheetsFolderId() {
  const id = process.env.GOOGLE_USER_SHEETS_FOLDER_ID?.trim();
  return id && id.length > 0 ? id : null;
}

function getMasterSpreadsheetId() {
  const id = process.env.GOOGLE_MASTER_SPREADSHEET_ID;
  if (!id) {
    throw new Error(
      'Missing GOOGLE_MASTER_SPREADSHEET_ID. Set it to the spreadsheet used to store user mappings.',
    );
  }
  return id;
}

function getSpreadsheetOverrideId() {
  const raw = process.env.GOOGLE_SPREADSHEET_ID?.trim();
  if (!raw) return null;

  const parsed = extractSpreadsheetId(raw);
  return parsed || null;
}

function getSpreadsheetUrl(spreadsheetId: string) {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}

function extractSpreadsheetId(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return '';

  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch?.[1]) return urlMatch[1];

  const rawMatch = trimmed.match(/^[a-zA-Z0-9-_]{20,}$/);
  if (rawMatch) return trimmed;

  return '';
}

async function ensureApplicationsTabAndHeaders(spreadsheetId: string) {
  const sheets = getServiceSheetsClient();

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });

  const hasApplicationsTab = (meta.data.sheets ?? []).some(
    (sheet) => sheet.properties?.title === APPLICATIONS_TAB_TITLE,
  );

  if (!hasApplicationsTab) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title: APPLICATIONS_TAB_TITLE },
            },
          },
        ],
      },
    });
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${APPLICATIONS_TAB_TITLE}'!A1:I1`,
    valueInputOption: 'RAW',
    requestBody: { values: [Array.from(APPLICATION_HEADERS)] },
  });
}

async function ensureUsersTab() {
  const sheets = getServiceSheetsClient();
  const spreadsheetId = getMasterSpreadsheetId();
  let meta;
  try {
    meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.title',
    });
  } catch (error) {
    const serviceAccountEmail =
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? 'your-service-account-email';
    throw new Error(
      `Cannot access GOOGLE_MASTER_SPREADSHEET_ID (${spreadsheetId}). Share the sheet to ${serviceAccountEmail} with Editor access. Original error: ${(error as Error).message}`,
    );
  }

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
    range: `'${USERS_TAB_TITLE}'!A1:D1`,
    valueInputOption: 'RAW',
    requestBody: { values: [Array.from(USER_HEADERS)] },
  });
}

type StoredUser = {
  rowNumber: number;
  email: string;
  name: string;
  spreadsheetId: string;
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
    };
  }

  return null;
}

async function createUserSpreadsheet(name: string, email: string) {
  const sheets = getServiceSheetsClient();
  const drive = getServiceDriveClient();

  const folderId = getUserSheetsFolderId();
  let spreadsheetId = '';
  let spreadsheetUrl = '';

  if (folderId) {
    try {
      const createdFile = await drive.files.create({
        requestBody: {
          name: `Job Tracker - ${name}`,
          mimeType: 'application/vnd.google-apps.spreadsheet',
          parents: [folderId],
        },
        fields: 'id,webViewLink',
        supportsAllDrives: true,
      });

      spreadsheetId = createdFile.data.id ?? '';
      spreadsheetUrl = createdFile.data.webViewLink ?? '';
    } catch (error) {
      throw new Error(
        `Failed to create user spreadsheet in GOOGLE_USER_SHEETS_FOLDER_ID (${folderId}). Share that folder with ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL} as Editor. Original error: ${(error as Error).message}`,
      );
    }
  } else {
    let created;
    try {
      created = await sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: `Job Tracker - ${name}`,
          },
          sheets: [],
        },
      });
    } catch (error) {
      throw new Error(
        `Failed to create user spreadsheet (sheets.spreadsheets.create). Set GOOGLE_USER_SHEETS_FOLDER_ID to a Drive folder shared to ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL} (Editor). Original error: ${(error as Error).message}`,
      );
    }

    spreadsheetId = created.data.spreadsheetId ?? '';
    spreadsheetUrl = created.data.spreadsheetUrl ?? '';
  }

  if (!spreadsheetId) {
    throw new Error('Failed to create user spreadsheet ID.');
  }

  if (!spreadsheetUrl) {
    spreadsheetUrl = getSpreadsheetUrl(spreadsheetId);
  }

  try {
    await ensureApplicationsTabAndHeaders(spreadsheetId);
  } catch (error) {
    throw new Error(
      `Failed to initialize user spreadsheet headers. Original error: ${(error as Error).message}`,
    );
  }

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

export async function getProvisionedUserByEmail(profile: {
  email: string;
  name: string;
  picture?: string;
}): Promise<SessionUser | null> {
  const overrideSpreadsheetId = getSpreadsheetOverrideId();
  let existing: StoredUser | null = null;
  try {
    existing = await findStoredUserByEmail(profile.email);
  } catch (error) {
    throw new Error(
      `Failed to read user mapping from master sheet. ${(error as Error).message}`,
    );
  }

  if (overrideSpreadsheetId) {
    try {
      await ensureApplicationsTabAndHeaders(overrideSpreadsheetId);
    } catch (error) {
      throw new Error(
        `Cannot use GOOGLE_SPREADSHEET_ID (${overrideSpreadsheetId}). Share it to ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL} with Editor access. Original error: ${(error as Error).message}`,
      );
    }

    try {
      await upsertStoredUser({
        rowNumber: existing?.rowNumber,
        email: profile.email,
        name: profile.name,
        spreadsheetId: overrideSpreadsheetId,
      });
    } catch (error) {
      throw new Error(
        `Failed to update user mapping in master sheet. ${(error as Error).message}`,
      );
    }

    return {
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      spreadsheetId: overrideSpreadsheetId,
      spreadsheetUrl: getSpreadsheetUrl(overrideSpreadsheetId),
    };
  }

  if (!existing?.spreadsheetId) {
    return null;
  }

  try {
    await upsertStoredUser({
      rowNumber: existing.rowNumber,
      email: profile.email,
      name: profile.name,
      spreadsheetId: existing.spreadsheetId,
    });
  } catch (error) {
    throw new Error(
      `Failed to update existing user mapping in master sheet. ${(error as Error).message}`,
    );
  }

  return {
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
    spreadsheetId: existing.spreadsheetId,
    spreadsheetUrl: getSpreadsheetUrl(existing.spreadsheetId),
  };
}

export async function linkSpreadsheetForUser(profile: {
  email: string;
  name: string;
  picture?: string;
}, spreadsheetInput: string): Promise<SessionUser> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetInput);
  if (!spreadsheetId) {
    throw new Error('Invalid spreadsheet ID or URL.');
  }

  const sheets = getServiceSheetsClient();
  try {
    await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'properties.title',
    });
  } catch (error) {
    throw new Error(
      `Cannot access provided spreadsheet (${spreadsheetId}). Share it to ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL} with Editor access. Original error: ${(error as Error).message}`,
    );
  }

  try {
    await ensureApplicationsTabAndHeaders(spreadsheetId);
  } catch (error) {
    throw new Error(
      `Failed to prepare application headers in provided spreadsheet. ${(error as Error).message}`,
    );
  }

  const existing = await findStoredUserByEmail(profile.email);
  try {
    await upsertStoredUser({
      rowNumber: existing?.rowNumber,
      email: profile.email,
      name: profile.name,
      spreadsheetId,
    });
  } catch (error) {
    throw new Error(
      `Failed to save user mapping in master sheet. ${(error as Error).message}`,
    );
  }

  return {
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
    spreadsheetId,
    spreadsheetUrl: getSpreadsheetUrl(spreadsheetId),
  };
}

async function upsertStoredUser(user: {
  rowNumber?: number;
  email: string;
  name: string;
  spreadsheetId: string;
}) {
  await ensureUsersTab();

  const sheets = getServiceSheetsClient();
  const values = [
    user.email,
    user.name,
    user.spreadsheetId,
    new Date().toISOString(),
  ];

  if (user.rowNumber) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: getMasterSpreadsheetId(),
      range: `'${USERS_TAB_TITLE}'!A${user.rowNumber}:D${user.rowNumber}`,
      valueInputOption: 'RAW',
      requestBody: { values: [values] },
    });
    return;
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: getMasterSpreadsheetId(),
    range: `'${USERS_TAB_TITLE}'!A:D`,
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
  const overrideSpreadsheetId = getSpreadsheetOverrideId();
  let existing: StoredUser | null = null;
  try {
    existing = await findStoredUserByEmail(profile.email);
  } catch (error) {
    throw new Error(
      `Failed to read user mapping from master sheet. ${(error as Error).message}`,
    );
  }

  if (overrideSpreadsheetId) {
    try {
      await ensureApplicationsTabAndHeaders(overrideSpreadsheetId);
    } catch (error) {
      throw new Error(
        `Cannot use GOOGLE_SPREADSHEET_ID (${overrideSpreadsheetId}). Share it to ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL} with Editor access. Original error: ${(error as Error).message}`,
      );
    }

    try {
      await upsertStoredUser({
        rowNumber: existing?.rowNumber,
        email: profile.email,
        name: profile.name,
        spreadsheetId: overrideSpreadsheetId,
      });
    } catch (error) {
      throw new Error(
        `Failed to update user mapping in master sheet. ${(error as Error).message}`,
      );
    }

    return {
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      spreadsheetId: overrideSpreadsheetId,
      spreadsheetUrl: getSpreadsheetUrl(overrideSpreadsheetId),
    };
  }

  if (existing?.spreadsheetId) {
    try {
      await upsertStoredUser({
        rowNumber: existing.rowNumber,
        email: profile.email,
        name: profile.name,
        spreadsheetId: existing.spreadsheetId,
      });
    } catch (error) {
      throw new Error(
        `Failed to update existing user mapping in master sheet. ${(error as Error).message}`,
      );
    }

    return {
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      spreadsheetId: existing.spreadsheetId,
      spreadsheetUrl: getSpreadsheetUrl(existing.spreadsheetId),
    };
  }

  const created = await createUserSpreadsheet(profile.name, profile.email);
  try {
    await upsertStoredUser({
      rowNumber: existing?.rowNumber,
      email: profile.email,
      name: profile.name,
      spreadsheetId: created.spreadsheetId,
    });
  } catch (error) {
    throw new Error(
      `Failed to save new user mapping into master sheet. ${(error as Error).message}`,
    );
  }

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
