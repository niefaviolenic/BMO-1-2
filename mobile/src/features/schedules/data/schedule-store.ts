import { isApiError, subscribeMobileWebSocket, type MobileInboundEvent } from '@/lib/api';
import { getRobotConnection } from '@/features/robot/data/robot-connection-store';
import {
  isVisibleSchedule,
  type Schedule,
} from '../domain/schedule';

import {
  cancelSchedule as cancelScheduleRequest,
  createSchedule as createScheduleRequest,
  listSchedules,
  pauseSchedule as pauseScheduleRequest,
  resumeSchedule as resumeScheduleRequest,
  updateSchedule as updateScheduleRequest,
  type CreateScheduleInput,
  type UpdateScheduleBody,
} from './schedule-api';

type Listener = () => void;

export type ScheduleStoreState = {
  schedules: Schedule[];
  isLoading: boolean;
  isMutating: boolean;
};

type ScheduleStoreBucket = {
  listeners: Set<Listener>;
  state: ScheduleStoreState;
  loadGeneration: number;
  wsBound: boolean;
};

const STORE_KEY = '__joyScheduleStore';

function bucket(): ScheduleStoreBucket {
  const globalRef = globalThis as typeof globalThis & {
    [STORE_KEY]?: ScheduleStoreBucket;
  };
  if (!globalRef[STORE_KEY]) {
    globalRef[STORE_KEY] = {
      listeners: new Set<Listener>(),
      state: {
        schedules: [],
        isLoading: false,
        isMutating: false,
      },
      loadGeneration: 0,
      wsBound: false,
    };
  }
  return globalRef[STORE_KEY];
}

function emit(): void {
  bucket().listeners.forEach((listener) => listener());
}

function setState(patch: Partial<ScheduleStoreState>): void {
  const store = bucket();
  store.state = { ...store.state, ...patch };
  emit();
}

function upsertSchedule(next: Schedule): void {
  const current = bucket().state.schedules;
  const without = current.filter((item) => item.id !== next.id);
  setState({
    schedules: [next, ...without].sort(compareSchedules),
  });
}

function compareSchedules(left: Schedule, right: Schedule): number {
  const leftAt = left.nextRunAt ?? '';
  const rightAt = right.nextRunAt ?? '';
  if (leftAt !== rightAt) {
    return rightAt.localeCompare(leftAt);
  }
  return left.id.localeCompare(right.id);
}

function scheduleById(id: string): Schedule | undefined {
  return bucket().state.schedules.find((item) => item.id === id);
}

async function withConflictRetry(work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (error) {
    if (!isApiError(error) || error.status !== 409) {
      throw error;
    }
    await refreshSchedules();
    await work();
  }
}

export function getScheduleStoreState(): ScheduleStoreState {
  return bucket().state;
}

export function subscribeSchedules(listener: Listener): () => void {
  const store = bucket();
  store.listeners.add(listener);
  bindWebSocket();
  return () => {
    store.listeners.delete(listener);
  };
}

export async function refreshSchedules(): Promise<void> {
  const store = bucket();
  const generation = ++store.loadGeneration;
  setState({ isLoading: true });
  try {
    const schedules = await listSchedules();
    if (generation !== store.loadGeneration) {
      return;
    }
    setState({
      schedules: schedules.slice().sort(compareSchedules),
      isLoading: false,
    });
  } catch (error) {
    if (generation !== store.loadGeneration) {
      return;
    }
    setState({ isLoading: false });
    throw error;
  }
}

export async function addNewSchedule(input: CreateScheduleInput): Promise<Schedule> {
  bucket().loadGeneration += 1;
  setState({ isMutating: true });
  try {
    const created = await createScheduleRequest(input);
    upsertSchedule(created);
    return created;
  } finally {
    setState({ isMutating: false });
  }
}

export async function createScheduleFromPrompt(prompt: string): Promise<void> {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return;
  }
  const robot = getRobotConnection();
  const targetDevice = robot.device ?? robot.devices[0] ?? null;
  const deliveryTargets: Array<'MOBILE' | 'DEVICE'> = targetDevice ? ['MOBILE', 'DEVICE'] : ['MOBILE'];
  const deviceId = targetDevice ? targetDevice.id : undefined;

  await addNewSchedule({
    prompt: trimmed,
    deliveryTargets,
    ...(deviceId ? { deviceId } : {}),
  });
}

export async function pauseScheduleById(id: string): Promise<void> {
  bucket().loadGeneration += 1;
  setState({ isMutating: true });
  try {
    await withConflictRetry(async () => {
      const current = scheduleById(id);
      if (!current) {
        return;
      }
      const updated = await pauseScheduleRequest(id, current.version);
      upsertSchedule(updated);
    });
  } finally {
    setState({ isMutating: false });
  }
}

export async function resumeScheduleById(id: string): Promise<void> {
  bucket().loadGeneration += 1;
  setState({ isMutating: true });
  try {
    await withConflictRetry(async () => {
      const current = scheduleById(id);
      if (!current) {
        return;
      }
      const updated = await resumeScheduleRequest(id, current.version);
      upsertSchedule(updated);
    });
  } finally {
    setState({ isMutating: false });
  }
}

export async function deleteScheduleById(id: string): Promise<void> {
  bucket().loadGeneration += 1;
  setState({ isMutating: true });
  try {
    await withConflictRetry(async () => {
      const current = scheduleById(id);
      if (!current) {
        return;
      }
      await cancelScheduleRequest(id, current.version);
      setState({
        schedules: bucket().state.schedules.map((item) =>
          item.id === id
            ? { ...item, status: 'CANCELLED', version: item.version + 1 }
            : item,
        ),
      });
    });
  } finally {
    setState({ isMutating: false });
  }
}

export async function updateScheduleById(
  id: string,
  patch: Omit<UpdateScheduleBody, 'version'>,
): Promise<void> {
  bucket().loadGeneration += 1;
  setState({ isMutating: true });
  try {
    await withConflictRetry(async () => {
      const current = scheduleById(id);
      if (!current) {
        return;
      }
      const updated = await updateScheduleRequest(id, {
        ...patch,
        version: current.version,
      });
      upsertSchedule(updated);
    });
  } finally {
    setState({ isMutating: false });
  }
}

export function getScheduleById(id: string | null): Schedule | null {
  if (!id) return null;
  return scheduleById(id) ?? null;
}

export function visibleSchedules(): Schedule[] {
  return bucket().state.schedules.filter(isVisibleSchedule);
}

function handleRealtimeEvent(event: MobileInboundEvent): void {
  if (event.event !== 'schedule_status') {
    return;
  }
  if (bucket().state.isMutating) {
    return;
  }
  void refreshSchedules().catch(() => undefined);
}

function bindWebSocket(): void {
  const store = bucket();
  if (store.wsBound) {
    return;
  }
  store.wsBound = true;
  subscribeMobileWebSocket(handleRealtimeEvent);
}
