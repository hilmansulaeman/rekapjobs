import { data } from 'react-router';
import type { Route } from './+types/api.sync';
import { requireAuth } from '~/lib/auth.server';
import {
  appendJobApplication,
  getJakartaTimestamp,
} from '~/lib/sheets.server';
import { jobApplicationSchema } from '~/lib/validation';
import { log } from '~/lib/logger.server';

export async function action({ request }: Route.ActionArgs) {
  const user = await requireAuth(request);

  const body = await request.json();
  const parsed = jobApplicationSchema.safeParse(body);

  if (!parsed.success) {
    return data({ success: false, error: 'Validation failed' }, { status: 400 });
  }

  const d = parsed.data;
  const [year, month, day] = d.dateApplying.split('-');
  const dateApplying = `${Number(month)}/${Number(day)}/${year}`;

  const row = [
    getJakartaTimestamp(),
    d.role,
    d.status,
    d.company,
    dateApplying,
    d.appliedVia,
    d.linkJobs,
    d.progress,
    d.event,
  ];

  try {
    await appendJobApplication(user.spreadsheetId, row);
    log('info', 'offline_application_synced', {
      company: d.company,
      role: d.role,
      progress: d.progress,
    });
    return data({ success: true });
  } catch (err) {
    log('error', 'offline_sync_failed', { error: (err as Error).message });
    return data({ success: false, error: 'Sheets API error' }, { status: 500 });
  }
}
