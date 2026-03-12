export const JOB_STATUSES = [
  'Full time',
  'Part time',
  'Contract',
  'Internship',
  'Freelance',
] as const;

export const APPLIED_VIA_OPTIONS = [
  'LinkedIn',
  'Email',
  'JobStreet',
  'Indeed',
  'Glints',
  'Kalibrr',
  'Company Website',
  'Referral',
  'Other',
] as const;

export const PROGRESS_OPTIONS = [
  'Applied',
  'Interview',
  'Offered',
  'Accepted',
  'Rejected',
  'Withdrawn',
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];
export type AppliedVia = (typeof APPLIED_VIA_OPTIONS)[number];
export type Progress = (typeof PROGRESS_OPTIONS)[number];
