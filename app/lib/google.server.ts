import { google } from 'googleapis';

function normalizePrivateKey(raw: string | undefined): string {
  if (!raw) {
    throw new Error(
      'Missing GOOGLE_PRIVATE_KEY. Set it in .env using the service account private key.',
    );
  }

  const trimmed = raw.trim();
  const unquoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1)
      : trimmed;

  const normalized = unquoted.replace(/\\n/g, '\n');

  if (!normalized.includes('-----BEGIN PRIVATE KEY-----')) {
    throw new Error('Invalid GOOGLE_PRIVATE_KEY. Use a real service account key.');
  }

  return normalized;
}

function getServiceAccountCredentials() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  if (!clientEmail) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL.');
  }

  return {
    client_email: clientEmail,
    private_key: normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY),
  };
}

let serviceSheets: ReturnType<typeof google.sheets> | null = null;
let serviceDrive: ReturnType<typeof google.drive> | null = null;

export function getServiceSheetsClient() {
  if (serviceSheets) return serviceSheets;

  const auth = new google.auth.GoogleAuth({
    credentials: getServiceAccountCredentials(),
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });

  serviceSheets = google.sheets({ version: 'v4', auth });
  return serviceSheets;
}

export function getServiceDriveClient() {
  if (serviceDrive) return serviceDrive;

  const auth = new google.auth.GoogleAuth({
    credentials: getServiceAccountCredentials(),
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  serviceDrive = google.drive({ version: 'v3', auth });
  return serviceDrive;
}

export function getGoogleOAuthClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Missing Google OAuth config. Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REDIRECT_URI.',
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getGoogleAuthUrl(state: string) {
  const client = getGoogleOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'select_account',
    scope: ['openid', 'email', 'profile'],
    state,
  });
}

export async function getGoogleProfileFromCode(code: string) {
  const client = getGoogleOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const res = await oauth2.userinfo.get();

  const email = res.data.email?.trim().toLowerCase();
  if (!email) {
    throw new Error('Google account email was not returned.');
  }

  return {
    email,
    name: res.data.name?.trim() || email,
    picture: res.data.picture ?? undefined,
  };
}
