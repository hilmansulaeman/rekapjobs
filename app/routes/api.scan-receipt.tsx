import { google } from 'googleapis';
import { requireAuth } from '~/lib/auth.server';
import type { Route } from './+types/api.scan-receipt';

function normalizePrivateKey(raw: string | undefined): string {
  if (!raw) throw new Error('Missing GOOGLE_PRIVATE_KEY');
  const trimmed = raw.trim();
  const unquoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1)
      : trimmed;
  return unquoted.replace(/\\n/g, '\n');
}

function getAuthClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  if (!clientEmail) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY),
    },
    scopes: ['https://www.googleapis.com/auth/cloud-vision'],
  });
  return auth;
}

function resolveAccessToken(
  value: string | null | undefined | { token?: string | null },
): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value.token === 'string' && value.token.trim().length > 0) {
    return value.token;
  }
  return null;
}

// ----- Receipt text parser -----

function parseReceiptText(text: string): {
  amount: string;
  item: string;
  date: string;
} {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // --- Amount ---
  // Look for TOTAL / GRAND TOTAL / JUMLAH line then grab the largest number
  let amount = '';

  // Try to find "TOTAL" or "JUMLAH" line
  const totalLineIdx = lines.findIndex((l) =>
    /\b(grand[- ]?total|total|jumlah|tagihan|bayar)\b/i.test(l),
  );

  const candidateLines =
    totalLineIdx >= 0 ? lines.slice(totalLineIdx, totalLineIdx + 4) : lines;

  // Extract all numbers from candidate lines, take the largest
  const numRegex = /(?:Rp\.?\s*)?([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{1,2})?)/g;
  let maxVal = 0;
  for (const line of candidateLines) {
    let m;
    while ((m = numRegex.exec(line)) !== null) {
      // Normalize: remove thousand separators, keep value
      const raw = m[1].replace(/\./g, '').replace(',', '.');
      const val = parseFloat(raw);
      if (!isNaN(val) && val > maxVal) {
        maxVal = val;
        // Store the integer part only
        amount = String(Math.round(val));
      }
    }
  }

  // Fallback: just find the biggest number in the whole text
  if (!amount) {
    numRegex.lastIndex = 0;
    let m;
    while ((m = numRegex.exec(text)) !== null) {
      const raw = m[1].replace(/\./g, '').replace(',', '.');
      const val = parseFloat(raw);
      if (!isNaN(val) && val > maxVal) {
        maxVal = val;
        amount = String(Math.round(val));
      }
    }
  }

  // --- Date ---
  let date = '';
  // Patterns: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, DD MMM YYYY (e.g. 11 Mar 2026)
  const datePatterns: { re: RegExp; toISO: (m: RegExpMatchArray) => string }[] = [
    {
      re: /(\d{4})-(\d{2})-(\d{2})/,
      toISO: (m) => `${m[1]}-${m[2]}-${m[3]}`,
    },
    {
      re: /(\d{2})\/(\d{2})\/(\d{4})/,
      toISO: (m) => `${m[3]}-${m[2]}-${m[1]}`,
    },
    {
      re: /(\d{2})-(\d{2})-(\d{4})/,
      toISO: (m) => `${m[3]}-${m[2]}-${m[1]}`,
    },
    {
      re: /(\d{1,2})\s+(Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Sep|Okt|Nov|Des|January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
      toISO: (m) => {
        const monthMap: Record<string, string> = {
          jan: '01', feb: '02', mar: '03', apr: '04',
          mei: '05', may: '05', jun: '06', jul: '07',
          agu: '08', aug: '08', sep: '09', okt: '10', oct: '10',
          nov: '11', des: '12', dec: '12',
        };
        const mm = monthMap[m[2].toLowerCase().slice(0, 3)] ?? '01';
        return `${m[3]}-${mm}-${m[1].padStart(2, '0')}`;
      },
    },
  ];

  for (const { re, toISO } of datePatterns) {
    const m = text.match(re);
    if (m) {
      date = toISO(m);
      break;
    }
  }

  // --- Item / merchant name ---
  // Try the first non-trivial line (skip pure numbers, common headers)
  const skipWords =
    /^\s*$|^\d+$|struk|receipt|nota|invoice|kasir|npwp|no\.|kode|tgl|tanggal|waktu|time|date/i;
  let item = '';
  for (const line of lines.slice(0, 8)) {
    if (!skipWords.test(line) && line.length >= 3) {
      // Capitalize words
      item = line
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
      break;
    }
  }

  return { amount, item, date };
}

// ----- Route action -----

export async function action({ request }: Route.ActionArgs) {
  await requireAuth(request);

  if (request.method.toUpperCase() !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let imageB64: string;

  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;

    if (!imageFile || typeof imageFile === 'string') {
      return Response.json({ error: 'No image provided' }, { status: 400 });
    }

    const buffer = await imageFile.arrayBuffer();
    imageB64 = Buffer.from(buffer).toString('base64');
  } catch {
    return Response.json({ error: 'Failed to read image' }, { status: 400 });
  }

  try {
    const auth = getAuthClient();
    const accessToken = await auth.getAccessToken();
    const token = resolveAccessToken(
      accessToken as string | null | undefined | { token?: string | null },
    );

    if (!token) {
      return Response.json(
        { error: 'Failed to get Google access token for Vision API' },
        { status: 500 },
      );
    }

    const visionRes = await fetch(
      'https://vision.googleapis.com/v1/images:annotate',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              image: { content: imageB64 },
              features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
            },
          ],
        }),
      },
    );

    if (!visionRes.ok) {
      const errText = await visionRes.text();
      console.error('Vision API error:', errText);
      return Response.json(
        { error: 'Vision API error', detail: errText },
        { status: 502 },
      );
    }

    const visionData = await visionRes.json() as {
      responses?: Array<{
        fullTextAnnotation?: { text?: string };
        textAnnotations?: Array<{ description?: string }>;
        error?: { message?: string };
      }>;
    };

    const visionError = visionData.responses?.[0]?.error;
    if (visionError) {
      return Response.json(
        { error: visionError.message ?? 'Vision API error' },
        { status: 502 },
      );
    }

    const rawText =
      visionData.responses?.[0]?.fullTextAnnotation?.text ??
      visionData.responses?.[0]?.textAnnotations?.[0]?.description ??
      '';

    if (!rawText) {
      return Response.json({ error: 'No text detected on receipt' }, { status: 422 });
    }

    const parsed = parseReceiptText(rawText);

    return Response.json({ ...parsed, ok: true });
  } catch (err) {
    const message = (err as Error).message ?? 'Unknown scan error';
    console.error('scan-receipt error:', message);

    const lowered = message.toLowerCase();
    const mappedError =
      lowered.includes('missing google_private_key') ||
      lowered.includes('missing google_service_account_email')
        ? 'Google Vision credentials are missing on server'
        : lowered.includes('api has not been used') ||
            lowered.includes('vision.googleapis.com')
          ? 'Cloud Vision API is not enabled on the Google Cloud project'
          : lowered.includes('permission') || lowered.includes('forbidden')
            ? 'Service account has no permission to use Vision API'
            : 'Server error while scanning receipt';

    return Response.json(
      { error: mappedError, detail: message },
      { status: 500 },
    );
  }
}
