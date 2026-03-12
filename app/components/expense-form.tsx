import { useReducer } from 'react';
import { Form } from 'react-router';
import { format } from 'date-fns';
import { CalendarIcon, ExternalLink } from 'lucide-react';
import {
  APPLIED_VIA_OPTIONS,
  JOB_STATUSES,
  PROGRESS_OPTIONS,
} from '~/lib/constants';
import { Calendar } from '~/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import { cn } from '~/lib/utils';

interface JobFormProps {
  errors?: Record<string, string>;
  isSubmitting?: boolean;
  isOnline?: boolean;
  onOfflineSubmit?: (formData: FormData) => Promise<void>;
}

function toDateString(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type State = {
  dateApplying: Date;
  calendarOpen: boolean;
  appliedViaCustom: string;
  showCustomAppliedVia: boolean;
};

type Action =
  | { type: 'select_date'; date: Date }
  | { type: 'toggle_calendar'; open: boolean }
  | { type: 'set_applied_via_custom'; value: string }
  | { type: 'toggle_custom_applied_via'; show: boolean };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'select_date':
      return { ...state, dateApplying: action.date, calendarOpen: false };
    case 'toggle_calendar':
      return { ...state, calendarOpen: action.open };
    case 'set_applied_via_custom':
      return { ...state, appliedViaCustom: action.value };
    case 'toggle_custom_applied_via':
      return { ...state, showCustomAppliedVia: action.show };
  }
}

export function ExpenseForm({
  errors,
  isSubmitting,
  isOnline = true,
  onOfflineSubmit,
}: JobFormProps) {
  const [state, dispatch] = useReducer(reducer, {
    dateApplying: new Date(),
    calendarOpen: false,
    appliedViaCustom: '',
    showCustomAppliedVia: false,
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (isOnline) return;
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    onOfflineSubmit?.(formData);
  }

  return (
    <Form
      method="post"
      className="flex flex-col gap-5 p-4"
      onSubmit={handleSubmit}
    >
      <input
        type="hidden"
        name="dateApplying"
        value={toDateString(state.dateApplying)}
      />

      <fieldset>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
          Role / Position <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="role"
          placeholder="e.g. UI/UX Designer"
          maxLength={150}
          autoFocus
          className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-900"
        />
        {errors?.role && (
          <p className="mt-1 text-xs text-red-500">{errors.role}</p>
        )}
      </fieldset>

      <fieldset>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
          Company <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="company"
          placeholder="e.g. PT Maxxima Innovative Engineering"
          maxLength={200}
          className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-900"
        />
        {errors?.company && (
          <p className="mt-1 text-xs text-red-500">{errors.company}</p>
        )}
      </fieldset>

      <fieldset>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
          Job Type <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {JOB_STATUSES.map((s) => (
            <label key={s} className="cursor-pointer">
              <input
                type="radio"
                name="status"
                value={s}
                defaultChecked={s === 'Full time'}
                className="peer sr-only"
              />
              <div className="rounded-lg bg-slate-100 py-2 text-center text-xs font-medium text-slate-600 transition-colors peer-checked:bg-slate-900 peer-checked:text-white">
                {s}
              </div>
            </label>
          ))}
        </div>
        {errors?.status && (
          <p className="mt-1 text-xs text-red-500">{errors.status}</p>
        )}
      </fieldset>

      <fieldset>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
          Date Applying <span className="text-red-500">*</span>
        </label>
        <Popover
          open={state.calendarOpen}
          onOpenChange={(open) => dispatch({ type: 'toggle_calendar', open })}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                'w-full rounded-lg border-2 border-slate-200 px-4 py-3 text-left text-sm text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-slate-900',
                state.calendarOpen && 'border-slate-900',
              )}
            >
              <span className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-slate-400" />
                {format(state.dateApplying, 'EEEE, d MMMM yyyy')}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto">
            <Calendar
              mode="single"
              selected={state.dateApplying}
              onSelect={(d) => d && dispatch({ type: 'select_date', date: d })}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {errors?.dateApplying && (
          <p className="mt-1 text-xs text-red-500">{errors.dateApplying}</p>
        )}
      </fieldset>

      <fieldset>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
          Applied Via <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {APPLIED_VIA_OPTIONS.filter((v) => v !== 'Other').map((v) => (
            <label key={v} className="cursor-pointer">
              <input
                type="radio"
                name="appliedVia"
                value={v}
                defaultChecked={v === 'LinkedIn'}
                onChange={() =>
                  dispatch({ type: 'toggle_custom_applied_via', show: false })
                }
                className="peer sr-only"
              />
              <div className="rounded-lg bg-slate-100 py-2 text-center text-xs font-medium text-slate-600 transition-colors peer-checked:bg-slate-900 peer-checked:text-white">
                {v}
              </div>
            </label>
          ))}
          <label className="cursor-pointer">
            <input
              type="radio"
              name="appliedVia"
              value={
                state.showCustomAppliedVia
                  ? state.appliedViaCustom || 'Other'
                  : 'Other'
              }
              onChange={() =>
                dispatch({ type: 'toggle_custom_applied_via', show: true })
              }
              className="peer sr-only"
            />
            <div className="rounded-lg bg-slate-100 py-2 text-center text-xs font-medium text-slate-600 transition-colors peer-checked:bg-slate-900 peer-checked:text-white">
              Other
            </div>
          </label>
        </div>
        {state.showCustomAppliedVia && (
          <input
            type="text"
            placeholder="Specify..."
            value={state.appliedViaCustom}
            onChange={(e) => {
              dispatch({
                type: 'set_applied_via_custom',
                value: e.target.value,
              });
            }}
            className="mt-2 w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-900"
          />
        )}
        {errors?.appliedVia && (
          <p className="mt-1 text-xs text-red-500">{errors.appliedVia}</p>
        )}
      </fieldset>

      <fieldset>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
          Link Jobs
        </label>
        <div className="flex items-center gap-2 rounded-lg border-2 border-slate-200 px-4 py-3 focus-within:border-slate-900">
          <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            type="url"
            name="linkJobs"
            placeholder="https://linkedin.com/jobs/..."
            className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
          />
        </div>
      </fieldset>

      <fieldset>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
          Progress <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {PROGRESS_OPTIONS.map((p) => (
            <label key={p} className="cursor-pointer">
              <input
                type="radio"
                name="progress"
                value={p}
                defaultChecked={p === 'Applied'}
                className="peer sr-only"
              />
              <div className="rounded-lg bg-slate-100 py-2 text-center text-xs font-medium text-slate-600 transition-colors peer-checked:bg-slate-900 peer-checked:text-white">
                {p}
              </div>
            </label>
          ))}
        </div>
        {errors?.progress && (
          <p className="mt-1 text-xs text-red-500">{errors.progress}</p>
        )}
      </fieldset>

      <fieldset>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
          Event / Notes
        </label>
        <textarea
          name="event"
          placeholder="e.g. UIUX Designer Interview - Ray Gineung P.Z."
          maxLength={500}
          rows={3}
          className="w-full resize-none rounded-lg border-2 border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-900"
        />
      </fieldset>

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 w-full rounded-xl bg-slate-900 py-4 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
      >
        {isSubmitting ? 'Saving...' : isOnline ? 'Save Application' : 'Save Offline'}
      </button>
    </Form>
  );
}
