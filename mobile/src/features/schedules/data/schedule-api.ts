import { apiRequest } from '@/lib/api';

import {
  CREATE_SCHEDULE_DEFAULTS,
  SCHEDULE_PROMPT_MAX_LENGTH,
  type Schedule,
} from '../domain/schedule';

type ScheduleResponse = {
  schedule: Schedule;
};

type ScheduleListResponse = {
  schedules: Schedule[];
  nextCursor: string | null;
};

export type CreateScheduleInput = {
  prompt: string;
  frequency?: 'Daily' | 'Weekly' | 'Once';
  every?: number;
  timeOfDay?: 'Morning' | 'Afternoon' | 'Evening';
  exactTime?: string;
  date?: string;
  repeatDay?: string;
  days?: string[];
  deliveryTargets?: Array<'MOBILE' | 'DEVICE'>;
  deviceId?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function asSchedule(value: unknown): Schedule {
  if (!isRecord(value)) {
    throw new Error('Invalid schedule payload');
  }

  const payload = isRecord(value.payload) ? value.payload : {};
  const prompt = typeof payload.prompt === 'string' ? payload.prompt : '';
  const recurrence = isRecord(value.recurrence) ? value.recurrence : { frequency: 'Daily', every: 1, timeOfDay: 'Morning' };
  const status = typeof value.status === 'string' ? value.status : 'ACTIVE';
  const statusLabel =
    typeof value.statusLabel === 'string'
      ? value.statusLabel
      : status === 'PAUSED'
        ? 'PAUSED'
        : status === 'ACTIVE' && recurrence.frequency === 'Weekly'
          ? 'WEEKLY'
          : status === 'ACTIVE'
            ? 'MONITORING'
            : 'COMPLETED';

  return {
    ...(value as Schedule),
    payload: {
      prompt,
      deliveryTargets: Array.isArray(payload.deliveryTargets)
        ? (payload.deliveryTargets as Schedule['payload']['deliveryTargets'])
        : ['MOBILE'],
    },
    recurrence: recurrence as Schedule['recurrence'],
    status: status as Schedule['status'],
    statusLabel: statusLabel as Schedule['statusLabel'],
    version: typeof value.version === 'number' ? value.version : 1,
    targetDeviceId:
      typeof value.targetDeviceId === 'string'
        ? value.targetDeviceId
        : typeof value.deviceId === 'string'
          ? value.deviceId
          : null,
    nextRunAt:
      typeof value.nextRunAt === 'string'
        ? value.nextRunAt
        : value.nextRunAt instanceof Date
          ? value.nextRunAt.toISOString()
          : null,
  };
}

export async function listSchedules(): Promise<Schedule[]> {
  const payload = await apiRequest<ScheduleListResponse>('/schedules?limit=100');
  return (payload.schedules ?? []).map(asSchedule);
}

export async function createSchedule(input: CreateScheduleInput): Promise<Schedule> {
  const frequency = input.frequency ?? 'Daily';
  const every = input.every ?? 1;
  const cleanHour = input.exactTime ? parseInt(input.exactTime.split(':')[0] ?? '9', 10) : 9;
  const timeOfDay = input.timeOfDay ?? (cleanHour < 12 ? 'Morning' : cleanHour < 18 ? 'Afternoon' : 'Evening');
  const deliveryTargets = input.deliveryTargets ?? ['MOBILE'];

  const body: Record<string, unknown> = {
    prompt: input.prompt.trim().slice(0, SCHEDULE_PROMPT_MAX_LENGTH),
    frequency,
    every,
    deliveryTargets,
    ...(input.exactTime ? { exactTime: input.exactTime } : {}),
    timeOfDay,
    ...(frequency === 'Once' && input.date ? { date: input.date } : {}),
    ...(frequency === 'Weekly' && input.days ? { days: input.days, repeatDay: input.repeatDay ?? input.days[0] } : {}),
    ...(input.deviceId ? { deviceId: input.deviceId } : {}),
  };
  const payload = await apiRequest<ScheduleResponse>('/schedules', {
    method: 'POST',
    body,
  });
  return asSchedule(payload.schedule);
}

export async function pauseSchedule(
  scheduleId: string,
  version: number,
): Promise<Schedule> {
  const payload = await apiRequest<ScheduleResponse>(`/schedules/${scheduleId}/pause`, {
    method: 'POST',
    body: { version },
  });
  return asSchedule(payload.schedule);
}

export async function resumeSchedule(
  scheduleId: string,
  version: number,
): Promise<Schedule> {
    method: 'POST',
    body: { version },
  });
  return asSchedule(payload.schedule);
}

export async function cancelSchedule(scheduleId: string, version: number): Promise<void> {
  await apiRequest<void>(`/schedules/${scheduleId}`, {
    method: 'DELETE',
    body: { version },
  });
}

export type UpdateScheduleBody = {
  version: number;
  prompt?: string;
  frequency?: 'Daily' | 'Weekly' | 'Once';
  every?: number;
  timeOfDay?: 'Morning' | 'Afternoon' | 'Evening';
  exactTime?: string;
  date?: string;
  repeatDay?: string;
  days?: string[];
  deliveryTargets?: Array<'MOBILE' | 'DEVICE'>;
  deviceId?: string | null;
};

export async function updateSchedule(
  scheduleId: string,
  body: UpdateScheduleBody,
): Promise<Schedule> {
  const payload = await apiRequest<ScheduleResponse>(`/schedules/${scheduleId}`, {
    method: 'PATCH',
    body,
  });
  return asSchedule(payload.schedule);
}
