// One-shot script: create a monthly YYYY-MM tab with headers in the spreadsheet.
// Usage: node scripts/create-sheet-tab.mjs [YYYY-MM] [YYYY-MM] ...
// Default: creates the current month tab (Asia/Jakarta timezone).
import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse .env manually (avoid dotenv dependency)
const envPath = resolve(__dirname, '../.env');
const envRaw = readFileSync(envPath, 'utf-8');
const env = Object.fromEntries(
  envRaw
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const idx = l.indexOf('=');
      const key = l.slice(0, idx).trim();
      let val = l.slice(idx + 1).trim();
      // Strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      // Replace literal \n with real newlines (for private key)
      val = val.replace(/\\n/g, '\n');
      return [key, val];
    })
);

const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const privateKey = env.GOOGLE_PRIVATE_KEY;
const spreadsheetId = env.GOOGLE_SPREADSHEET_ID;

if (!email || !privateKey || !spreadsheetId) {
  console.error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, or GOOGLE_SPREADSHEET_ID in .env');
  process.exit(1);
}

// Determine months to create
function currentJakartaMonth() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year').value;
  const m = parts.find((p) => p.type === 'month').value;
  return `${y}-${m}`;
}

const monthsToCreate = process.argv.slice(2).length > 0
  ? process.argv.slice(2)
  : [currentJakartaMonth()];

const HEADERS = ['Timestamp', 'Item', 'Category', 'Amount', 'Method', 'Date', 'Source'];

async function main() {
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Fetch existing tabs
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });
  const existing = (meta.data.sheets ?? []).map((s) => s.properties.title);
  console.log('Existing tabs:', existing.join(', ') || '(none)');

  for (const month of monthsToCreate) {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      console.warn(`Skipping "${month}" — must be YYYY-MM format.`);
      continue;
    }
    if (existing.includes(month)) {
      console.log(`Tab "${month}" already exists. Skipping.`);
      continue;
    }

    // Add sheet tab
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: month } } }],
      },
    });
    console.log(`Created tab: ${month}`);

    // Write header row
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${month}'!A1:G1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] },
    });
    console.log(`Headers written to ${month}`);
  }

  console.log('\nDone. Refresh http://localhost:5173 to use the app.');
}

main().catch((err) => {
  console.error('Error:', err.message ?? err);
  process.exit(1);
});
