import { z } from 'zod';
import { JOB_STATUSES, PROGRESS_OPTIONS } from './constants';

export const jobApplicationSchema = z.object({
  role: z.string().min(1, 'Role is required').max(150, 'Role too long'),
  status: z.enum(JOB_STATUSES, { message: 'Pick a job status' }),
  company: z.string().min(1, 'Company is required').max(200, 'Company name too long'),
  dateApplying: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  appliedVia: z.string().min(1, 'Select how you applied'),
  linkJobs: z.string().optional().default(''),
  progress: z.enum(PROGRESS_OPTIONS, { message: 'Pick a progress status' }),
  event: z.string().max(500, 'Event too long').optional().default(''),
});

export type JobApplicationInput = z.input<typeof jobApplicationSchema>;
export type JobApplicationData = z.output<typeof jobApplicationSchema>;
