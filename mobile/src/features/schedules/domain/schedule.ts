import { isApiError } from '@/lib/api';

export type ScheduleStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'COMPLETED';

export type ScheduleStatusLabel = 'MONITORING' | 'WEEKLY' | 'PAUSED' | 'COMPLETED';

export type ScheduleTimeOfDay = 'Morning' | 'Afternoon' | 'Evening';

export type ScheduleWeekday =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

export type ScheduleRecurrence =
  | {
      frequency: 'Daily';
      every: number;
      timeOfDay: ScheduleTimeOfDay;
      exactTime?: string;
    }
  | {
      frequency: 'Weekly';
      every: number;
      repeatDay: ScheduleWeekday;
      days: ScheduleWeekday[];
      timeOfDay: ScheduleTimeOfDay;
      exactTime?: string;
    }
  | {
      frequency: 'Once';
      every: number;
      date: string;
      timeOfDay: ScheduleTimeOfDay;
      exactTime?: string;
    };

export type SchedulePayload = {
  prompt: string;
  deliveryTargets: Array<'DEVICE' | 'MOBILE'>;
};

export type Schedule = {
  id: string;
  status: ScheduleStatus;
  statusLabel: ScheduleStatusLabel;
  version: number;
  payload: SchedulePayload;
  recurrence: ScheduleRecurrence;
  nextRunAt: string | null;
  timezone: string;
  exactTime?: string | null;
  formattedTime?: string;
};

export type ScheduleCardItem = {
  id: string;
  status: ScheduleStatusLabel;
  title: string;
  description: string;
  footerText?: string;
};

export type ScheduleStatusFilter = 'All' | 'Active' | 'Paused' | 'Completed';

export type ScheduleContextMenuVariant = 'active' | 'paused' | 'completed';

const WEEKDAY_PLURAL: Record<ScheduleWeekday, string> = {
  Monday: 'Mondays',
  Tuesday: 'Tuesdays',
  Wednesday: 'Wednesdays',
  Thursday: 'Thursdays',
  Friday: 'Fridays',
  Saturday: 'Saturdays',
  Sunday: 'Sundays',
};

export const CREATE_SCHEDULE_DEFAULTS = {
  frequency: 'Daily' as const,
  every: 1 as const,
  timeOfDay: 'Morning' as const,
  deliveryTargets: ['MOBILE'] as const,
} as const;

export const SCHEDULE_PROMPT_MAX_LENGTH = 1_000;

export function isVisibleSchedule(schedule: Schedule): boolean {
  return schedule.status !== 'CANCELLED';
}

export function scheduleCardTitle(prompt: string): string {
  const trimmed = prompt.trim();
  if (trimmed.length <= 48) {
    return trimmed;
  }
  return `${trimmed.slice(0, 45).trimEnd()}...`;
}

export function formatScheduleTime(schedule: Schedule): string {
  const { recurrence, nextRunAt } = schedule;
  const recAny = recurrence as { exactTime?: string; timeOfDay: ScheduleTimeOfDay };
  if (recAny.exactTime) {
    return `${recAny.exactTime} WIB`;
  }
  if (schedule.formattedTime) {
    return schedule.formattedTime;
  }
  if (nextRunAt) {
    try {
      const date = new Date(nextRunAt);
      if (!isNaN(date.getTime())) {
        const jakarta = new Date(date.getTime() + 7 * 60 * 60 * 1000);
        const h = String(jakarta.getUTCHours()).padStart(2, '0');
        const m = String(jakarta.getUTCMinutes()).padStart(2, '0');
        return `${h}:${m} WIB`;
      }
    } catch {
      // ignore
    }
  }
  return recurrence.timeOfDay;
}

export function formatScheduleFooter(schedule: Schedule): string | undefined {
  const { recurrence, nextRunAt, statusLabel } = schedule;

  if (statusLabel === 'PAUSED' || statusLabel === 'COMPLETED') {
    return undefined;
  }

  const timeStr = formatScheduleTime(schedule);

  if (recurrence.frequency === 'Weekly') {
    const days = (recurrence.days ?? [recurrence.repeatDay])
      .filter((day): day is ScheduleWeekday => Boolean(day))
      .map((day) => WEEKDAY_PLURAL[day] ?? day)
      .join(', ');
    return days ? `${days} · ${timeStr}` : timeStr;
  }

  if (recurrence.frequency === 'Once') {
    let dateStr = recurrence.date;
    if (nextRunAt) {
      try {
        const date = new Date(nextRunAt);
        if (!isNaN(date.getTime())) {
          const jakarta = new Date(date.getTime() + 7 * 60 * 60 * 1000);
          dateStr = `${jakarta.getUTCFullYear()}-${String(jakarta.getUTCMonth() + 1).padStart(2, '0')}-${String(jakarta.getUTCDate()).padStart(2, '0')}`;
        }
      } catch {
        // ignore
      }
    }
    return `${dateStr} · ${timeStr}`;
  }

  return `Daily · ${timeStr}`;
}

export function toScheduleCardItem(schedule: Schedule): ScheduleCardItem {
  const prompt = schedule.payload?.prompt?.trim() ?? '';
  if (!prompt) {
    return {
      id: schedule.id,
      status: schedule.statusLabel,
      title: 'Scheduled task',
      description: '',
      footerText: formatScheduleFooter(schedule),
    };
  }
  return {
    id: schedule.id,
    status: schedule.statusLabel,
    title: scheduleCardTitle(prompt),
    description: prompt,
    footerText: formatScheduleFooter(schedule),
  };
}

export function filterScheduleCards(
  items: ScheduleCardItem[],
  filter: ScheduleStatusFilter,
): ScheduleCardItem[] {
  if (filter === 'All') {
    return items;
  }
  if (filter === 'Active') {
    return items.filter((item) => item.status === 'MONITORING' || item.status === 'WEEKLY');
  }
  if (filter === 'Paused') {
    return items.filter((item) => item.status === 'PAUSED');
  }
  return items.filter((item) => item.status === 'COMPLETED');
}

export function getContextMenuVariant(
  status: ScheduleStatusLabel,
): ScheduleContextMenuVariant {
  if (status === 'PAUSED') {
    return 'paused';
  }
  if (status === 'COMPLETED') {
    return 'completed';
  }
  return 'active';
}

export function mapScheduleApiError(error: unknown): string {
  if (error instanceof Error && !isApiError(error) && error.message) {
    return error.message;
  }

  if (isApiError(error)) {
    if (error.code === 'CONFLICT') {
      return 'This schedule changed. Try again.';
    }
    if (error.code === 'INVALID_INPUT') {
      return 'That schedule could not be saved.';
    }
    if (error.code === 'NETWORK_ERROR') {
      return error.message;
    }
    return error.message || 'Unable to update schedules. Try again.';
  }

  return 'Unable to update schedules. Try again.';
}

function formatRelativeNextRun(nextRunAt: string | null): string | undefined {
  if (!nextRunAt) {
    return undefined;
  }

  const deltaMs = new Date(nextRunAt).getTime() - Date.now();
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
    return undefined;
  }

  const minutes = Math.round(deltaMs / 60_000);
  if (minutes < 1) {
    return 'Runs in under a minute';
  }
  if (minutes < 60) {
    return `Runs in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `Runs in ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }

  const days = Math.round(hours / 24);
  return `Runs in ${days} ${days === 1 ? 'day' : 'days'}`;
}
